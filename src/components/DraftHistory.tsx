import { useId } from 'react';
import type { Draft } from '../lib/types';
import { DecisionSummary } from './DecisionProfile';
import './DraftHistory.css';

function savedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function DraftWording({ draft }: { draft: Pick<Draft, 'title' | 'text' | 'decision'> }) {
  return <div className="draft-history-wording">
    <h4>{draft.title || 'Untitled answer'}</h4>
    <p className="draft-history-answer">{draft.text || 'No answer wording recorded.'}</p>
    {draft.decision ? <DecisionSummary value={draft.decision}/> : <p className="draft-history-no-decision">No decision details were recorded in this version.</p>}
  </div>;
}

export function DraftHistory({ draft, onRestore }: { draft: Draft; onRestore: (revisionId: string) => void }) {
  const id = useId();
  const revisions = [...(draft.history ?? [])].reverse();
  return <section className="draft-history" aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>Saved draft versions</h3>
    <p className="draft-history-intro">This device keeps up to 20 earlier versions. Restoring brings back the wording and decision details with the current evidence. The answer will need review again.</p>
    {revisions.length === 0 ? <p className="draft-history-empty">No earlier versions yet. Editing or refreshing this answer will save a version here.</p> : <ol className="draft-history-list">
      {revisions.map((revision, index) => <li key={revision.id}>
        <details>
          <summary><span className="draft-history-version"><strong>{revision.reason}</strong><time dateTime={revision.savedAt}>{savedDate(revision.savedAt)}</time></span><span className="draft-history-version-number">Version {revisions.length - index}</span></summary>
          <DraftWording draft={revision.snapshot}/>
          <button type="button" className="secondary" onClick={() => onRestore(revision.id)} aria-label={`Restore wording from version ${revisions.length - index}`}>Restore this wording</button>
        </details>
      </li>)}
    </ol>}
  </section>;
}

export function DraftComparison({ current, suggested, onUseSuggested, onKeepWording, onCancel }: {
  current: Draft;
  suggested: Draft;
  onUseSuggested: () => void;
  onKeepWording: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  return <section className="draft-comparison" aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>Choose the wording to keep</h3>
    <p className="draft-history-intro">Whether you keep your wording or use the suggestion, the answer will use the latest evidence and need review again. Your current version will stay in draft history.</p>
    <div className="draft-comparison-columns">
      <section aria-labelledby={`${id}-current`}><h3 id={`${id}-current`}>Your wording</h3><DraftWording draft={current}/></section>
      <section aria-labelledby={`${id}-suggested`}><h3 id={`${id}-suggested`}>Updated suggestion</h3><DraftWording draft={suggested}/></section>
    </div>
    <div className="draft-comparison-actions">
      <button type="button" className="primary" onClick={onKeepWording}>Keep my wording and refresh evidence</button>
      <button type="button" className="secondary" onClick={onUseSuggested}>Use updated suggestion</button>
      <button type="button" className="quiet-button" onClick={onCancel}>Cancel refresh</button>
    </div>
  </section>;
}
