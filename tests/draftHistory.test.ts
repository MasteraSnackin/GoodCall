import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer } from '../src/lib/engine';
import { checkpointDraft, DRAFT_HISTORY_LIMIT, recordDraftRevision, refreshDraftWithHistory, restoreDraftRevision } from '../src/lib/draftHistory';

const at = '2026-09-20T12:00:00.000Z';
function draft() {
  const workspace = createWorkspace();
  return { ...draftAnswer(workspace.questions[3], workspace.products), createdAt: at, updatedAt: at };
}

test('regeneration saves the exact outgoing wording and decision without nested history', () => {
  const original = { ...draft(), text: 'Maya’s carefully edited answer.', status: 'published' as const, approvedAt: at, publishedAt: at, cardId: 'old-card' };
  original.decision!.skipIf = 'Keep your existing moisturiser if it works.';
  const next = refreshDraftWithHistory(original, { ...draft(), text: 'New suggestion.' }, false, '2026-09-20T12:02:00.000Z');
  assert.equal(next.text, 'New suggestion.');
  assert.equal(next.history?.[0].snapshot.text, original.text);
  assert.equal(next.history?.[0].snapshot.decision?.skipIf, original.decision!.skipIf);
  assert.equal(next.history?.[0].snapshot.status, 'published');
  assert.equal('history' in next.history![0].snapshot, false);
  assert.equal(next.status, 'draft');
  assert.equal(next.approvedAt, undefined);
  assert.equal(next.publishedAt, undefined);
  assert.equal(next.cardId, undefined);
  assert.equal(original.history, undefined);
  original.decision!.skipIf = 'Changed later.';
  assert.equal(next.history![0].snapshot.decision!.skipIf, 'Keep your existing moisturiser if it works.');
});

test('history keeps the latest 20 checkpoints and no nested copies', () => {
  let current = draft();
  for (let index = 0; index < 27; index++) {
    current = { ...checkpointDraft({ ...current, text: `Version ${index}` }, 'Before refresh', { now: at }), text: `Version ${index + 1}` };
  }
  assert.equal(current.history!.length, DRAFT_HISTORY_LIMIT);
  assert.equal(current.history![0].snapshot.text, 'Version 7');
  assert.equal(current.history!.at(-1)!.snapshot.text, 'Version 26');
  assert.equal(new Set(current.history!.map(item => item.id)).size, DRAFT_HISTORY_LIMIT);
  assert.ok(current.history!.every(item => !('history' in item.snapshot)));
});

test('restoring keeps current evidence and context while clearing all approval state', () => {
  const earlier = { ...draft(), title: 'Earlier title', text: 'Earlier wording', mode: 'Written by Maya' as const, status: 'approved' as const, approvedAt: at };
  const current = {
    ...checkpointDraft(earlier, 'Before context change', { now: at }),
    title: 'Current title', text: 'Current wording', questionId: 'current-question',
    productIds: ['daily-gel'], productRevisions: { 'daily-gel': 3 },
    sourceRefs: [{ page: 0, label: 'Current context', excerpt: 'Updated personal budget.' }],
    status: 'published' as const, publishedAt: at, cardId: 'public-card',
  };
  const restored = restoreDraftRevision(current, current.history![0].id, '2026-09-20T13:00:00.000Z');
  assert.equal(restored.title, earlier.title);
  assert.equal(restored.text, earlier.text);
  assert.deepEqual(restored.decision, earlier.decision);
  assert.notEqual(restored.decision, current.history![0].snapshot.decision);
  assert.equal(restored.mode, 'Written by Maya');
  assert.equal(restored.questionId, 'current-question');
  assert.deepEqual(restored.productIds, ['daily-gel']);
  assert.deepEqual(restored.productRevisions, { 'daily-gel': 3 });
  assert.deepEqual(restored.sourceRefs, current.sourceRefs);
  assert.equal(restored.history!.at(-1)!.snapshot.text, 'Current wording');
  assert.equal(restored.status, 'draft');
  for (const field of ['approvedAt', 'publishedAt', 'cardId'] as const) assert.equal(restored[field], undefined);
  assert.equal(restored.updatedAt, '2026-09-20T13:00:00.000Z');
  assert.equal(current.status, 'published');
});

test('a missing revision fails without changing the draft', () => {
  const current = draft();
  const before = JSON.stringify(current);
  assert.throws(() => restoreDraftRevision(current, 'missing'), /no longer available/);
  assert.equal(JSON.stringify(current), before);
});

test('rapid typing shares a checkpoint and a later editing session saves the completed wording', () => {
  const initial = draft();
  const first = recordDraftRevision(initial, { ...initial, text: 'A', updatedAt: '2026-09-20T12:00:01.000Z' }, 'Edited answer', { coalesce: true, now: '2026-09-20T12:00:01.000Z' });
  const second = recordDraftRevision(first, { ...first, text: 'AB', updatedAt: '2026-09-20T12:00:03.000Z' }, 'Edited answer', { coalesce: true, now: '2026-09-20T12:00:03.000Z' });
  assert.equal(second.history!.length, 1);
  assert.equal(second.history![0].snapshot.text, initial.text);
  const later = recordDraftRevision(second, { ...second, text: 'Another edit', updatedAt: '2026-09-20T12:02:00.000Z' }, 'Edited answer', { coalesce: true, now: '2026-09-20T12:02:00.000Z' });
  assert.equal(later.history!.length, 2);
  assert.equal(later.history!.at(-1)!.snapshot.text, 'AB');
});

test('an evidence change preserves the outgoing draft even during an editing session', () => {
  const initial = draft();
  const edited = recordDraftRevision(initial, { ...initial, text: 'Keep my revised wording.', updatedAt: at }, 'Edited answer', { coalesce: true, now: at });
  const changed = recordDraftRevision(edited, { ...edited, productRevisions: { 'cloud-cream': 2 }, status: 'draft' }, 'Updated product evidence', { now: at });
  assert.equal(changed.history!.length, 2);
  assert.equal(changed.history!.at(-1)!.snapshot.text, 'Keep my revised wording.');
  assert.equal(changed.history!.at(-1)!.snapshot.productRevisions['cloud-cream'], 1);
});

test('approval-only changes do not create revisions and central recording does not double-save restore', () => {
  const initial = draft();
  const approved = recordDraftRevision(initial, { ...initial, status: 'approved', approvedAt: at }, 'Approved locally');
  assert.equal(approved.history, undefined);
  const edited = recordDraftRevision(approved, { ...approved, text: 'Edited answer', status: 'draft', approvedAt: undefined }, 'Edited answer', { now: at });
  const restored = restoreDraftRevision(edited, edited.history![0].id, at);
  const final = recordDraftRevision(edited, restored, 'Restored wording', { now: at });
  assert.equal(final.history!.length, 2);
  assert.equal(final.status, 'draft');
});

test('evidence invalidation retains a reviewed version even when its wording is unchanged', () => {
  const approved = { ...draft(), status: 'approved' as const, approvedAt: at };
  const invalidated = recordDraftRevision(approved, { ...approved, status: 'draft', approvedAt: undefined }, 'Product evidence changed', { now: at });
  assert.equal(invalidated.history!.length, 1);
  assert.equal(invalidated.history![0].snapshot.status, 'approved');
  assert.equal(invalidated.history![0].snapshot.text, approved.text);
  assert.equal(invalidated.status, 'draft');
});

test('typing after approval starts a checkpoint even within the edit grouping window', () => {
  const initial = draft();
  const typed = recordDraftRevision(initial, { ...initial, text: 'The exact wording Maya approves.', updatedAt: '2026-09-20T12:00:01.000Z' }, 'Edited answer', { coalesce: true, now: '2026-09-20T12:00:01.000Z' });
  const approved = recordDraftRevision(typed, { ...typed, status: 'approved', approvedAt: '2026-09-20T12:00:02.000Z', updatedAt: '2026-09-20T12:00:02.000Z' }, 'Approved locally');
  const editedAgain = recordDraftRevision(approved, { ...approved, text: 'A later adjustment.', status: 'draft', approvedAt: undefined, updatedAt: '2026-09-20T12:00:03.000Z' }, 'Edited answer', { coalesce: true, now: '2026-09-20T12:00:03.000Z' });
  assert.equal(editedAgain.history!.length, 2);
  assert.equal(editedAgain.history!.at(-1)!.snapshot.text, 'The exact wording Maya approves.');
  assert.equal(editedAgain.history!.at(-1)!.snapshot.status, 'approved');
  assert.equal(editedAgain.history!.at(-1)!.snapshot.approvedAt, '2026-09-20T12:00:02.000Z');
});

test('keep wording refreshes evidence but retains all four wording fields for review', () => {
  const current = { ...draft(), title: 'My title', text: 'My answer', mode: 'Written by Maya' as const };
  const suggested = { ...draft(), title: 'Suggested title', text: 'Suggested answer', productRevisions: { 'cloud-cream': 8 }, sourceRefs: [{ page: 0, label: 'Fresh evidence', excerpt: 'Updated price.' }] };
  const refreshed = refreshDraftWithHistory(current, suggested, true, at);
  assert.equal(refreshed.id, current.id);
  assert.equal(refreshed.title, current.title);
  assert.equal(refreshed.text, current.text);
  assert.equal(refreshed.mode, current.mode);
  assert.deepEqual(refreshed.decision, current.decision);
  assert.deepEqual(refreshed.productRevisions, suggested.productRevisions);
  assert.deepEqual(refreshed.sourceRefs, suggested.sourceRefs);
  assert.equal(refreshed.history!.length, 1);
  assert.equal(refreshed.status, 'draft');
});
