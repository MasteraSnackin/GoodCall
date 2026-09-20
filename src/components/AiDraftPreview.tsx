import type { Draft } from '../lib/types';
import { DecisionSummary } from './DecisionProfile';

export default function AiDraftPreview({ current, suggested, onApply, onCancel }: { current: Draft; suggested: Draft; onApply: () => void; onCancel: () => void }) {
  return <section className="draft-comparison">
    <p className="draft-history-intro">Review the AI suggestion before replacing your wording. Applying it saves your current version in answer history and requires a fresh review.</p>
    <div className="draft-comparison-columns">{[{label:'Current answer',draft:current},{label:'AI suggestion',draft:suggested}].map(({label,draft})=><section key={label}><h3>{label}</h3><strong>{draft.title}</strong><p style={{whiteSpace:'pre-wrap'}}>{draft.text}</p>{draft.decision&&<DecisionSummary value={draft.decision}/>}</section>)}</div>
    <div className="draft-comparison-actions"><button className="primary" onClick={onApply}>Use AI suggestion</button><button className="secondary" onClick={onCancel}>Keep current answer</button></div>
  </section>;
}
