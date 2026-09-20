import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { createWorkspace } from '../../src/lib/seed';
import { draftAnswer, groupQuestion, validateDraft } from '../../src/lib/engine';
import { isDecisionProfile } from '../../src/lib/decisionTypes';
import { findReusableAnswers } from '../../src/lib/decisionReuse';
import { validateWorkspace } from '../../src/lib/workspaceValidation';
import type { Draft, Question, Workspace } from '../../src/lib/types';

// Frozen 20 September baseline: deliberately retains the old delimiter defect.
export function baseline(question: Question, workspace: Workspace): Draft[] {
  const keyOf = (ids: string[]) => [...new Set(ids)].sort().join('|');
  const resolved = draftAnswer(question, workspace.products).productIds;
  if (!resolved.length) return [];
  const key = keyOf(resolved), intent = groupQuestion(question.text);
  return workspace.drafts.filter(draft => {
    if (draft.questionId === question.id || !['approved', 'published'].includes(draft.status)) return false;
    if (!isDecisionProfile(draft.decision) || keyOf(draft.productIds) !== key) return false;
    const original = workspace.questions.find(item => item.id === draft.questionId);
    if (!original || groupQuestion(original.text) !== intent) return false;
    return validateDraft(draft, workspace).length === 0;
  });
}

export function indexedCandidate(question: Question, workspace: Workspace): Draft[] {
  const keyOf = (ids: string[]) => JSON.stringify([...new Set(ids)].sort());
  const resolved = draftAnswer(question, workspace.products).productIds;
  if (!resolved.length) return [];
  const key = keyOf(resolved), intent = groupQuestion(question.text);
  let questions: Map<string, Question> | undefined;
  return workspace.drafts.filter(draft => {
    if (draft.questionId === question.id || !['approved', 'published'].includes(draft.status)) return false;
    if (!isDecisionProfile(draft.decision) || keyOf(draft.productIds) !== key) return false;
    if (!questions) {
      questions = new Map();
      for (const original of workspace.questions) if (!questions.has(original.id)) questions.set(original.id, original);
    }
    const original = questions.get(draft.questionId);
    if (!original || groupQuestion(original.text) !== intent) return false;
    return validateDraft(draft, workspace).length === 0;
  });
}

export function fixture(count: number, mixed: boolean): { workspace: Workspace; target: Question } {
  const workspace = createWorkspace();
  const questions: Question[] = Array.from({ length: count }, (_, i) => ({
    id: `benchmark-q-${i}`, handle: '@benchmark',
    text: mixed && i % 2 ? 'Would you recommend Cloud Cream?' : 'Is Cloud Cream worth buying?',
    intent: mixed && i % 2 ? 'Personal recommendation' : 'Product value', productIds: ['cloud-cream'],
    source: { page: 0, label: 'Synthetic benchmark question', excerpt: 'Synthetic fixture' },
  }));
  const target = questions[0];
  const template = draftAnswer(target, workspace.products);
  workspace.questions.push(...questions);
  workspace.drafts = questions.slice(1).map((question, i) => ({ ...template, id: `benchmark-d-${i}`, questionId: question.id, status: 'approved', approvedAt: '2026-09-20T00:00:00.000Z' }));
  assert.equal(validateWorkspace(workspace).ok, true);
  assert.ok(Buffer.byteLength(JSON.stringify(workspace)) < 5_000_000, 'Fixture must fit the supported backup limit');
  return { workspace, target };
}

export function collisionFixture(): { workspace: Workspace; target: Question } {
  const workspace = createWorkspace();
  const base = workspace.products[0];
  workspace.products = ['a|b', 'c', 'a', 'b|c'].map((id, i) => ({ ...base, id, name: `Benchmark Item ${i}`, source: { page: 8, label: `Synthetic product ${i}`, excerpt: 'Synthetic fixture' } }));
  const original: Question = { id: 'original', handle: '@benchmark', text: 'Are these worth buying?', intent: 'Product value', productIds: ['a|b', 'c'], source: { page: 0, label: 'Synthetic question', excerpt: 'Synthetic fixture' } };
  const target: Question = { ...original, id: 'target', productIds: ['a', 'b|c'] };
  workspace.questions = [original, target]; workspace.cards = []; workspace.links = []; workspace.issues = [];
  workspace.drafts = [{ ...draftAnswer(original, workspace.products), id: 'wrong-product-set', status: 'approved' }];
  assert.equal(validateWorkspace(workspace).ok, true);
  assert.deepEqual(validateDraft(workspace.drafts[0], workspace), []);
  return { workspace, target };
}

function time(fn: () => unknown, iterations: number) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return (performance.now() - start) / iterations;
}
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = (value: number) => Number(value.toFixed(4));
function compare(before: () => Draft[], after: () => Draft[]) {
  assert.deepEqual(after().map(d => d.id), before().map(d => d.id), 'Ordered candidate IDs must match');
  for (let i = 0; i < 10; i++) { before(); after(); }
  const iterations = Math.max(1, Math.min(500, Math.ceil(15 / Math.max(time(before, 2), 0.02))));
  const a: number[] = [], b: number[] = [];
  for (let i = 0; i < 11; i++) {
    if (i % 2) { b.push(time(after, iterations)); a.push(time(before, iterations)); }
    else { a.push(time(before, iterations)); b.push(time(after, iterations)); }
  }
  return { iterationsPerSample: iterations, samples: 11, beforeMs: round(median(a)), afterMs: round(median(b)), beforeP90Ms: round([...a].sort((x, y) => x - y)[9]), afterP90Ms: round([...b].sort((x, y) => x - y)[9]), speedup: round(median(a) / median(b)) };
}

if (process.argv[1]?.endsWith('decision-reuse.ts')) {
  const useRuntime = process.argv.includes('--runtime');
  const after = useRuntime ? findReusableAnswers : indexedCandidate;
  const collision = collisionFixture();
  assert.equal(baseline(collision.target, collision.workspace).length, 1, 'Old delimiter collision must reproduce');
  assert.equal(after(collision.target, collision.workspace).length, 0, 'New key must reject the collision');
  const results = [];
  for (const count of [12, 120, 1_200, 2_400]) for (const mixed of [false, true]) {
    const { workspace, target } = fixture(count, mixed);
    results.push({ questions: workspace.questions.length, drafts: workspace.drafts.length, scenario: mixed ? 'mixed topics' : 'all matching topics', bytes: Buffer.byteLength(JSON.stringify(workspace)), matches: after(target, workspace).length, ...compare(() => baseline(target, workspace), () => after(target, workspace)) });
  }
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), node: process.version, platform: `${process.platform}/${process.arch}`, cpu: cpus()[0]?.model, implementation: useRuntime ? 'runtime' : 'candidate', warmupCallsPerImplementation: 10, note: 'Node microbenchmark; not browser rendering or user-visible latency. Fixtures and correctness checks are outside timed loops.', collision: 'before returns unrelated draft; after rejects it', results }, null, 2));
}
