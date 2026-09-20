import { useId } from 'react';
import { DECISION_FIELD_LIMIT, DECISION_VERDICTS } from '../lib/decisionTypes';
import type { DecisionProfile } from '../lib/decisionTypes';
import './DecisionProfile.css';

const fields: { key: 'suits' | 'skipIf' | 'unknowns'; label: string; hint: string }[] = [
  { key: 'suits', label: 'Who this is for', hint: 'Describe the needs or circumstances this advice suits.' },
  { key: 'skipIf', label: 'When to skip it', hint: 'Include reasons to wait, keep an existing product or choose something else.' },
  { key: 'unknowns', label: 'What still needs checking', hint: 'Keep unanswered questions and gaps in the evidence visible.' },
];

function verdictClass(verdict: DecisionProfile['verdict']) {
  return verdict === 'Consider' ? 'consider' : verdict === 'Skip for now' ? 'skip' : 'context';
}

export function DecisionEditor({ value, onChange }: { value: DecisionProfile; onChange: (next: DecisionProfile) => void }) {
  const id = useId();
  return <section className="decision-editor" aria-labelledby={`${id}-title`}>
    <div className="decision-editor-heading"><h3 id={`${id}-title`}>The decision behind the answer</h3><span>Review with the answer</span></div>
    <p className="decision-editor-guidance" id={`${id}-guidance`}>Suggested guidance needs your review alongside the answer. These fields appear on the public advice card: leave out follower handles and personal details.</p>
    <div className="decision-editor-verdict">
      <label htmlFor={`${id}-verdict`}>Maya’s call</label>
      <select id={`${id}-verdict`} value={value.verdict} aria-describedby={`${id}-guidance`} onChange={event => onChange({ ...value, verdict: event.target.value as DecisionProfile['verdict'] })}>
        {DECISION_VERDICTS.map(verdict => <option key={verdict} value={verdict}>{verdict}</option>)}
      </select>
    </div>
    <div className="decision-editor-fields">{fields.map(field => <div className="decision-editor-field" key={field.key}>
      <label htmlFor={`${id}-${field.key}`}>{field.label}</label>
      <p id={`${id}-${field.key}-hint`}>{field.hint}</p>
      <textarea id={`${id}-${field.key}`} value={value[field.key]} required rows={3} maxLength={DECISION_FIELD_LIMIT} aria-describedby={`${id}-${field.key}-hint ${id}-${field.key}-count`} onChange={event => onChange({ ...value, [field.key]: event.target.value.slice(0, DECISION_FIELD_LIMIT) })}/>
      <span className="decision-editor-count" id={`${id}-${field.key}-count`}>{value[field.key].length} / {DECISION_FIELD_LIMIT} characters</span>
    </div>)}</div>
  </section>;
}

function summaryText(text: string, compact: boolean) {
  const clean = text.trim();
  if (!clean) return 'Not yet recorded.';
  if (!compact || clean.length <= 115) return clean;
  const opening = clean.slice(0, 112);
  const lastSpace = opening.lastIndexOf(' ');
  return `${lastSpace > 75 ? opening.slice(0, lastSpace) : opening}…`;
}

export function DecisionSummary({ value, compact = false }: { value: DecisionProfile; compact?: boolean }) {
  return <section className={`decision-summary${compact ? ' decision-summary-compact' : ''}`} aria-label="Decision guidance">
    <div className="decision-summary-heading"><span>Maya’s call</span><strong className={`decision-verdict decision-verdict-${verdictClass(value.verdict)}`}>{value.verdict}</strong></div>
    <dl className="decision-summary-fields">{fields.map(field => <div className={`decision-summary-field decision-summary-${field.key}`} key={field.key}>
      <dt>{field.label}</dt><dd>{summaryText(value[field.key], compact)}</dd>
    </div>)}</dl>
  </section>;
}
