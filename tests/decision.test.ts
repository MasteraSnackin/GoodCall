import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer, groupQuestion, validateDraft } from '../src/lib/engine';
import { buildDecisionProfile } from '../src/lib/decisionProfile';
import { findReusableAnswers, reuseAnswer } from '../src/lib/decisionReuse';
import { isDecisionProfile } from '../src/lib/decisionTypes';
import type { Question, Workspace } from '../src/lib/types';

function addQuestion(workspace: Workspace, text = 'Is Cloud Cream worth buying for dry skin?', productIds = ['cloud-cream']): Question {
  const question: Question = { id: `q-new-${workspace.questions.length}`, handle: '@new-reader', text, productIds, intent: groupQuestion(text), source: { page: 0, label: 'Reviewed new question', excerpt: text } };
  workspace.questions.push(question);
  return question;
}

function reviewedCloud() {
  const workspace = createWorkspace();
  const source = draftAnswer(workspace.questions[3], workspace.products);
  source.decision = buildDecisionProfile(workspace.products.filter(product => source.productIds.includes(product.id)), []);
  source.status = 'approved';
  source.approvedAt = '2026-09-20T12:00:00.000Z';
  workspace.drafts.push(source);
  return { workspace, source };
}

test('suggested Cloud guidance preserves the keep-your-existing-moisturiser judgement without personal-fit claims', () => {
  const workspace = createWorkspace();
  const profile = buildDecisionProfile([workspace.products[0]], []);
  assert.equal(profile.verdict, 'Consider');
  assert.match(profile.suits, /catalogue skin category “Dry”/);
  assert.match(profile.skipIf, /current moisturiser already does the job: keep it/);
  assert.match(profile.unknowns, /Personal fit.*not been established/);
  assert.ok(isDecisionProfile(profile));
  const draft = draftAnswer(workspace.questions[3], workspace.products);
  draft.text += `\n${profile.suits}\n${profile.skipIf}\n${profile.unknowns}`;
  assert.deepEqual(validateDraft(draft, workspace), []);
});

test('Glass value verdict follows the current recorded price judgement', () => {
  const glass = createWorkspace().products.find(product => product.id === 'glass-drop')!;
  assert.equal(buildDecisionProfile([glass], []).verdict, 'Skip for now');
  assert.equal(buildDecisionProfile([{ ...glass, price: 50, note: 'Worth the revised price.' }], []).verdict, 'Consider');
});

test('unresolved checks produce a neutral, bounded need-more-context profile', () => {
  const product = createWorkspace().products[0];
  const profile = buildDecisionProfile([product], ['Does it contain ceramides?', 'Is it safe?']);
  assert.equal(profile.verdict, 'Need more context');
  assert.doesNotMatch(JSON.stringify(profile), /ceramides|safe|contain/);
  assert.match(profile.unknowns, /2 evidence or context gaps/);
  assert.ok(isDecisionProfile(profile));
  assert.equal(buildDecisionProfile([], []).verdict, 'Need more context');
  assert.ok(isDecisionProfile(buildDecisionProfile([{ ...product, name: 'x'.repeat(2000) }], [])));
});

test('a matching reviewed decision becomes an independent draft with fresh evidence and no approval state', () => {
  const { workspace, source } = reviewedCloud();
  source.status = 'published'; source.publishedAt = '2026-09-20T12:02:00.000Z'; source.cardId = 'public-existing';
  const question = addQuestion(workspace);
  assert.deepEqual(findReusableAnswers(question, workspace).map(item => item.id), [source.id]);
  const original = JSON.stringify(source);
  const draft = reuseAnswer(question, source, workspace);
  assert.notEqual(draft.id, source.id);
  assert.equal(draft.questionId, question.id);
  assert.equal(draft.text, source.text);
  assert.deepEqual(draft.decision, source.decision);
  assert.notEqual(draft.decision, source.decision);
  assert.equal(draft.status, 'draft');
  assert.equal(draft.approvedAt, undefined);
  assert.equal(draft.publishedAt, undefined);
  assert.equal(draft.cardId, undefined);
  assert.equal(draft.reusedFrom?.draftId, source.id);
  assert.deepEqual(validateDraft(draft, workspace), []);
  draft.decision!.suits = 'Edited only in this draft.';
  draft.text = 'Edited only in this draft.';
  assert.equal(JSON.stringify(source), original);
});

test('a matching topic remains held when the new question introduces budget or clinical constraints', () => {
  for (const text of ['Is Cloud Cream worth it if my budget is £30?', 'Is Cloud Cream worth it for sensitive skin?']) {
    const { workspace, source } = reviewedCloud();
    const question = addQuestion(workspace, text);
    assert.equal(findReusableAnswers(question, workspace).length, 1, text);
    const copy = reuseAnswer(question, source, workspace);
    assert.equal(copy.status, 'draft');
    assert.ok(validateDraft(copy, workspace).length > 0, text);
  }
});

test('reused drafts omit the former audience question and private references', () => {
  const { workspace, source } = reviewedCloud();
  source.sourceRefs.push({ page: 0, label: 'Private context', excerpt: 'old-private-detail' });
  const question = addQuestion(workspace);
  const copy = reuseAnswer(question, source, workspace);
  assert.ok(copy.sourceRefs.some(ref => ref === question.source));
  assert.ok(!copy.sourceRefs.some(ref => ref.label === workspace.questions[3].source.label));
  assert.doesNotMatch(JSON.stringify(copy.sourceRefs), /old-private-detail|@sarah/);
});

test('stale evidence, draft status and missing legacy decision profiles are excluded', () => {
  for (const change of ['stale', 'draft', 'legacy', 'invalid'] as const) {
    const { workspace, source } = reviewedCloud();
    const question = addQuestion(workspace);
    if (change === 'stale') workspace.products[0].revision += 1;
    if (change === 'draft') source.status = 'draft';
    if (change === 'legacy') delete source.decision;
    if (change === 'invalid') source.decision!.suits = '';
    assert.deepEqual(findReusableAnswers(question, workspace), [], change);
    assert.throws(() => reuseAnswer(question, source, workspace), /no longer an eligible/, change);
  }
});

test('reuse requires the same resolved products and question intent, with no self-reuse', () => {
  const { workspace, source } = reviewedCloud();
  assert.deepEqual(findReusableAnswers(workspace.questions[3], workspace), []);
  const noProduct = addQuestion(workspace, 'Is this worth it?', []);
  assert.deepEqual(findReusableAnswers(noProduct, workspace), []);
  const differentProduct = addQuestion(workspace, 'Is Daily Gel worth buying?', ['daily-gel']);
  assert.deepEqual(findReusableAnswers(differentProduct, workspace), []);
  const differentIntent = addQuestion(workspace, 'Would you recommend Cloud Cream?', ['cloud-cream']);
  assert.deepEqual(findReusableAnswers(differentIntent, workspace), []);
  const duplicateIds = addQuestion(workspace, 'Is Cloud Cream worth buying?', ['cloud-cream', 'cloud-cream']);
  assert.equal(findReusableAnswers(duplicateIds, workspace)[0].id, source.id);
});

test('passing a substituted source object cannot overwrite the reviewed workspace answer', () => {
  const { workspace, source } = reviewedCloud();
  const question = addQuestion(workspace);
  const copy = reuseAnswer(question, { ...source, text: 'Unreviewed substituted answer' }, workspace);
  assert.equal(copy.text, source.text);
  assert.throws(() => reuseAnswer(question, { ...source, id: 'not-in-workspace' }, workspace), /no longer an eligible/);
});
