import type { Draft, DraftRevision } from './types';

export const DRAFT_HISTORY_LIMIT = 20;
export const DRAFT_EDIT_GROUP_MS = 30_000;

export interface RevisionOptions {
  now?: string;
  coalesce?: boolean;
  windowMs?: number;
}

function snapshotOf(draft: Draft): DraftRevision['snapshot'] {
  const snapshot = { ...draft };
  delete snapshot.history;
  return structuredClone(snapshot);
}

function recoverableContent(draft: Draft) {
  return JSON.stringify({
    questionId: draft.questionId, title: draft.title, text: draft.text,
    decision: draft.decision, mode: draft.mode, productIds: draft.productIds,
    sourceRefs: draft.sourceRefs, productRevisions: draft.productRevisions,
    persona: draft.persona, reusedFrom: draft.reusedFrom, ai: draft.ai,
  });
}

/** Save the version about to be replaced. Rapid edits can share one checkpoint. */
export function checkpointDraft(draft: Draft, reason: string, options: RevisionOptions = {}): Draft {
  const now = options.now ?? new Date().toISOString();
  const history = draft.history ?? [];
  const latest = history.at(-1);
  const elapsed = Date.parse(now) - Date.parse(draft.updatedAt);
  if (options.coalesce && draft.status === 'draft' && latest?.reason === reason && elapsed >= 0 && elapsed <= (options.windowMs ?? DRAFT_EDIT_GROUP_MS)) {
    return draft;
  }
  const revision: DraftRevision = {
    id: `revision-${crypto.randomUUID()}`,
    savedAt: now,
    reason,
    snapshot: snapshotOf(draft),
  };
  return { ...draft, history: [...history, revision].slice(-DRAFT_HISTORY_LIMIT) };
}

/** Apply at a workspace mutation boundary; approval-only changes need no revision. */
export function recordDraftRevision(previous: Draft, next: Draft, reason: string, options: RevisionOptions = {}): Draft {
  // Restore and other explicit history operations already preserve the outgoing version.
  if (next.history && JSON.stringify(next.history) !== JSON.stringify(previous.history)) return next;
  const reviewInvalidated = previous.status !== 'draft' && next.status === 'draft';
  if (!reviewInvalidated && recoverableContent(previous) === recoverableContent(next)) return next;
  const recorded = checkpointDraft(previous, reason, options);
  return { ...next, history: recorded.history };
}

/** Restore the wording against today's evidence; never resurrect an old approval. */
export function restoreDraftRevision(current: Draft, revisionId: string, now = new Date().toISOString()): Draft {
  const revision = current.history?.find(item => item.id === revisionId);
  if (!revision) throw new Error('This saved draft is no longer available.');
  const recorded = checkpointDraft(current, 'Before restoring an earlier draft', { now });
  const { title, text, decision, mode } = revision.snapshot;
  const ai = revision.snapshot.ai ? { ...revision.snapshot.ai, missingEvidence: [...new Set([...revision.snapshot.ai.missingEvidence, ...(current.ai?.missingEvidence || [])])] } : current.ai;
  return {
    ...recorded, title, text, decision: decision ? { ...decision } : undefined, mode, ai,
    status: 'draft', approvedAt: undefined, publishedAt: undefined, cardId: undefined,
    updatedAt: now,
  };
}

/** Both refresh choices use new evidence, while preserving the outgoing draft in history. */
export function refreshDraftWithHistory(current: Draft, suggested: Draft, keepWording = false, now = new Date().toISOString()): Draft {
  const recorded = checkpointDraft(current, 'Before refreshing from evidence', { now });
  return {
    ...suggested,
    ...(keepWording ? { title: current.title, text: current.text, decision: current.decision ? { ...current.decision } : undefined, mode: current.mode, ai: current.ai } : {}),
    id: current.id, questionId: current.questionId, createdAt: current.createdAt,
    history: recorded.history, updatedAt: now,
    status: 'draft', approvedAt: undefined, publishedAt: undefined, cardId: undefined,
  };
}
