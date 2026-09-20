import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer } from '../src/lib/engine';
import { personaReply } from '../src/lib/personaReplies';
import { parseVoiceCommand } from '../src/lib/voiceCommands';

test('persona commands are explicit and cannot publish an answer', () => {
  const workspace = createWorkspace();
  assert.deepEqual(parseVoiceCommand('Maya, what’s missing?', workspace.questions), { type: 'inspect', topic: 'issues' });
  assert.deepEqual(parseVoiceCommand('Explain this card', workspace.questions), { type: 'inspect', topic: 'selected' });
  assert.deepEqual(parseVoiceCommand('What is your approach?', workspace.questions), { type: 'inspect', topic: 'persona' });
  assert.equal(parseVoiceCommand('Maya, approve and publish everything', workspace.questions).type, 'unsupported');
});

test('issue narration reflects live records and separates administrative review from answer holds', () => {
  const workspace = createWorkspace();
  const openCount = workspace.issues.filter(issue => issue.status !== 'Resolved').length;
  assert.ok(personaReply('issues', workspace).message.includes(`${openCount} open report entries`));
  workspace.issues = workspace.issues.map(issue => ({ ...issue, status: issue.severity === 'Admin only' ? 'Open' : 'Resolved' }));
  const reply = personaReply('issues', workspace);
  assert.match(reply.message, /2 open report entries/);
  assert.match(reply.message, /Each answer has separate evidence checks/);
  assert.doesNotMatch(reply.message, /before the affected recommendations/);
});

test('resolved-issue narration identifies the original finding and recorded resolution', () => {
  const workspace = createWorkspace();
  const issue = workspace.issues[0];
  issue.status = 'Resolved'; issue.resolution = 'A correction was recorded for review.';
  const reply = personaReply('selected', workspace, { id: 'issue-card', kind: 'issue', entityId: issue.id, x: 0, y: 0 });
  assert.match(reply.message, /Status: Resolved/);
  assert.match(reply.message, /The original finding was/);
  assert.match(reply.message, /A correction was recorded for review/);
  assert.match(reply.message, /Answer evidence is checked separately/);
});

test('answer narration preserves evidence holds and never changes review status', () => {
  const workspace = createWorkspace();
  const draft = draftAnswer(workspace.questions[4], workspace.products);
  workspace.drafts.push(draft);
  const before = structuredClone(workspace);
  const reply = personaReply('selected', workspace, { id: 'draft-card', kind: 'draft', entityId: draft.id, x: 0, y: 0 });
  assert.match(reply.message, /needs more evidence/);
  assert.match(reply.message, /Barrier Cream/);
  assert.deepEqual(workspace, before);
});

test('persona does not invent context when no card is selected', () => {
  const reply = personaReply('selected', createWorkspace());
  assert.equal(reply.ok, false);
  assert.match(reply.message, /Select a card/);
});
