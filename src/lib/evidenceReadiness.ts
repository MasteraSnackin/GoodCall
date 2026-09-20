import { validateDraft } from './engine';
import type { Draft, SourceRef, Workspace } from './types';

export interface ChangedProductEvidence {
  id: string;
  name: string;
  draftRevision: number | undefined;
  currentRevision: number;
  source: SourceRef;
}

export interface EvidenceReadiness {
  state: 'blocked' | 'changed' | 'ready';
  label: string;
  blockers: string[];
  changedProducts: ChangedProductEvidence[];
  missingProductIds: string[];
  sources: SourceRef[];
}

/** Readiness describes the current checks; it never changes a draft's approval. */
export function deriveEvidenceReadiness(draft: Draft, workspace: Workspace): EvidenceReadiness {
  const blockers = validateDraft(draft, workspace);
  const changedProducts: ChangedProductEvidence[] = [];
  const missingProductIds: string[] = [];
  for (const id of new Set(draft.productIds)) {
    const product = workspace.products.find(item => item.id === id);
    if (!product) missingProductIds.push(id);
    else if (draft.productRevisions[id] !== product.revision) {
      changedProducts.push({
        id, name: product.name, draftRevision: draft.productRevisions[id],
        currentRevision: product.revision, source: { ...product.source },
      });
    }
  }
  const state = changedProducts.length ? 'changed' : blockers.length ? 'blocked' : 'ready';
  const label = state === 'changed' ? 'Evidence changed'
    : state === 'blocked' ? `Checks needed · ${blockers.length}`
    : draft.status === 'draft' ? 'Ready for review' : 'Checks passed';
  const sources = draft.sourceRefs.filter((source, index, all) => all.findIndex(other =>
    other.page === source.page && other.label === source.label && other.excerpt === source.excerpt,
  ) === index).map(source => ({ ...source }));
  return { state, label, blockers, changedProducts, missingProductIds, sources };
}
