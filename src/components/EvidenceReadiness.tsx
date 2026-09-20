import { useId } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { deriveEvidenceReadiness } from '../lib/evidenceReadiness';
import type { Draft, SourceRef, Workspace } from '../lib/types';
import './EvidenceReadiness.css';

interface ReadinessProps { draft: Draft; workspace: Workspace }

export function EvidenceReadinessBadge({ draft, workspace, onOpen }: ReadinessProps & { onOpen: () => void }) {
  const readiness = deriveEvidenceReadiness(draft, workspace);
  const Icon = readiness.state === 'changed' ? RefreshCw : readiness.state === 'blocked' ? AlertCircle : CheckCircle2;
  return <button type="button" className={`evidence-readiness-badge evidence-readiness-badge--${readiness.state} nodrag nopan`}
    aria-label={`${readiness.label} for ${draft.title || 'Untitled answer'}`}
    title={readiness.blockers.length ? `${readiness.blockers.length} check${readiness.blockers.length === 1 ? '' : 's'} to resolve. Open evidence review.` : 'Open evidence review. Checks do not replace Maya’s approval.'}
    onClick={event => { event.stopPropagation(); onOpen(); }}>
    <Icon size={13} aria-hidden="true" /><span>{readiness.label}</span>
  </button>;
}

function SourceDetail({ source, onOpenSource }: { source: SourceRef; onOpenSource?: (source: SourceRef) => void }) {
  return <div className="evidence-readiness-panel__source">
    <div className="evidence-readiness-panel__source-heading"><strong>{source.label}</strong><span>{source.page > 0 ? `Page ${source.page}` : 'Workspace reference'}</span></div>
    <blockquote>{source.excerpt || 'No excerpt recorded.'}</blockquote>
    {onOpenSource && <button type="button" className="evidence-readiness-panel__source-open" onClick={() => onOpenSource(source)}>Open source: {source.label}</button>}
  </div>;
}

export function EvidenceReadinessPanel({ draft, workspace, onClose, onOpenSource }: ReadinessProps & {
  onClose: () => void;
  onOpenSource?: (source: SourceRef) => void;
}) {
  const headingId = useId();
  const readiness = deriveEvidenceReadiness(draft, workspace);
  return <section className="evidence-readiness-panel" aria-labelledby={headingId}>
    <header className="evidence-readiness-panel__header">
      <div><p className="evidence-readiness-panel__eyebrow">Answer evidence</p><h2 id={headingId}>Evidence review</h2></div>
      <button type="button" className="evidence-readiness-panel__close" aria-label="Close evidence review" onClick={() => onClose()}><X size={19} aria-hidden="true" /></button>
    </header>
    <p className="evidence-readiness-panel__title">{draft.title || 'Untitled answer'}</p>
    <div className={`evidence-readiness-panel__summary evidence-readiness-panel__summary--${readiness.state}`} role="status">
      <strong>{readiness.label}</strong>
      <p>{readiness.blockers.length
        ? `${readiness.blockers.length} check${readiness.blockers.length === 1 ? '' : 's'} need attention before this answer is ready for review.`
        : 'The current checks pass. Maya still decides whether this answer is right for the follower.'}</p>
    </div>
    <p className="evidence-readiness-panel__boundary">Answer status: <strong>{draft.status === 'draft' ? 'Draft' : draft.status === 'approved' ? 'Approved' : 'Published'}</strong>. These checks use the current workspace and are separate from approval. Marking a report resolved does not clear unsupported advice.</p>
    {readiness.blockers.length > 0 && <div className="evidence-readiness-panel__section"><h3>Checks to resolve</h3><ul className="evidence-readiness-panel__blockers">{readiness.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul></div>}
    {readiness.missingProductIds.length > 0 && <div className="evidence-readiness-panel__section"><h3>Missing product records</h3><p>These linked products are absent from the catalogue. A changed source elsewhere does not resolve this gap.</p><ul>{readiness.missingProductIds.map(id => <li key={id}>{id}</li>)}</ul></div>}
    {readiness.changedProducts.length > 0 && <div className="evidence-readiness-panel__section"><h3>Changed product evidence</h3><p>Compare the current records below with the sources saved on this answer, then create and review a fresh draft.</p>{readiness.changedProducts.map(product => <div key={product.id} className="evidence-readiness-panel__changed"><h4>{product.name}</h4><p>Draft used revision {product.draftRevision ?? 'not recorded'} · Current revision {product.currentRevision}</p><SourceDetail source={product.source} onOpenSource={onOpenSource} /></div>)}</div>}
    <div className="evidence-readiness-panel__section"><h3>Attached sources · {readiness.sources.length}</h3><p>Saved references are shown in full. Their presence alone does not verify every claim in the answer.</p>{readiness.sources.length ? readiness.sources.map((source, index) => <SourceDetail key={`${source.page}-${source.label}-${index}`} source={source} onOpenSource={onOpenSource} />) : <p>No sources are attached to this answer.</p>}</div>
  </section>;
}
