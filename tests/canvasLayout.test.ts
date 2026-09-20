import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Workspace } from '../src/lib/types';
import { alignCanvasItems, applyCanvasLayout, applyLayoutChange, createLayoutChange, readCanvasLayout } from '../src/lib/canvasLayout';
import type { LayoutBox } from '../src/lib/canvasLayout';

function workspace(): Workspace {
  return {
    version: 1,
    questions: [{ id: 'question', handle: '@reader', text: 'Is this suitable?', intent: 'Missing context', source: { page: 2, label: 'Question', excerpt: 'Original question' }, productIds: ['product'] }],
    products: [{ id: 'product', name: 'Cloud Cream', price: 20, type: 'Cream', skin: 'Dry', finish: 'Natural', score: 4, note: 'Evidence wording', source: { page: 3, label: 'Product evidence', excerpt: 'Original evidence' }, revision: 3 }],
    issues: [],
    drafts: [{ id: 'draft', questionId: 'question', title: 'Reviewed answer', text: 'Approved answer text', productIds: ['product'], sourceRefs: [{ page: 3, label: 'Product evidence', excerpt: 'Original evidence' }], productRevisions: { product: 3 }, status: 'approved', mode: 'Written by Maya', createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z', approvedAt: '2026-09-20T10:01:00.000Z' }],
    cards: [{ id: 'answer-card', kind: 'draft', entityId: 'draft', x: 10, y: 20 }, { id: 'evidence-card', kind: 'product', entityId: 'product', x: 300, y: 50, locked: true }],
    reviewNotes: [{ id: 'review-note', text: 'Private review wording', x: 500, y: 80, createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z' }],
    links: [{ id: 'evidence-link', source: 'evidence-card', target: 'answer-card', evidenceOrigin: 'manual' }],
    activity: [{ id: 'approved', text: 'Answer approved', at: '2026-09-20T10:01:00.000Z' }],
  };
}

test('layout snapshots contain only positions and effective locks for cards and review notes', () => {
  const board = workspace();
  assert.deepEqual(readCanvasLayout(board), [
    { id: 'answer-card', x: 10, y: 20, locked: false },
    { id: 'evidence-card', x: 300, y: 50, locked: true },
    { id: 'review-note', x: 500, y: 80, locked: false },
  ]);
  const snapshot = readCanvasLayout(board);
  snapshot[0].x = 999;
  assert.equal(board.cards[0].x, 10);
  delete board.reviewNotes;
  assert.equal(readCanvasLayout(board).length, 2);
});

test('a mixed card and review-note move preserves answer text, approval, evidence, links and note timestamps', () => {
  const board = workspace();
  const original = structuredClone(board);
  const moved = applyCanvasLayout(board, [{ id: 'answer-card', x: 40, y: 60 }, { id: 'review-note', x: 530, y: 120 }]);
  assert.notEqual(moved, board);
  assert.deepEqual(board, original);
  for (const key of ['drafts', 'products', 'questions', 'issues', 'links', 'activity'] as const) assert.equal(moved[key], board[key]);
  assert.equal(moved.cards[1], board.cards[1]);
  assert.deepEqual(moved.reviewNotes?.[0], { ...board.reviewNotes![0], x: 530, y: 120 });
  assert.equal(moved.cards[0].entityId, 'draft');
  assert.equal(moved.drafts[0].status, 'approved');
  assert.equal(moved.drafts[0].approvedAt, original.drafts[0].approvedAt);
});

test('omitted locks are preserved and an explicit false unlocks without editing content', () => {
  const board = workspace();
  const moved = applyCanvasLayout(board, [{ id: 'evidence-card', x: 301, y: 50 }]);
  assert.equal(moved.cards[1].locked, true);
  const unlocked = applyCanvasLayout(moved, [{ id: 'evidence-card', x: 301, y: 50, locked: false }]);
  assert.equal(unlocked.cards[1].locked, false);
  assert.equal(unlocked.products, board.products);
  assert.equal(applyCanvasLayout(board, [{ id: 'answer-card', x: 10, y: 20, locked: false }]), board);
});

test('unknown IDs, unchanged positions and invalid coordinates are no-ops, with inclusive canvas bounds', () => {
  const board = workspace();
  for (const positions of [[], [{ id: 'absent', x: 0, y: 0 }], [{ id: 'answer-card', x: 10, y: 20 }],
    [{ id: 'answer-card', x: NaN, y: 0 }], [{ id: 'answer-card', x: 0, y: Infinity }],
    [{ id: 'answer-card', x: 10_000_001, y: 0 }], [{ id: 'review-note', x: 0, y: -10_000_001 }]]) {
    assert.equal(applyCanvasLayout(board, positions), board);
    assert.equal(createLayoutChange(board, positions), null);
  }
  const bounded = applyCanvasLayout(board, [{ id: 'answer-card', x: -10_000_000, y: 10_000_000 }]);
  assert.equal(bounded.cards[0].x, -10_000_000);
  assert.equal(bounded.cards[0].y, 10_000_000);
  const mixed = applyCanvasLayout(board, [{ id: 'answer-card', x: 40, y: 60 }, { id: 'review-note', x: Infinity, y: 0 }]);
  assert.equal(mixed.cards[0].x, 40);
  assert.equal(mixed.reviewNotes, board.reviewNotes);
});

test('one history change undoes and redoes a whole mixed group and omits unchanged items', () => {
  const board = workspace();
  const positions = [{ id: 'answer-card', x: 60, y: 70 }, { id: 'review-note', x: 550, y: 130 }, { id: 'evidence-card', x: 300, y: 50 }];
  const change = createLayoutChange(board, positions)!;
  assert.deepEqual(change.before.map(item => item.id), ['answer-card', 'review-note']);
  assert.deepEqual(change.after.map(item => item.id), ['answer-card', 'review-note']);
  const moved = applyCanvasLayout(board, positions);
  const undone = applyLayoutChange(moved, change, 'undo');
  assert.deepEqual(readCanvasLayout(undone), readCanvasLayout(board));
  const redone = applyLayoutChange(undone, change, 'redo');
  assert.deepEqual(readCanvasLayout(redone), readCanvasLayout(moved));
  assert.equal(redone.drafts, board.drafts);
  assert.equal(applyLayoutChange(redone, change, 'redo'), redone);
});

test('layout history restores explicit lock changes in both directions', () => {
  const board = workspace();
  const positions = [{ id: 'evidence-card', x: 300, y: 50, locked: false }, { id: 'review-note', x: 500, y: 80, locked: true }];
  const change = createLayoutChange(board, positions)!;
  const unlocked = applyCanvasLayout(board, positions);
  const undone = applyLayoutChange(unlocked, change, 'undo');
  assert.equal(undone.cards[1].locked, true);
  assert.equal(Boolean(undone.reviewNotes![0].locked), false);
  assert.deepEqual(readCanvasLayout(applyLayoutChange(undone, change, 'redo')), readCanvasLayout(unlocked));
});

test('undo never restores deleted items or overwrites later external moves or lock changes', () => {
  const board = workspace();
  const positions = [{ id: 'answer-card', x: 60, y: 70 }, { id: 'evidence-card', x: 350, y: 100 }, { id: 'review-note', x: 550, y: 130 }];
  const change = createLayoutChange(board, positions)!;
  const moved = applyCanvasLayout(board, positions);
  const changed = applyCanvasLayout(moved, [{ id: 'answer-card', x: 999, y: 999 }]);
  changed.reviewNotes = [];
  const undone = applyLayoutChange(changed, change, 'undo');
  assert.equal(undone.cards[0].x, 999);
  assert.equal(undone.cards[1].x, 300);
  assert.deepEqual(undone.reviewNotes, []);
  const relocked = applyCanvasLayout(moved, [{ id: 'answer-card', x: 60, y: 70, locked: true }]);
  assert.equal(applyLayoutChange(relocked, change, 'undo').cards[0], relocked.cards[0]);
});

test('redo preserves edits made after undo, while replaying surviving matching items', () => {
  const board = workspace();
  const positions = [{ id: 'answer-card', x: 60, y: 70 }, { id: 'review-note', x: 550, y: 130 }];
  const change = createLayoutChange(board, positions)!;
  const undone = applyLayoutChange(applyCanvasLayout(board, positions), change, 'undo');
  const edited = { ...applyCanvasLayout(undone, [{ id: 'answer-card', x: 777, y: 20 }]), reviewNotes: undone.reviewNotes!.map(note => ({ ...note, text: 'New review text', updatedAt: '2026-09-20T12:00:00.000Z' })) };
  const redone = applyLayoutChange(edited, change, 'redo');
  assert.equal(redone.cards[0].x, 777);
  assert.equal(redone.reviewNotes![0].x, 550);
  assert.equal(redone.reviewNotes![0].text, 'New review text');
  assert.equal(redone.reviewNotes![0].updatedAt, '2026-09-20T12:00:00.000Z');
});

const box = (id: string, x: number, y: number, width: number, height: number, locked = false): LayoutBox => ({ id, x, y, width, height, locked });

test('left and top alignment excludes locked items from both targets and updates', () => {
  const boxes = [box('a', 50, 40, 100, 80), box('b', 200, 10, 60, 50), box('locked', -300, -200, 40, 40, true)];
  const before = structuredClone(boxes);
  assert.deepEqual(alignCanvasItems(boxes, 'left'), [{ id: 'a', x: 50, y: 40, locked: false }, { id: 'b', x: 50, y: 10, locked: false }]);
  assert.deepEqual(alignCanvasItems(boxes, 'top'), [{ id: 'a', x: 50, y: 10, locked: false }, { id: 'b', x: 200, y: 10, locked: false }]);
  assert.deepEqual(boxes, before);
  assert.deepEqual(alignCanvasItems([boxes[0], boxes[2]], 'left'), []);
  assert.deepEqual(alignCanvasItems(boxes, 'horizontal'), []);
});

test('horizontal distribution uses measured widths to create equal edge-to-edge gaps', () => {
  const boxes = [box('c', 600, 60, 120, 70), box('a', 0, 10, 100, 80), box('b', 160, 30, 200, 90), box('locked', -500, 0, 30, 30, true)];
  const result = alignCanvasItems(boxes, 'horizontal');
  assert.deepEqual(result, [{ id: 'a', x: 0, y: 10, locked: false }, { id: 'b', x: 250, y: 30, locked: false }, { id: 'c', x: 600, y: 60, locked: false }]);
  assert.equal(result[1].x - (result[0].x + 100), result[2].x - (result[1].x + 200));
});

test('vertical distribution uses measured heights and extends overlapping groups to a zero gap', () => {
  const boxes = [box('a', 10, -50, 100, 100), box('b', 30, 0, 200, 150), box('c', 60, 20, 120, 80)];
  assert.deepEqual(alignCanvasItems(boxes, 'vertical'), [{ id: 'a', x: 10, y: -50, locked: false }, { id: 'b', x: 30, y: 50, locked: false }, { id: 'c', x: 60, y: 200, locked: false }]);
  const separated = [box('a', 10, 0, 100, 80), box('b', 30, 100, 200, 160), box('c', 60, 500, 120, 60)];
  assert.deepEqual(alignCanvasItems(separated, 'vertical').map(item => item.y), [0, 210, 500]);
});

test('distribution uses the complete outer extent when an earlier item is widest', () => {
  const boxes = [box('a', 0, 0, 1000, 20), box('b', 100, 0, 10, 20), box('c', 200, 0, 10, 20)];
  assert.deepEqual(alignCanvasItems(boxes, 'horizontal').map(item => item.x), [0, 1000, 1010]);
});

test('distribution rejects out-of-bounds group output and excludes invalid measurements', () => {
  assert.deepEqual(alignCanvasItems([box('a', 9_999_990, 0, 20, 20), box('b', 9_999_991, 0, 20, 20), box('c', 9_999_992, 0, 20, 20)], 'horizontal'), []);
  assert.deepEqual(alignCanvasItems([box('a', 0, 0, 20, 20), box('b', 50, 0, NaN, 20), box('c', 100, 0, 20, 20)], 'horizontal'), []);
});
