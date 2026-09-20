import { useEffect, useId, useState } from 'react';
import { Copy, Focus, MessageCircle, PanelsTopLeft, Trash2, X } from 'lucide-react';
import type { Question, Workspace } from '../lib/types';
import {
  createDecisionSection, DECISION_SECTION_LIMIT, DECISION_SECTION_MEMBER_LIMIT, DECISION_SECTION_TITLE_LIMIT,
  FOLLOW_UP_LIMIT, FOLLOW_UP_PROMPT_LIMIT, getDecisionSectionCardIds, removeDecisionSection,
  removeQuestionFollowUp, renameDecisionSection, replaceDecisionSectionMembers, setFollowUpStatus, setQuestionFollowUp,
} from '../lib/canvasWorkflow';
import type { DecisionSection, QuestionFollowUp, WorkflowWorkspace } from '../lib/canvasWorkflow';
import './CanvasWorkflow.css';

export interface CanvasWorkflowPanelProps {
  workspace: Workspace;
  selectedCardIds: string[];
  onChange: (update: (workspace: Workspace) => Workspace) => void;
  onClose: () => void;
  onFocusCards: (ids: string[]) => void;
  onClarifyQuestion: (questionId: string) => void;
}

type WorkflowChange = CanvasWorkflowPanelProps['onChange'];
const defaultPrompt = 'What would you most like to change about your current routine?';

function FollowUpEditor({ question, record, onChange, onClarify, onFocus, canAdd }: {
  question: Question; record?: QuestionFollowUp; onChange: WorkflowChange;
  onClarify: () => void; onFocus: () => void; canAdd: boolean;
}) {
  const labelId = useId();
  const [prompt, setPrompt] = useState(record?.prompt ?? defaultPrompt);
  const [feedback, setFeedback] = useState('');
  const [copying, setCopying] = useState(false);
  useEffect(() => { setPrompt(record?.prompt ?? defaultPrompt); setFeedback(''); }, [record?.id, record?.prompt]);
  const valid = prompt.trim().length > 0 && prompt.length <= FOLLOW_UP_PROMPT_LIMIT;
  async function copy() {
    setFeedback(''); setCopying(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(prompt.trim());
      setFeedback('Copied. Paste it into the conversation when you are ready.');
    } catch { setFeedback('Could not copy. Select and copy the question text yourself.'); }
    finally { setCopying(false); }
  }
  return <article className="canvas-workflow__item" aria-label={`Follow-up for ${question.handle}`}>
    <div className="canvas-workflow__item-heading"><strong>{question.handle}</strong>{record && <span className={`canvas-workflow__status${record.status === 'Context received' ? ' is-received' : ''}`}>{record.status}</span>}</div>
    <p className="canvas-workflow__question">{question.text}</p>
    <form onSubmit={event => { event.preventDefault(); if (valid && (record || canAdd)) onChange(workspace => setQuestionFollowUp(workspace, question.id, prompt)); }}>
      <label htmlFor={labelId}>Follow-up question</label>
      <textarea id={labelId} rows={3} maxLength={FOLLOW_UP_PROMPT_LIMIT} value={prompt} onChange={event => { setPrompt(event.target.value); setFeedback(''); }} required />
      <p className="canvas-workflow__hint">{record ? 'Changing the saved question sets it back to waiting for a reply.' : 'Edit this starting question to match the follower’s missing context.'}</p>
      <div className="canvas-workflow__actions">
        <button type="submit" disabled={!valid || (!record && !canAdd) || record?.prompt === prompt.trim()}>{record ? 'Save question' : 'Track follow-up'}</button>
        <button type="button" onClick={copy} disabled={!valid || copying}><Copy size={13} />{copying ? 'Copying…' : 'Copy question'}</button>
      </div>
    </form>
    {record && <div className="canvas-workflow__actions canvas-workflow__actions--secondary">
      <button type="button" onClick={() => onChange(workspace => setFollowUpStatus(workspace, record.id, record.status === 'Waiting for reply' ? 'Context received' : 'Waiting for reply'))}>{record.status === 'Waiting for reply' ? 'Mark context received' : 'Mark waiting for reply'}</button>
      <button type="button" onClick={onClarify}>Update question context</button>
      <button type="button" onClick={onFocus}><Focus size={13} />Show question</button>
      <button type="button" aria-label={`Remove follow-up for ${question.handle}`} onClick={() => onChange(workspace => removeQuestionFollowUp(workspace, record.id))}><Trash2 size={13} />Remove follow-up</button>
    </div>}
    {feedback && <p className="canvas-workflow__feedback" role="status">{feedback}</p>}
  </article>;
}

function SectionEditor({ workspace, section, selectedCardIds, onChange, onFocusCards }: {
  workspace: Workspace; section: DecisionSection; selectedCardIds: string[]; onChange: WorkflowChange; onFocusCards: (ids: string[]) => void;
}) {
  const titleId = useId();
  const [title, setTitle] = useState(section.title);
  useEffect(() => setTitle(section.title), [section.title]);
  const cardIds = getDecisionSectionCardIds(workspace, section);
  const selectionValid = selectedCardIds.length > 0 && selectedCardIds.length <= DECISION_SECTION_MEMBER_LIMIT;
  return <article className="canvas-workflow__item" aria-label={`Decision section: ${section.title}`}>
    <form onSubmit={event => { event.preventDefault(); onChange(current => renameDecisionSection(current, section.id, title)); }}>
      <label htmlFor={titleId}>Section name</label>
      <input id={titleId} maxLength={DECISION_SECTION_TITLE_LIMIT} value={title} onChange={event => setTitle(event.target.value)} required />
      <div className="canvas-workflow__actions"><button type="submit" disabled={!title.trim() || title.trim() === section.title}>Save name</button><span className="canvas-workflow__hint">{cardIds.length} {cardIds.length === 1 ? 'card' : 'cards'}</span></div>
    </form>
    <div className="canvas-workflow__actions canvas-workflow__actions--secondary">
      <button type="button" onClick={() => onFocusCards(cardIds)} disabled={!cardIds.length}><Focus size={13} />Show section</button>
      <button type="button" onClick={() => onChange(current => replaceDecisionSectionMembers(current, section.id, selectedCardIds))} disabled={!selectionValid}>Use current selection</button>
      <button type="button" onClick={() => onChange(current => removeDecisionSection(current, section.id))}><Trash2 size={13} />Remove section</button>
    </div>
    <p className="canvas-workflow__hint">Removing the section keeps every card and connection.</p>
  </article>;
}

export function CanvasWorkflowPanel({ workspace, selectedCardIds, onChange, onClose, onFocusCards, onClarifyQuestion }: CanvasWorkflowPanelProps) {
  const tracked = workspace as WorkflowWorkspace;
  const titleId = useId();
  const [sectionTitle, setSectionTitle] = useState('');
  const selected = new Set(selectedCardIds);
  const evidenceCardIds = workspace.cards.filter(card => selected.has(card.id)).map(card => card.id);
  const selectedQuestionIds = new Set(workspace.cards.filter(card => selected.has(card.id) && card.kind === 'question').map(card => card.entityId));
  const followUps = tracked.questionFollowUps ?? [];
  const sections = tracked.decisionSections ?? [];
  const trackedQuestionIds = new Set(followUps.map(record => record.questionId));
  const newQuestions = workspace.questions.filter(question => selectedQuestionIds.has(question.id) && !trackedQuestionIds.has(question.id));
  const orderedFollowUps = [...followUps].sort((left, right) => Number(selectedQuestionIds.has(right.questionId)) - Number(selectedQuestionIds.has(left.questionId)));
  const questionCards = (questionId: string) => workspace.cards.filter(card => card.kind === 'question' && card.entityId === questionId).map(card => card.id);
  const selectionValid = evidenceCardIds.length > 0 && evidenceCardIds.length <= DECISION_SECTION_MEMBER_LIMIT;
  return <aside className="canvas-workflow" aria-label="Follow-ups and decision sections">
    <header className="canvas-workflow__header"><div><p>Canvas tools</p><h2>Follow-ups &amp; sections</h2></div><button type="button" aria-label="Close follow-ups and sections" onClick={onClose}><X size={18} /></button></header>
    <div className="canvas-workflow__body">
      <section aria-labelledby="canvas-follow-up-heading">
        <h3 id="canvas-follow-up-heading"><MessageCircle size={16} />Clarification follow-ups</h3>
        <p className="canvas-workflow__intro">Keep track of what you need to ask. Copying a question does not send it to a follower.</p>
        <p className="canvas-workflow__boundary">“Context received” is a reminder only. Use “Update question context” to record the reply and review the evidence before approving an answer.</p>
        {!newQuestions.length && !selectedQuestionIds.size && <p className="canvas-workflow__empty">Select a question card to add a follow-up.</p>}
        {followUps.length >= FOLLOW_UP_LIMIT && <p className="canvas-workflow__boundary">The {FOLLOW_UP_LIMIT}-follow-up limit is reached. Remove an old follow-up to add another.</p>}
        {newQuestions.map(question => <FollowUpEditor key={question.id} question={question} onChange={onChange} onClarify={() => onClarifyQuestion(question.id)} onFocus={() => onFocusCards(questionCards(question.id))} canAdd={followUps.length < FOLLOW_UP_LIMIT} />)}
        {orderedFollowUps.length > 0 && <p className="canvas-workflow__count">{followUps.filter(record => record.status === 'Waiting for reply').length} waiting · {followUps.filter(record => record.status === 'Context received').length} received</p>}
        {orderedFollowUps.map(record => { const question = workspace.questions.find(item => item.id === record.questionId); return question ? <FollowUpEditor key={question.id} question={question} record={record} onChange={onChange} onClarify={() => onClarifyQuestion(question.id)} onFocus={() => onFocusCards(questionCards(question.id))} canAdd /> : null; })}
      </section>
      <section aria-labelledby="canvas-decision-section-heading">
        <h3 id="canvas-decision-section-heading"><PanelsTopLeft size={16} />Decision sections</h3>
        <p className="canvas-workflow__intro">Group a question, evidence and answer under one name. A section organises cards; it does not establish evidence or approval.</p>
        <form className="canvas-workflow__new-section" onSubmit={event => { event.preventDefault(); if (selectionValid && sectionTitle.trim() && sections.length < DECISION_SECTION_LIMIT) { onChange(current => createDecisionSection(current, sectionTitle, evidenceCardIds)); setSectionTitle(''); } }}>
          <label htmlFor={titleId}>New section name</label>
          <input id={titleId} value={sectionTitle} onChange={event => setSectionTitle(event.target.value)} maxLength={DECISION_SECTION_TITLE_LIMIT} placeholder="e.g. Is it worth £62?" required />
          <p className="canvas-workflow__hint">{evidenceCardIds.length} selected {evidenceCardIds.length === 1 ? 'card' : 'cards'}. Private review notes stay outside sections.</p>
          {!selectionValid && <p className="canvas-workflow__hint">Select between 1 and {DECISION_SECTION_MEMBER_LIMIT} question, product, source, issue or answer cards.</p>}
          {sections.length >= DECISION_SECTION_LIMIT && <p className="canvas-workflow__boundary">The {DECISION_SECTION_LIMIT}-section limit is reached.</p>}
          <button type="submit" disabled={!selectionValid || !sectionTitle.trim() || sections.length >= DECISION_SECTION_LIMIT}>Create section from selection</button>
        </form>
        {sections.map(section => <SectionEditor key={section.id} workspace={workspace} section={section} selectedCardIds={evidenceCardIds} onChange={onChange} onFocusCards={onFocusCards} />)}
      </section>
    </div>
  </aside>;
}
