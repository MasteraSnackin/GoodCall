import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { createWorkspace } from '../../src/lib/seed';
import { draftAnswer, groupQuestion, validateDraft } from '../../src/lib/engine';
import { findReusableAnswers } from '../../src/lib/decisionReuse';
import { validateWorkspace, parseWorkspaceBackup } from '../../src/lib/workspaceValidation';
import { fixture } from './decision-reuse';

function measure(fn: () => unknown) {
  for (let i = 0; i < 10; i++) fn();
  const begin = performance.now(); fn();
  const iterations = Math.max(1, Math.min(500, Math.ceil(10 / Math.max(performance.now() - begin, 0.02))));
  const samples = Array.from({ length: 11 }, () => {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    return (performance.now() - start) / iterations;
  }).sort((a, b) => a - b);
  return { medianMs: Number(samples[5].toFixed(4)), p90Ms: Number(samples[9].toFixed(4)), iterationsPerSample: iterations };
}

const seed = createWorkspace();
const cases = [{ label: 'unaltered seed', workspace: seed, target: seed.questions[3] }, ...[120, 1_200, 2_400].map(count => ({ label: `${count} synthetic questions, all matching topics`, ...fixture(count, false) }))];
const results = cases.map(({ label, workspace, target }) => {
  const draft = draftAnswer(target, workspace.products);
  const raw = JSON.stringify(workspace);
  return {
    label, questions: workspace.questions.length, drafts: workspace.drafts.length, bytes: Buffer.byteLength(raw),
    groupAllQuestions: measure(() => workspace.questions.map(q => groupQuestion(q.text))),
    draftOneAnswer: measure(() => draftAnswer(target, workspace.products)),
    validateOneAnswer: measure(() => validateDraft(draft, workspace)),
    retrieveReusableAnswers: measure(() => findReusableAnswers(target, workspace)),
    validateWholeWorkspace: measure(() => validateWorkspace(workspace)),
    serialiseWholeWorkspace: measure(() => JSON.stringify(workspace)),
    parseAndValidateBackup: measure(() => parseWorkspaceBackup(raw)),
    pendingQuestionLookup: measure(() => workspace.questions.filter(q => !workspace.drafts.some(d => d.questionId === q.id))),
  };
});
console.log(JSON.stringify({ timestamp: new Date().toISOString(), node: process.version, platform: `${process.platform}/${process.arch}`, cpu: cpus()[0]?.model, warmupCalls: 10, samples: 11, note: 'Isolated Node logic timings; no DOM, React rendering, localStorage device IO or network. Fixtures are under the existing 5 MB limit.', results }, null, 2));
