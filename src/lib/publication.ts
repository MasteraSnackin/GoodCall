import type { Draft, PublishedAdvice, Workspace } from './types';
import { toPublishedAdvice } from './engine';
import { encodeAdvice } from './share';
import { recordDraftRevision } from './draftHistory';
import { saveWorkspace, uid } from './storage';

/** Preview and publication must obey the same public schema and encoded size limit. */
export function createPublicationPreview(draft: Draft, workspace: Workspace) {
  const advice = toPublishedAdvice(draft, workspace);
  return { advice, token: encodeAdvice(advice) };
}

export type PublicationResult =
  | { ok: true; workspace: Workspace; advice: PublishedAdvice; token: string }
  | { ok: false; error: string };

/** Keep publication out of UI state until the complete proposed workspace is saved. */
export function commitPublication(
  workspace: Workspace,
  draftId: string,
  persist: (next: Workspace) => boolean = saveWorkspace,
  now = new Date().toISOString(),
): PublicationResult {
  const draft = workspace.drafts.find(item => item.id === draftId);
  if (!draft || draft.status !== 'approved') {
    return { ok: false, error: 'Review and approve this answer before publishing.' };
  }
  let next: Workspace;
  let preview: ReturnType<typeof createPublicationPreview>;
  try {
    const published: Draft = { ...draft, status: 'published', approvedAt: draft.approvedAt || now, publishedAt: now, updatedAt: now };
    preview = createPublicationPreview(published, workspace);
    next = {
      ...workspace,
      drafts: workspace.drafts.map(item => item.id === draftId
        ? recordDraftRevision(item, published, 'Published an approved advice card') : item),
      activity: [{ id: uid('event'), text: 'Published an approved advice card', at: now }, ...workspace.activity].slice(0, 60),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'This answer could not be prepared for sharing. Review it and try again.' };
  }
  try {
    if (!persist(next)) return { ok: false, error: 'Publication was not saved. Your answer is still approved. Download a backup or free browser storage, then try again.' };
  } catch {
    return { ok: false, error: 'Publication was not saved. Your answer is still approved. Check browser storage and try again.' };
  }
  return { ok: true, workspace: next, ...preview };
}
