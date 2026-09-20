import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer, validateDraft } from '../src/lib/engine';
import { commitPublication, createPublicationPreview } from '../src/lib/publication';
import { decodeAdvice } from '../src/lib/share';

function fixture() {
  const workspace = createWorkspace();
  const draft = { ...draftAnswer(workspace.questions.find(q => q.id === 'q-04')!, workspace.products), status: 'approved' as const };
  workspace.drafts = [draft];
  return { workspace, draft };
}

test('editor-valid Unicode content that exceeds the public token limit cannot be published', () => {
  const { workspace, draft } = fixture();
  draft.text = '雲'.repeat(5500);
  assert.deepEqual(validateDraft(draft, workspace), []);
  assert.throws(() => createPublicationPreview(draft, workspace), /too long to share/);
  let saves = 0;
  const result = commitPublication(workspace, draft.id, () => { saves++; return true; });
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : '', /Shorten the answer/);
  assert.equal(saves, 0);
  assert.equal(workspace.drafts[0].status, 'approved');
});

test('shortened content publishes only after saving the same decodable snapshot', () => {
  const { workspace, draft } = fixture();
  draft.text = 'Cloud Cream is £38. Keep your current moisturiser if it works for you.';
  const before = JSON.stringify(workspace);
  let persisted = '';
  const result = commitPublication(workspace, draft.id, next => { persisted = JSON.stringify(next); return true; }, '2026-09-20T12:00:00.000Z');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(persisted, JSON.stringify(result.workspace));
  assert.deepEqual(decodeAdvice(result.token), result.advice);
  assert.equal(result.workspace.drafts[0].status, 'published');
  assert.equal(result.advice.publishedAt, result.workspace.drafts[0].publishedAt);
  assert.equal(JSON.stringify(workspace), before);
});

test('failed or throwing persistence leaves the approved workspace unchanged', () => {
  for (const persist of [() => false, () => { throw new Error('Quota'); }]) {
    const { workspace, draft } = fixture();
    const before = JSON.stringify(workspace);
    const result = commitPublication(workspace, draft.id, persist);
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.error : '', /Publication was not saved/);
    assert.equal(JSON.stringify(workspace), before);
  }
});

test('unapproved answers and changed evidence cannot reach persistence', () => {
  const { workspace, draft } = fixture();
  let saves = 0;
  const persist = () => { saves++; return true; };
  workspace.drafts[0] = { ...draft, status: 'draft' };
  assert.equal(commitPublication(workspace, draft.id, persist).ok, false);
  workspace.drafts[0] = draft;
  workspace.products.find(p => p.id === 'cloud-cream')!.revision++;
  assert.equal(commitPublication(workspace, draft.id, persist).ok, false);
  assert.equal(saves, 0);
});
