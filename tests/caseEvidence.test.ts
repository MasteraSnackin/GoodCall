import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASE_EVIDENCE, findCaseEvidence, caseEvidenceText } from '../src/lib/caseEvidence';
import { addCaseEvidenceCards } from '../src/lib/caseEvidenceCanvas';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer, toPublishedAdvice } from '../src/lib/engine';
import { validateWorkspace, parseWorkspaceBackup } from '../src/lib/workspaceValidation';
import { workspaceBackupText } from '../src/lib/storage';
import { searchCanvasCards } from '../src/lib/canvasNavigation';
import { personaReply } from '../src/lib/personaReplies';
import { respondToChat } from '../src/lib/chat';

test('source tables retain absent values and distinguish reported figures from the small sample', () => {
  const posts = findCaseEvidence('case-content-log')!;
  assert.equal(posts.table!.rows.length, 6);
  assert.equal(posts.table!.rows.filter(row => row.at(-1) === 'Not supplied').length, 5);
  assert.equal(posts.table!.rows.find(row => row[0] === 'My 5-minute morning routine')!.at(-1), '317');
  const sample = findCaseEvidence('case-hidden-audience-sample')!;
  assert.equal(sample.table!.rows.length, 10);
  assert.deepEqual(sample.table!.rows.find(row => row[1] === 'Naomi')!.slice(-3), ['No', '—', '—']);
  assert.equal(sample.table!.rows.find(row => row[1] === 'Alice')!.at(-1), '£94');
  assert.match(sample.caveat!, /does not validate the page 14/);
  const reported = findCaseEvidence('case-quiet-audience-findings')!;
  assert.match(caseEvidenceText(reported), /61%/);
  assert.match(reported.caveat!, /not results calculated from the ten-row sample/);
  for (const entry of CASE_EVIDENCE) assert.ok(entry.sourceRefs.every(ref => ref.page >= 2 && ref.page <= 17));
});

test('adding an overview is idempotent and preserves existing cards, reviewed answers and links', () => {
  const original = createWorkspace();
  const draft = draftAnswer(original.questions.find(q => q.id === 'q-04')!, original.products);
  const at = new Date().toISOString();
  original.drafts = [{ ...draft, status: 'published', approvedAt: at, publishedAt: at }];
  const before = structuredClone(original);
  const ids = ['case-creator-constraints', 'case-content-log', 'case-quiet-audience-findings'];
  const expanded = addCaseEvidenceCards(original, [...ids, ids[0], 'unknown-record']);
  assert.equal(expanded.cards.length, original.cards.length + 3);
  assert.deepEqual(original, before);
  assert.deepEqual(expanded.cards.slice(0, original.cards.length), original.cards);
  assert.strictEqual(expanded.drafts, original.drafts);
  assert.strictEqual(expanded.links, original.links);
  assert.strictEqual(addCaseEvidenceCards(expanded, ids), expanded);
  assert.deepEqual(toPublishedAdvice(expanded.drafts[0], expanded), toPublishedAdvice(original.drafts[0], original));
});

test('evidence cards roundtrip through strict backups while invalid source IDs are rejected', () => {
  const original = createWorkspace();
  assert.equal(validateWorkspace(original).ok, true);
  const expanded = addCaseEvidenceCards(original, CASE_EVIDENCE.map(item => item.id));
  assert.equal(validateWorkspace(expanded).ok, true);
  const restored = parseWorkspaceBackup(workspaceBackupText(expanded));
  assert.equal(restored.ok, true);
  if (restored.ok) assert.deepEqual(restored.workspace, expanded);
  const invalid = structuredClone(expanded);
  invalid.cards.at(-1)!.entityId = 'untrusted-extra-source';
  assert.equal(validateWorkspace(invalid).ok, false);
});

test('placement avoids existing records even if a generated card ID is already in use', () => {
  const workspace = createWorkspace();
  workspace.cards[0] = { ...workspace.cards[0], id: 'card-case-content-log', x: 1160, y: 35 };
  workspace.links = [];
  const next = addCaseEvidenceCards(workspace, ['case-content-log']);
  const added = next.cards.at(-1)!;
  assert.notEqual(added.id, workspace.cards[0].id);
  assert.ok(added.x >= 1520 || added.y >= 345);
  assert.equal(validateWorkspace(next).ok, true);
});

test('search and spoken or chat explanations include the full selected evidence and limitations', () => {
  const workspace = addCaseEvidenceCards(createWorkspace(), ['case-hidden-audience-sample', 'case-quiet-audience-findings']);
  const before = JSON.stringify(workspace);
  const found = searchCanvasCards(workspace, 'Tara £122');
  assert.equal(found.length, 1);
  assert.equal(found[0].entityId, 'case-hidden-audience-sample');
  const voice = personaReply('selected', workspace, found[0]);
  assert.equal(voice.ok, true);
  assert.match(voice.message, /not a zero-value order/);
  const chat = respondToChat('Explain this card', workspace, [], found[0]);
  assert.match(chat.text, /£122/);
  assert.match(chat.text, /small sample/);
  assert.ok(chat.sourceRefs?.some(ref => ref.page === 15));
  assert.equal(JSON.stringify(workspace), before);
});
