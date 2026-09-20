import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer, validateDraft } from '../src/lib/engine';
import { findReusableAnswers, reuseAnswer } from '../src/lib/decisionReuse';
import { validateWorkspace } from '../src/lib/workspaceValidation';
import type { Draft, Question } from '../src/lib/types';

function fixture() {
  const workspace = createWorkspace();
  const base = workspace.products[0];
  workspace.products = ['a|b', 'c', 'a', 'b|c'].map((id, i) => ({ ...base, id, name: `Recorded Item ${i}`, source: { page: 8, label: `Product ${i}`, excerpt: 'Recorded product' } }));
  const original: Question = { id: 'original', handle: '@reader', text: 'Are these worth buying?', intent: 'Product value', productIds: ['a|b', 'c'], source: { page: 0, label: 'Question', excerpt: 'Are these worth buying?' } };
  const target: Question = { ...original, id: 'target', productIds: ['a', 'b|c'] };
  workspace.questions = [original, target]; workspace.cards = []; workspace.links = []; workspace.issues = [];
  const source: Draft = { ...draftAnswer(original, workspace.products), id: 'reviewed', status: 'approved' };
  workspace.drafts = [source];
  return { workspace, original, target, source };
}

test('distinct product sets containing delimiters never produce an unrelated reuse suggestion', () => {
  const { workspace, target, source } = fixture();
  assert.equal(validateWorkspace(workspace).ok, true);
  assert.deepEqual(validateDraft(source, workspace), []);
  assert.deepEqual(findReusableAnswers(target, workspace), []);
  assert.throws(() => reuseAnswer(target, source, workspace), /no longer an eligible/);
});

test('the same delimiter-containing IDs still match independently of input ordering', () => {
  const { workspace, target, source } = fixture();
  target.productIds = ['c', 'a|b'];
  assert.deepEqual(findReusableAnswers(target, workspace), [source]);
  target.productIds.push('c');
  assert.deepEqual(findReusableAnswers(target, workspace), [source]);
});

test('reuse lookup preserves first-question semantics for unvalidated duplicate IDs', () => {
  const { workspace, target, original, source } = fixture();
  target.productIds = [...original.productIds];
  const otherTopic = { ...original, text: 'Would you recommend these?', intent: 'Personal recommendation' as const };
  workspace.questions = [otherTopic, original, target];
  assert.deepEqual(findReusableAnswers(target, workspace), []);
  workspace.questions = [original, otherTopic, target];
  assert.deepEqual(findReusableAnswers(target, workspace), [source]);
});

test('later question edits and product revisions are rechecked without a stale index', () => {
  const { workspace, target, original, source } = fixture();
  target.productIds = [...original.productIds];
  assert.deepEqual(findReusableAnswers(target, workspace), [source]);
  original.text = 'Would you recommend these?';
  assert.deepEqual(findReusableAnswers(target, workspace), []);
  original.text = 'Are these worth buying?';
  assert.deepEqual(findReusableAnswers(target, workspace), [source]);
  workspace.products[0].revision += 1;
  assert.deepEqual(findReusableAnswers(target, workspace), []);
});

test('candidate ordering and original object identity are preserved', () => {
  const { workspace, target, original, source } = fixture();
  target.productIds = [...original.productIds];
  const second = { ...source, id: 'second' };
  workspace.drafts = [second, { ...source, id: 'unreviewed', status: 'draft' }, source];
  const found = findReusableAnswers(target, workspace);
  assert.equal(found[0], second);
  assert.equal(found[1], source);
  assert.equal(found.length, 2);
});

test('reusing an approved AI suggestion preserves independent provenance and starts unapproved', () => {
  const { workspace, target, original, source } = fixture();
  target.productIds = [...original.productIds];
  source.mode = 'AI suggestion';
  source.ai = { provider: 'openai', model: 'fixture-model', generatedAt: '2026-09-20T00:00:00.000Z', missingEvidence: [] };
  source.approvedAt = '2026-09-20T01:00:00.000Z';
  const copy = reuseAnswer(target, source, workspace);
  assert.equal(copy.mode, 'AI suggestion');
  assert.deepEqual(copy.ai, source.ai);
  assert.notEqual(copy.ai, source.ai);
  assert.notEqual(copy.ai!.missingEvidence, source.ai.missingEvidence);
  assert.equal(copy.status, 'draft');
  assert.equal(copy.approvedAt, undefined);
  assert.equal(copy.questionId, target.id);
  assert.deepEqual(validateDraft(copy, workspace), []);
  copy.ai!.missingEvidence.push('A new concern');
  assert.deepEqual(source.ai.missingEvidence, []);
});

test('an AI evidence flag keeps a previously reviewed candidate out of reuse', () => {
  const { workspace, target, original, source } = fixture();
  target.productIds = [...original.productIds];
  source.mode = 'AI suggestion';
  source.ai = { provider: 'openai', model: 'fixture-model', generatedAt: '2026-09-20T00:00:00.000Z', missingEvidence: ['The product evidence needs checking.'] };
  assert.deepEqual(findReusableAnswers(target, workspace), []);
  assert.throws(() => reuseAnswer(target, source, workspace), /no longer an eligible/);
});
