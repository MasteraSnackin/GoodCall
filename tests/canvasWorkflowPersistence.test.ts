import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAiRequest } from '../src/lib/aiContext';
import { draftAnswer, toPublishedAdvice } from '../src/lib/engine';
import { createWorkspace } from '../src/lib/seed';
import { loadWorkspace, saveWorkspace, WORKSPACE_KEY, workspaceBackupText } from '../src/lib/storage';
import { parseWorkspaceBackup, validateWorkspace } from '../src/lib/workspaceValidation';
import type { Workspace } from '../src/lib/types';

const at = '2026-09-20T12:00:00.000Z';
class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  loadWorkspace();
});

function trackedWorkspace(): Workspace {
  const workspace = createWorkspace();
  workspace.questionFollowUps = [
    { id: 'follow-up-waiting', questionId: 'q-04', prompt: 'Which moisturiser do you already own?', status: 'Waiting for reply', createdAt: at, updatedAt: at },
    { id: 'follow-up-received', questionId: 'q-05', prompt: 'Which Barrier Cream do you mean?', status: 'Context received', createdAt: at, updatedAt: at },
  ];
  workspace.decisionSections = [
    { id: 'section-cloud', title: 'Is it worth £38?', cardIds: ['card-q-04', 'card-cloud-cream'], createdAt: at, updatedAt: at },
    { id: 'section-clarify', title: 'Check the missing product', cardIds: ['card-q-05', 'card-barrier-issue'], createdAt: at, updatedAt: at },
  ];
  return workspace;
}

function rejects(mutate: (workspace: any) => void, label: string, expected?: RegExp) {
  const workspace = trackedWorkspace();
  mutate(workspace);
  const checked = validateWorkspace(workspace);
  assert.equal(checked.ok, false, label);
  if (!checked.ok && expected) assert.match(checked.error, expected, label);
  assert.equal(parseWorkspaceBackup(JSON.stringify(workspace)).ok, false, `${label}: backup rejected`);
}

test('legacy version 1 workspaces and explicit empty workflow collections remain accepted', () => {
  for (const workspace of [createWorkspace(), { ...createWorkspace(), questionFollowUps: [], decisionSections: [] }]) {
    assert.equal(validateWorkspace(workspace).ok, true);
    const parsed = parseWorkspaceBackup(workspaceBackupText(workspace));
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.deepEqual(parsed.workspace, workspace);
    assert.equal(saveWorkspace(workspace), true);
    assert.deepEqual(loadWorkspace(), workspace);
  }
});

test('both follow-up statuses and named decision sections survive backup and browser persistence', () => {
  const workspace = trackedWorkspace();
  const parsed = parseWorkspaceBackup(workspaceBackupText(workspace));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.workspace, workspace);
  assert.equal(saveWorkspace(workspace), true);
  assert.deepEqual(JSON.parse(storage.getItem(WORKSPACE_KEY)!), workspace);
  assert.deepEqual(loadWorkspace(), workspace);
});

test('malformed workflow collections and records fail before import', () => {
  for (const field of ['questionFollowUps', 'decisionSections']) {
    for (const value of [null, {}, 'not a list', [null], ['not a record']]) {
      rejects(workspace => { workspace[field] = value; }, `${field}: ${JSON.stringify(value)}`);
    }
  }
  for (const field of ['id', 'questionId', 'prompt', 'status', 'createdAt', 'updatedAt']) {
    rejects(workspace => { delete workspace.questionFollowUps[0][field]; }, `follow-up missing ${field}`);
  }
  for (const field of ['id', 'title', 'cardIds', 'createdAt', 'updatedAt']) {
    rejects(workspace => { delete workspace.decisionSections[0][field]; }, `section missing ${field}`);
  }
});

test('follow-up text and identifiers are bounded and status and date fields are checked', () => {
  for (const prompt of ['', ' \n\t ', 'x'.repeat(1001), 8, {}]) {
    rejects(workspace => { workspace.questionFollowUps[0].prompt = prompt; }, `invalid follow-up prompt ${typeof prompt}`);
  }
  for (const status of ['Waiting', 'Resolved', 'Approved', null, 1]) {
    rejects(workspace => { workspace.questionFollowUps[0].status = status; }, `invalid follow-up status ${String(status)}`);
  }
  for (const field of ['createdAt', 'updatedAt']) {
    for (const value of ['', 'not-a-date', null, 123]) {
      rejects(workspace => { workspace.questionFollowUps[0][field] = value; }, `invalid follow-up ${field} ${String(value)}`);
    }
  }
  for (const field of ['id', 'questionId']) {
    for (const value of ['', 'x'.repeat(201), '__proto__', 1]) {
      rejects(workspace => { workspace.questionFollowUps[0][field] = value; }, `invalid follow-up ${field}`);
    }
  }
  const boundary = trackedWorkspace();
  boundary.questionFollowUps![0].prompt = 'x'.repeat(1000);
  assert.equal(validateWorkspace(boundary).ok, true);
});

test('decision section titles, membership and dates are bounded and checked', () => {
  for (const title of ['', ' \n\t ', 'x'.repeat(121), {}, 1]) {
    rejects(workspace => { workspace.decisionSections[0].title = title; }, `invalid section title ${typeof title}`);
  }
  for (const cardIds of [[], null, 'card-q-04', [null], ['card-q-04', 'card-q-04']]) {
    rejects(workspace => { workspace.decisionSections[0].cardIds = cardIds; }, `invalid section membership ${JSON.stringify(cardIds)}`);
  }
  for (const field of ['createdAt', 'updatedAt']) {
    for (const value of ['', 'not-a-date', null, 123]) {
      rejects(workspace => { workspace.decisionSections[0][field] = value; }, `invalid section ${field} ${String(value)}`);
    }
  }
  for (const value of ['', 'x'.repeat(201), '__proto__', 1]) {
    rejects(workspace => { workspace.decisionSections[0].id = value; }, 'invalid section identifier');
  }
  const boundary = trackedWorkspace();
  boundary.decisionSections![0].title = 'x'.repeat(120);
  assert.equal(validateWorkspace(boundary).ok, true);
});

test('workflow collection limits reject oversized imports rather than truncating them', () => {
  rejects(workspace => {
    workspace.questionFollowUps = Array.from({ length: 501 }, (_, index) => ({ ...workspace.questionFollowUps[0], id: `follow-${index}`, questionId: `question-${index}` }));
  }, '501 follow-ups', /follow-ups are invalid or exceed/);
  rejects(workspace => {
    workspace.decisionSections = Array.from({ length: 101 }, (_, index) => ({ ...workspace.decisionSections[0], id: `section-${index}` }));
  }, '101 sections', /sections are invalid or exceed/);
  rejects(workspace => {
    workspace.decisionSections[0].cardIds = Array.from({ length: 1001 }, (_, index) => `card-${index}`);
  }, '1001 section members', /sections are invalid or exceed/);
});

test('duplicate follow-up ids, duplicate per-question follow-ups and absent questions are rejected', () => {
  rejects(workspace => { workspace.questionFollowUps[1].id = workspace.questionFollowUps[0].id; }, 'duplicate follow-up id');
  rejects(workspace => { workspace.questionFollowUps[1].questionId = workspace.questionFollowUps[0].questionId; }, 'duplicate question follow-up');
  rejects(workspace => { workspace.questionFollowUps[0].questionId = 'missing-question'; }, 'dangling follow-up question');
});

test('duplicate decision section ids, absent cards and private review-note membership are rejected', () => {
  rejects(workspace => { workspace.decisionSections[1].id = workspace.decisionSections[0].id; }, 'duplicate section id');
  rejects(workspace => { workspace.decisionSections[0].cardIds.push('missing-card'); }, 'dangling section member');
  rejects(workspace => {
    workspace.reviewNotes = [{ id: 'private-review-note', text: 'Private deliberation', x: 0, y: 0, createdAt: at, updatedAt: at }];
    workspace.decisionSections[0].cardIds.push('private-review-note');
  }, 'review notes cannot become evidence-section members');
});

test('an invalid workflow edit cannot replace the saved workspace', () => {
  const workspace = trackedWorkspace();
  assert.equal(saveWorkspace(workspace), true);
  const original = storage.getItem(WORKSPACE_KEY);
  workspace.decisionSections![0].cardIds.push('missing-card');
  assert.equal(saveWorkspace(workspace), false);
  assert.equal(storage.getItem(WORKSPACE_KEY), original);
  assert.throws(() => workspaceBackupText(workspace));
});

test('private follow-up prompts and section labels do not enter AI requests or published advice', () => {
  const workspace = createWorkspace(), question = workspace.questions[3];
  const draft = draftAnswer(question, workspace.products);
  draft.status = 'approved';
  draft.publishedAt = at;
  const requests = (['draft', 'chat'] as const).map(task => buildAiRequest(task, question.text, workspace, [], workspace.cards[0]));
  const published = toPublishedAdvice(draft, workspace);
  workspace.questionFollowUps = [{ id: 'PRIVATE_FOLLOW_UP_ID', questionId: question.id, prompt: 'PRIVATE_CLARIFICATION_PROMPT', status: 'Context received', createdAt: at, updatedAt: at }];
  workspace.decisionSections = [{ id: 'PRIVATE_SECTION_ID', title: 'PRIVATE_SECTION_TITLE', cardIds: workspace.cards.map(card => card.id), createdAt: at, updatedAt: at }];
  assert.equal(validateWorkspace(workspace).ok, true);
  for (const [index, task] of (['draft', 'chat'] as const).entries()) {
    const request = buildAiRequest(task, question.text, workspace, [], workspace.cards[0]);
    assert.deepEqual(request, requests[index]);
    assert.doesNotMatch(JSON.stringify(request), /PRIVATE_|questionFollowUps|decisionSections/);
  }
  const currentPublished = toPublishedAdvice(draft, workspace);
  assert.deepEqual(currentPublished, published);
  assert.doesNotMatch(JSON.stringify(currentPublished), /PRIVATE_|questionFollowUps|decisionSections/);
});
