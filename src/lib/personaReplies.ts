import type { CanvasCard, Workspace } from './types';
import { validateDraft } from './engine';
import { mayaNotes } from './seed';
import { MAYA_PERSONA } from './persona';

export type PersonaTopic = 'persona' | 'issues' | 'selected';
export type VoiceCommandResult = { ok: boolean; message: string };

/** Contextual but bounded replies: these templates do not call or impersonate an AI service. */
export function personaReply(topic: PersonaTopic, workspace: Workspace, selected?: CanvasCard): VoiceCommandResult {
  if (topic === 'persona') return { ok: true, message: `This is the Maya persona, based on the Operation Shade notes. ${MAYA_PERSONA.approach}` };
  if (topic === 'issues') {
    const open = workspace.issues.filter(issue => issue.status !== 'Resolved');
    if (!open.length) return { ok: true, message: 'There are no open report entries. That records the review decisions; each answer still needs its own evidence check before approval.' };
    const missing = open.filter(issue => issue.kind === 'Missing material');
    const blocking = open.filter(issue => issue.severity === 'Blocks affected answer');
    const examples = (missing.length ? missing : open).slice(0, 3).map(issue => issue.title).join('; ');
    const nextStep = blocking.length ? 'Let’s fill those gaps before the affected recommendations go out.' : 'These entries need report review. Each answer has separate evidence checks.';
    return { ok: true, message: `There ${open.length === 1 ? 'is' : 'are'} ${open.length} open report ${open.length === 1 ? 'entry' : 'entries'}, including ${missing.length} for missing material. ${blocking.length} ${blocking.length === 1 ? 'entry blocks its' : 'entries block their'} affected answers. Start here: ${examples}. ${nextStep}` };
  }
  if (!selected) return { ok: false, message: 'Select a card on the canvas first. Then I can explain what it says and what needs checking.' };
  if (selected.kind === 'question') {
    const question = workspace.questions.find(item => item.id === selected.entityId);
    if (question) {
      const draft = workspace.drafts.find(item => item.questionId === question.id);
      const problems = draft ? validateDraft(draft, workspace) : [];
      return { ok: true, message: `This question is from ${question.handle}: ${question.text} ${problems.length ? `The draft needs a check: ${problems[0]}` : draft ? 'There is already an answer attached. Open it to review the wording and its evidence.' : 'Use “Draft an answer” to prepare a suggestion from the attached evidence. It will still need your review.'}` };
    }
  }
  if (selected.kind === 'draft') {
    const draft = workspace.drafts.find(item => item.id === selected.entityId);
    if (draft) {
      const problems = validateDraft(draft, workspace);
      return { ok: true, message: problems.length
        ? `This answer needs more evidence. ${problems[0]} Let’s settle that before approving it.`
        : draft.status === 'draft'
          ? `The bounded evidence checks pass for “${draft.title}”. It is still a draft. Give the wording a proper look before approving it.`
          : `“${draft.title}” is ${draft.status === 'published' ? 'published locally' : 'approved locally'}. Its bounded evidence checks currently pass. Editing the answer will return it to review.` };
    }
  }
  if (selected.kind === 'product') {
    const product = workspace.products.find(item => item.id === selected.entityId);
    if (product) return { ok: true, message: `${product.name} is recorded at £${product.price.toFixed(product.price % 1 ? 2 : 0)}. The current note says: “${product.note}” That is the recorded judgement; a personal recommendation still depends on the follower’s context.` };
  }
  if (selected.kind === 'issue') {
    const issue = workspace.issues.find(item => item.id === selected.entityId);
    if (issue) return { ok: true, message: `${issue.title}. Status: ${issue.status}. ${issue.status === 'Resolved' ? 'The original finding was: ' : ''}${issue.description} ${issue.status === 'Resolved' ? `The recorded resolution is: ${issue.resolution || 'No resolution detail supplied.'} Answer evidence is checked separately.` : `Next step: ${issue.nextAction}`}` };
  }
  if (selected.kind === 'note') {
    const note = mayaNotes.find(item => item.id === selected.entityId);
    if (note) return { ok: true, message: `This card summarises the case-file notes on page ${note.source.page}: ${note.text}` };
  }
  return { ok: false, message: 'That card no longer has a matching record. Select another card so we can check the right evidence.' };
}
