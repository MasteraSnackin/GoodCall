import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftAnswer, validateDraft } from '../src/lib/engine';
import { deriveEvidenceReadiness } from '../src/lib/evidenceReadiness';
import { createWorkspace } from '../src/lib/seed';

test('readiness is a pure current check, separate from approval and unrelated report issues', () => {
  const workspace = createWorkspace(), draft = draftAnswer(workspace.questions[3], workspace.products);
  const before = JSON.stringify({ workspace, draft });
  const result = deriveEvidenceReadiness(draft, workspace);
  assert.equal(result.state, 'ready');
  assert.equal(result.label, 'Ready for review');
  assert.deepEqual(result.blockers, []);
  assert.equal(draft.status, 'draft');
  assert.ok(workspace.issues.some(issue => issue.status === 'Open'));
  assert.equal(JSON.stringify({ workspace, draft }), before);
  for (const status of ['approved', 'published'] as const) {
    assert.equal(deriveEvidenceReadiness({ ...draft, status }, workspace).label, 'Checks passed');
  }
});

test('blocked readiness exposes all validator messages without reducing them to a generic issue', () => {
  const workspace = createWorkspace(), draft = draftAnswer(workspace.questions[1], workspace.products);
  draft.text += ' It cures eczema.';
  const result = deriveEvidenceReadiness(draft, workspace);
  assert.equal(result.state, 'blocked');
  assert.equal(result.label, `Checks needed · ${result.blockers.length}`);
  assert.deepEqual(result.blockers, validateDraft(draft, workspace));
  assert.ok(result.blockers.some(message => message.includes('£70') && message.includes('£60')));
  assert.ok(result.blockers.some(message => message.includes('clinical claim')));
});

test('product revision changes are explicit even when other checks also fail', () => {
  const workspace = createWorkspace(), draft = draftAnswer(workspace.questions[3], workspace.products);
  workspace.products[0] = { ...workspace.products[0], revision: 2, price: 39, source: { page: 0, label: 'Updated record', excerpt: 'New evidence in full.' } };
  draft.title = '';
  const result = deriveEvidenceReadiness(draft, workspace);
  assert.equal(result.state, 'changed');
  assert.equal(result.label, 'Evidence changed');
  assert.deepEqual(result.changedProducts, [{ id: 'cloud-cream', name: 'Cloud Cream', draftRevision: 1, currentRevision: 2, source: workspace.products[0].source }]);
  assert.deepEqual(result.blockers, validateDraft(draft, workspace));
  assert.ok(result.blockers.includes('Add a title before approval.'));
  assert.equal(result.sources.find(source => source.label.includes('E-04.1'))?.page, 8);
});

test('missing records remain separate blockers alongside changed evidence', () => {
  const workspace = createWorkspace(), draft = draftAnswer(workspace.questions[3], workspace.products);
  draft.productIds.push('missing-product', 'missing-product');
  workspace.products[0].revision++;
  const result = deriveEvidenceReadiness(draft, workspace);
  assert.equal(result.state, 'changed');
  assert.deepEqual(result.missingProductIds, ['missing-product']);
  assert.ok(result.blockers.some(message => message.includes('missing-product') && message.includes('not in the catalogue')));
  workspace.products = workspace.products.filter(product => product.id !== 'cloud-cream');
  const missing = deriveEvidenceReadiness(draft, workspace);
  assert.equal(missing.state, 'blocked');
  assert.equal(missing.changedProducts.length, 0);
  assert.deepEqual(missing.missingProductIds, ['cloud-cream', 'missing-product']);
});

test('approved and published answers show new stale errors without changing their status', () => {
  for (const status of ['approved', 'published'] as const) {
    const workspace = createWorkspace(), draft = { ...draftAnswer(workspace.questions[3], workspace.products), status };
    workspace.products[0].revision++;
    const result = deriveEvidenceReadiness(draft, workspace);
    assert.equal(result.state, 'changed');
    assert.ok(result.blockers.length > 0);
    assert.equal(draft.status, status);
  }
});

test('resolved reports cannot clear missing Barrier Cream support', () => {
  const workspace = createWorkspace(), draft = draftAnswer(workspace.questions[4], workspace.products);
  const before = deriveEvidenceReadiness(draft, workspace);
  workspace.issues.forEach(issue => { issue.status = 'Resolved'; });
  const after = deriveEvidenceReadiness(draft, workspace);
  assert.deepEqual(after.blockers, before.blockers);
  assert.equal(after.state, 'blocked');
  assert.ok(after.blockers.some(message => message.includes('Barrier Cream')));
});

test('full references retain differing excerpts and do not mutate the saved evidence', () => {
  const workspace = createWorkspace(), draft = draftAnswer(workspace.questions[3], workspace.products);
  const first = draft.sourceRefs[0];
  draft.sourceRefs.push({ ...first }, { ...first, excerpt: 'A different\ncomplete excerpt.' });
  const result = deriveEvidenceReadiness(draft, workspace);
  assert.equal(result.sources.filter(source => source.label === first.label).length, 2);
  assert.equal(result.sources.at(-1)?.excerpt, 'A different\ncomplete excerpt.');
  result.sources[0].excerpt = 'changed returned copy';
  assert.equal(draft.sourceRefs[0].excerpt, first.excerpt);
});

test('question and answer edits are rechecked immediately without a cached readiness status', () => {
  const workspace = createWorkspace(), draft = draftAnswer(workspace.questions[3], workspace.products);
  assert.equal(deriveEvidenceReadiness(draft, workspace).state, 'ready');
  workspace.questions[3].text = 'Cloud Cream costs £38, but my budget is £30.';
  assert.equal(deriveEvidenceReadiness(draft, workspace).state, 'blocked');
  workspace.questions[3].text = 'Is Cloud Cream worth £38?';
  assert.equal(deriveEvidenceReadiness(draft, workspace).state, 'ready');
  draft.text += ' It cures eczema.';
  assert.equal(deriveEvidenceReadiness(draft, workspace).state, 'blocked');
});
