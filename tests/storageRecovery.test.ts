import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer } from '../src/lib/engine';
import { CORRUPT_PREFIX, getRecoverySnapshots, getWorkspaceStorageStatus, loadWorkspace, PRE_RESTORE_KEY, RECOVERY_KEY, restoreWorkspace, saveWorkspace, WORKSPACE_KEY, workspaceBackupText } from '../src/lib/storage';
import { parseWorkspaceBackup, validateWorkspace } from '../src/lib/workspaceValidation';

class MemoryStorage {
  data = new Map<string, string>();
  failWrite: (key: string) => boolean = () => false;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite(key)) throw new Error('Quota exceeded'); this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
let storage: MemoryStorage;
beforeEach(() => { storage = new MemoryStorage(); Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage }); loadWorkspace(); });
function edited(label = 'Edited question') { const workspace = createWorkspace(); workspace.questions[0].text = label; return workspace; }

test('legacy version 1 workspaces load unchanged and incomplete decision fields survive a backup', () => {
  const workspace = createWorkspace();
  const draft = draftAnswer(workspace.questions[3], workspace.products);
  draft.decision = { verdict: 'Consider', suits: '', skipIf: '', unknowns: '' };
  workspace.drafts.push(draft);
  storage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  assert.deepEqual(loadWorkspace(), workspace);
  const parsed = parseWorkspaceBackup(workspaceBackupText(workspace));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.workspace, workspace);
});

test('nested malformed records and dangling references fail validation before the UI reads them', () => {
  const cases: ((workspace: any) => void)[] = [
    workspace => { workspace.products[0].source = null; },
    workspace => { workspace.questions[0].productIds = [null]; },
    workspace => { workspace.questions[0].productIds = ['missing']; },
    workspace => { workspace.cards[0].entityId = 'missing'; },
    workspace => { workspace.cards[0].x = Infinity; },
    workspace => { workspace.cards[0].kind = '__proto__'; },
    workspace => { workspace.cards.push({ ...workspace.cards[0] }); },
    workspace => { workspace.links[0].target = 'missing'; },
    workspace => { workspace.activity[0].text = { unsafe: true }; },
    workspace => { workspace.issues[0].sourceRefs = ['not a source']; },
  ];
  for (const mutate of cases) { const workspace = createWorkspace(); mutate(workspace); assert.equal(validateWorkspace(workspace).ok, false); }
});

test('bounded history remains recoverable while recursive or mismatched snapshots are rejected', () => {
  const workspace = createWorkspace();
  const draft = draftAnswer(workspace.questions[3], workspace.products);
  draft.history = [{ id: 'revision-1', savedAt: new Date().toISOString(), reason: 'Before editing', snapshot: { ...draft, text: 'Earlier words' } }];
  workspace.drafts.push(draft);
  assert.equal(validateWorkspace(workspace).ok, true);
  (draft.history[0].snapshot as any).history = [];
  assert.equal(validateWorkspace(workspace).ok, false);
  delete (draft.history[0].snapshot as any).history;
  draft.history[0].snapshot.questionId = 'q-05';
  assert.equal(validateWorkspace(workspace).ok, false);
});

test('a damaged primary is preserved exactly and the last valid workspace opens', () => {
  const recovery = edited('Earlier saved words');
  const damaged = '{"version":1,"products":[null]}';
  storage.setItem(WORKSPACE_KEY, damaged); storage.setItem(RECOVERY_KEY, JSON.stringify(recovery));
  const loaded = loadWorkspace();
  assert.deepEqual(loaded, recovery);
  assert.equal(storage.getItem(WORKSPACE_KEY), damaged, 'load itself never overwrites the primary');
  const damagedCopies = [...storage.data.entries()].filter(([key]) => key.startsWith(CORRUPT_PREFIX));
  assert.equal(damagedCopies.length, 1); assert.equal(damagedCopies[0][1], damaged);
  assert.equal(saveWorkspace(loaded), true);
  assert.equal(storage.getItem(damagedCopies[0][0]), damaged);
  assert.deepEqual(JSON.parse(storage.getItem(WORKSPACE_KEY)!), recovery);
});

test('quota failure preserving damage prevents seed fallback from overwriting the original', () => {
  const damaged = '{bad workspace'; storage.setItem(WORKSPACE_KEY, damaged);
  storage.failWrite = key => key.startsWith(CORRUPT_PREFIX);
  const fallback = loadWorkspace();
  assert.equal(fallback.questions.length, 12);
  assert.equal(saveWorkspace(fallback), false);
  assert.equal(storage.getItem(WORKSPACE_KEY), damaged);
  assert.match(getWorkspaceStorageStatus().message, /could not be preserved/);
});

test('saving retains the previous valid snapshot; quota failure leaves primary untouched', () => {
  const previous = edited('Previous'); const next = edited('Next');
  assert.equal(saveWorkspace(previous), true); assert.equal(saveWorkspace(next), true);
  assert.deepEqual(JSON.parse(storage.getItem(RECOVERY_KEY)!), previous);
  storage.failWrite = key => key === RECOVERY_KEY;
  assert.equal(saveWorkspace(edited('Unsaved')), false);
  assert.deepEqual(JSON.parse(storage.getItem(WORKSPACE_KEY)!), next);
  assert.deepEqual(JSON.parse(storage.getItem(RECOVERY_KEY)!), previous);
  assert.equal(getWorkspaceStorageStatus().ok, false);
});

test('a failed primary write still retains a valid recovery copy', () => {
  const previous = edited('Previous'); saveWorkspace(previous);
  storage.failWrite = key => key === WORKSPACE_KEY;
  assert.equal(saveWorkspace(edited('Unsaved')), false);
  assert.deepEqual(JSON.parse(storage.getItem(WORKSPACE_KEY)!), previous);
  assert.deepEqual(JSON.parse(storage.getItem(RECOVERY_KEY)!), previous);
});

test('restore preserves the live pre-restore workspace including unsaved changes', () => {
  saveWorkspace(edited('Last disk version'));
  const live = edited('Unsaved edit'); const imported = edited('Imported');
  assert.equal(restoreWorkspace(imported, live), true);
  assert.deepEqual(JSON.parse(storage.getItem(PRE_RESTORE_KEY)!), live);
  assert.deepEqual(JSON.parse(storage.getItem(WORKSPACE_KEY)!), imported);
  saveWorkspace(edited('More changes'));
  assert.deepEqual(getRecoverySnapshots().find(item => item.key === PRE_RESTORE_KEY)?.workspace, live);
});

test('restore fails closed if the pre-restore copy cannot be saved', () => {
  const current = edited('Current'); saveWorkspace(current);
  storage.failWrite = key => key === PRE_RESTORE_KEY;
  assert.equal(restoreWorkspace(edited('Imported'), current), false);
  assert.deepEqual(JSON.parse(storage.getItem(WORKSPACE_KEY)!), current);
  assert.match(getWorkspaceStorageStatus().message, /current workspace is unchanged/);
});

test('invalid imports and unsupported formats leave all stored data untouched', () => {
  const current = createWorkspace(); saveWorkspace(current);
  const before = [...storage.data.entries()];
  for (const raw of ['{bad json', '{}', JSON.stringify({ format: 'another-product', version: 1, workspace: current }), 'x'.repeat(5_000_001)]) assert.equal(parseWorkspaceBackup(raw).ok, false);
  assert.equal(restoreWorkspace({ ...current, products: null } as any, current), false);
  assert.deepEqual([...storage.data.entries()], before);
});
