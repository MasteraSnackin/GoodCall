import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer } from '../src/lib/engine';
import { commitPublication, createPublicationPreview } from '../src/lib/publication';
import { decodeAdvice, encodeAdvice, toPublicAdviceSnapshot } from '../src/lib/share';
import { parseWorkspaceBackup } from '../src/lib/workspaceValidation';

const privateMetadata = { email: 'PRIVATE-FIXTURE@example.invalid', unpublishedDraft: 'PRIVATE-FIXTURE-NOTES' };
const rawToken = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const tokenContents = (token: string) => Buffer.from(token, 'base64url').toString('utf8');
function fixture() {
  const workspace = createWorkspace();
  const draft = { ...draftAnswer(workspace.questions.find(question => question.id === 'q-04')!, workspace.products), status: 'approved' as const };
  workspace.drafts = [draft];
  return { workspace, draft };
}

test('imported source metadata stays private through preview and publication without changing the backup', () => {
  const { workspace, draft } = fixture();
  const source = draft.sourceRefs.find(item => item.label.startsWith('E-04.1'))!;
  Object.assign(source, { privateInbox: privateMetadata });
  const imported = parseWorkspaceBackup(JSON.stringify(workspace));
  assert.equal(imported.ok, true);
  if (!imported.ok) return;
  const before = JSON.stringify(imported.workspace);
  const preview = createPublicationPreview(imported.workspace.drafts[0], imported.workspace);
  assert.doesNotMatch(JSON.stringify(preview.advice), /PRIVATE-FIXTURE|privateInbox/);
  assert.doesNotMatch(tokenContents(preview.token), /PRIVATE-FIXTURE|privateInbox/);
  assert.deepEqual(decodeAdvice(preview.token), preview.advice);
  let persisted = '';
  const result = commitPublication(imported.workspace, draft.id, next => { persisted = JSON.stringify(next); return true; });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.doesNotMatch(JSON.stringify(result.advice), /PRIVATE-FIXTURE|privateInbox/);
  assert.doesNotMatch(tokenContents(result.token), /PRIVATE-FIXTURE|privateInbox/);
  assert.deepEqual(decodeAdvice(result.token), result.advice);
  assert.equal(JSON.stringify(imported.workspace), before);
  assert.match(persisted, /PRIVATE-FIXTURE-NOTES/, 'publishing must not discard private workspace data');
});

test('public snapshot boundaries remove unknown fields at every level and preserve older cards', () => {
  const { workspace, draft } = fixture();
  const clean = createPublicationPreview(draft, workspace).advice;
  const withMetadata = {
    ...clean, privateInbox: privateMetadata,
    products: clean.products.map(product => ({ ...product, privateInbox: privateMetadata })),
    sourceRefs: clean.sourceRefs.map(source => ({ ...source, privateInbox: privateMetadata })),
    decision: { ...clean.decision!, privateInbox: privateMetadata },
  };
  const before = JSON.stringify(withMetadata);
  assert.deepEqual(toPublicAdviceSnapshot(withMetadata), clean);
  const encoded = encodeAdvice(withMetadata);
  assert.doesNotMatch(tokenContents(encoded), /PRIVATE-FIXTURE|privateInbox/);
  assert.deepEqual(decodeAdvice(encoded), clean);
  assert.deepEqual(decodeAdvice(rawToken(withMetadata)), clean, 'old incoming links are projected before reuse');
  const legacy = { ...clean }; delete legacy.decision;
  assert.deepEqual(decodeAdvice(rawToken({ ...legacy, privateInbox: privateMetadata })), legacy);
  assert.equal(JSON.stringify(withMetadata), before);
});

test('public objects cannot be arrays with attached properties and invalid known fields stay rejected', () => {
  const { workspace, draft } = fixture();
  const clean = createPublicationPreview(draft, workspace).advice;
  const invalid = [
    Object.assign([], clean),
    { ...clean, decision: Object.assign([], clean.decision) },
    { ...clean, products: [Object.assign([], clean.products[0])] },
    { ...clean, sourceRefs: [Object.assign([], clean.sourceRefs[0])] },
    { ...clean, products: [{ ...clean.products[0], price: -1, privateInbox: privateMetadata }] },
    { ...clean, decision: { ...clean.decision, verdict: ['Consider'] } },
  ];
  for (const value of invalid) assert.equal(toPublicAdviceSnapshot(value), null);
});
