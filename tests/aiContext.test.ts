import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, mayaNotes } from '../src/lib/seed';
import { aiEvidenceFingerprint, aiSourceRefs, applyAiDraft, buildAiRequest, validateAiChat } from '../src/lib/aiContext';
import { draftAnswer, toPublishedAdvice, validateDraft } from '../src/lib/engine';
import { findCaseEvidence } from '../src/lib/caseEvidence';
import type { AiResponse } from '../src/lib/aiTypes';
import type { ChatMessage } from '../src/lib/chat';
import { validateWorkspace } from '../src/lib/workspaceValidation';

const response = (changes: Partial<AiResponse['answer']> = {}): AiResponse => ({
  provider: 'openai', model: 'test-model', generatedAt: '2026-09-20T12:00:00.000Z',
  answer: {
    kind: 'answer', title: 'Cloud Cream: a useful choice for the right routine', text: 'Cloud Cream costs £38. Its recorded finish is rich. Keep your current moisturiser if it already does the job.',
    productIds: ['cloud-cream'], sourceIds: ['product:cloud-cream', 'note:maya-judgement'], missingEvidence: [],
    decision: { verdict: 'Consider', suits: 'Someone looking for the recorded rich finish.', skipIf: 'Your current moisturiser already does the job.', unknowns: 'Check your existing routine and preferred finish.' }, ...changes,
  },
});

test('AI context includes the catalogue and bounded chat text without leaking unrelated followers or internal state', () => {
  const w = createWorkspace();
  w.questions[0].handle = '@private_person'; w.questions[0].text = 'UNRELATED_PRIVATE_QUESTION';
  w.activity.push({ id: 'hidden-event', at: '', text: 'PRIVATE_ACTIVITY' });
  const draft = draftAnswer(w.questions[3], w.products); draft.text = 'PRIVATE_UNSELECTED_DRAFT'; w.drafts.push(draft);
  const history: ChatMessage[] = Array.from({ length: 9 }, (_, index) => ({ id: `message-${index}`, role: index % 2 ? 'assistant' : 'user', text: `History ${index} @private_handle`, createdAt: 'PRIVATE_TIMESTAMP', sourceRefs: [{ page: 5, label: 'PRIVATE_HISTORY_SOURCE', excerpt: 'private source' }] }));
  const request = buildAiRequest('chat', 'Is Cloud Cream worth £38?', w, history);
  const json = JSON.stringify(request);
  assert.equal(request.evidence.filter(item => item.kind === 'product').length, w.products.length);
  assert.equal(request.history.length, 6);
  assert.ok(request.evidence.some(item => item.id === 'note:maya-judgement'));
  assert.ok(!/private_person|private_handle|UNRELATED_PRIVATE_QUESTION|PRIVATE_ACTIVITY|PRIVATE_UNSELECTED_DRAFT|PRIVATE_HISTORY_SOURCE|PRIVATE_TIMESTAMP/.test(json));
  assert.deepEqual(Object.keys(request.history[0]).sort(), ['role', 'text']);
  assert.equal(buildAiRequest('draft', w.questions[3].text, w, history).history.length, 0);
});

test('AI source references use canonical excerpts rather than enriched catalogue descriptions', () => {
  const w = createWorkspace(), request = buildAiRequest('draft', w.questions[3].text, w);
  assert.match(request.evidence.find(item => item.id === 'product:cloud-cream')!.text, /Price: £38.*|Finish: Rich/);
  const refs = aiSourceRefs(response(), request);
  assert.deepEqual(refs.find(item => item.label === w.products[0].source.label), w.products[0].source);
  assert.deepEqual(refs.find(item => item.label === mayaNotes[3].source.label), mayaNotes[3].source);
});

test('AI results cannot cite unknown evidence, invent product IDs or omit a product source', () => {
  const w = createWorkspace(), q = w.questions[3], request = buildAiRequest('draft', q.text, w);
  assert.throws(() => aiSourceRefs(response({ sourceIds: ['invented:source'] }), request), /not supplied/);
  assert.throws(() => applyAiDraft(response({ productIds: ['unknown-product'] }), q, w, request), /unknown product/);
  assert.throws(() => applyAiDraft(response({ sourceIds: ['note:maya-judgement'] }), q, w, request), /catalogue source/);
});

test('an AI suggestion pins current revisions and always starts unapproved with no publication metadata', () => {
  const w = createWorkspace(), q = w.questions[3], request = buildAiRequest('draft', q.text, w);
  const before = JSON.stringify(w), draft = applyAiDraft(response(), q, w, request);
  assert.equal(draft.mode, 'AI suggestion'); assert.equal(draft.status, 'draft');
  assert.equal(draft.productRevisions['cloud-cream'], w.products[0].revision);
  assert.equal(draft.ai?.model, 'test-model'); assert.deepEqual(draft.ai?.missingEvidence, []);
  assert.equal(draft.approvedAt, undefined); assert.equal(draft.publishedAt, undefined);
  assert.deepEqual(validateDraft(draft, w), []); assert.throws(() => toPublishedAdvice(draft, w), /approve/);
  assert.equal(JSON.stringify(w), before);
});

test('fingerprints ignore canvas position but change with current evidence, question or selected case context', () => {
  const w = createWorkspace(), text = w.questions[3].text, initial = aiEvidenceFingerprint(w, text);
  w.cards[0].x += 200; assert.equal(aiEvidenceFingerprint(w, text), initial);
  w.products[0].price += 1; assert.notEqual(aiEvidenceFingerprint(w, text), initial);
  assert.notEqual(aiEvidenceFingerprint(w, `${text} My budget is £20.`), aiEvidenceFingerprint(w, text));
  assert.notEqual(aiEvidenceFingerprint(w, text, { id: 'case-card', kind: 'evidence', entityId: 'case-quiet-audience-findings', x: 0, y: 0 }), aiEvidenceFingerprint(w, text));
});

test('stale product records and edited questions reject a pending response', () => {
  const w = createWorkspace(), q = w.questions[3], request = buildAiRequest('draft', q.text, w);
  w.products[0].revision += 1;
  assert.throws(() => applyAiDraft(response(), q, w, request), /evidence changed/);
  w.products[0].revision -= 1;
  assert.throws(() => applyAiDraft(response(), { ...q, text: `${q.text} My budget is £20.` }, w, request), /question changed/);
});

test('existing budget and missing-product holds survive a confident AI answer', () => {
  const w = createWorkspace(), budgetQuestion = w.questions[1];
  const draft = applyAiDraft(response(), budgetQuestion, w, buildAiRequest('draft', budgetQuestion.text, w));
  assert.equal(draft.decision?.verdict, 'Need more context');
  assert.ok(draft.ai?.missingEvidence.some(item => item.includes('£70') && item.includes('£60')));
  const missing = w.questions[4], missingDraft = applyAiDraft(response(), missing, w, buildAiRequest('draft', missing.text, w));
  assert.ok(missingDraft.ai?.missingEvidence.some(item => item.includes('Barrier Cream')));
  assert.ok(validateDraft(missingDraft, w).length > 0);
});

test('model clarification and explicit missing evidence cannot produce an approvable decision', () => {
  const w = createWorkspace(), q = w.questions[3], request = buildAiRequest('draft', q.text, w);
  for (const result of [response({ kind: 'clarification' }), response({ missingEvidence: ['The follower’s current moisturiser is unknown.'] })]) {
    const draft = applyAiDraft(result, q, w, request);
    assert.equal(draft.decision?.verdict, 'Need more context'); assert.ok(draft.ai!.missingEvidence.length > 0);
    assert.ok(validateDraft(draft, w).length > 0);
  }
});

test('chat rejects unsupported prices and clinical claims instead of presenting them as answers', () => {
  const w = createWorkspace(), request = buildAiRequest('chat', 'Is Cloud Cream worth £38?', w);
  assert.equal(validateAiChat(response(), request, w).kind, 'answer');
  const price = validateAiChat(response({ text: 'Cloud Cream costs £20.' }), request, w);
  assert.equal(price.kind, 'clarification'); assert.match(price.text, /price|£20|£38/i);
  const clinical = validateAiChat(response({ text: 'Cloud Cream is safe for sensitive skin and cures eczema.' }), request, w);
  assert.equal(clinical.kind, 'clarification'); assert.ok(!clinical.text.includes('Cloud Cream is safe'));
});

test('chat retains a prior explicit budget when the user asks about an alternative', () => {
  const w = createWorkspace();
  const history: ChatMessage[] = [{ id: 'earlier', role: 'user', text: 'My budget is £20. Is Cloud Cream worth it?', createdAt: '' }];
  const request = buildAiRequest('chat', 'What about Daily Gel?', w, history);
  const result = validateAiChat(response({ title: 'Daily Gel', text: 'Daily Gel costs £24.', productIds: ['daily-gel'], sourceIds: ['product:daily-gel'] }), request, w);
  assert.equal(result.kind, 'clarification'); assert.match(result.text, /£20/);
});

test('selected case explanations include the supplied caveat and cannot establish product safety', () => {
  const w = createWorkspace(), selected = { id: 'case-card', kind: 'evidence' as const, entityId: 'case-quiet-audience-findings', x: 0, y: 0 };
  const request = buildAiRequest('chat', 'Explain this evidence.', w, [], selected);
  const result = response({ title: 'Quiet audience', text: 'The file reports that some valuable followers save, share and return later.', productIds: [], sourceIds: ['case:case-quiet-audience-findings'] });
  const answer = validateAiChat(result, request, w);
  assert.equal(answer.kind, 'answer'); assert.ok(answer.text.includes(findCaseEvidence(selected.entityId)!.caveat!));
  result.answer.text = 'This proves it is safe for pregnancy.';
  assert.equal(validateAiChat(result, request, w).kind, 'clarification');
  const safetyRequest = buildAiRequest('chat', 'Does this mean I can use it during pregnancy?', w, [], selected);
  result.answer.text = 'Yes, go ahead.';
  assert.equal(validateAiChat(result, safetyRequest, w).kind, 'clarification');
});

test('current workspace product corrections keep their page-zero source and remain reviewable', () => {
  const w = createWorkspace(), q = w.questions[3];
  w.products[0].revision = 2;
  w.products[0].source = { page: 0, label: 'Maya’s verified catalogue correction', excerpt: 'Cloud Cream remains £38 with a rich finish.' };
  const request = buildAiRequest('draft', q.text, w), draft = applyAiDraft(response(), q, w, request);
  assert.deepEqual(aiSourceRefs(response(), request).find(source => source.page === 0), w.products[0].source);
  assert.ok(draft.sourceRefs.some(source => source.label === w.products[0].source.label));
  assert.deepEqual(validateDraft(draft, w), []);
  assert.equal(validateWorkspace({ ...w, drafts: [draft] }).ok, true);
});

test('combined model and local holds fit persistence limits without clearing omitted findings', () => {
  const w = createWorkspace(), q = w.questions[1], request = buildAiRequest('draft', q.text, w);
  const missingEvidence = Array.from({ length: 20 }, (_, index) => `Missing context ${index + 1}`);
  const draft = applyAiDraft(response({ missingEvidence }), q, w, request);
  assert.equal(draft.ai!.missingEvidence.length, 20);
  assert.ok(draft.ai!.missingEvidence.every(hold => hold.length <= 1000));
  assert.match(draft.ai!.missingEvidence[19], /additional evidence finding/);
  assert.equal(draft.decision!.verdict, 'Need more context');
  assert.equal(validateWorkspace({ ...w, drafts: [draft] }).ok, true);
  assert.ok(validateDraft(draft, w).some(hold => hold.includes('£70') && hold.includes('£60')));
});
