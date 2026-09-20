import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { FOLLOWER_ACTIVITY_LIMIT, FOLLOWER_ACTIVITY_SESSION_KEY, FOLLOWER_ACTIVITY_STORAGE_KEY, readFollowerActivity, recordFollowerEvent, summariseFollowerActivity } from '../src/lib/followerActivity';
import type { PublishedAdvice } from '../src/lib/types';

const values = new Map<string, string>(), session = new Map<string, string>();
let denyRead = false, denyWrite = false, denySession = false, silentWrite = false;
beforeEach(() => {
  values.clear(); session.clear(); denyRead = false; denyWrite = false; denySession = false; silentWrite = false;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => { if (denyRead) throw new Error('denied'); return values.get(key) ?? null; },
    setItem: (key: string, value: string) => { if (denyWrite) throw new Error('quota'); if (!silentWrite) values.set(key, value); },
  } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key: string) => { if (denySession) throw new Error('denied'); return session.get(key) ?? null; },
    setItem: (key: string, value: string) => { if (denySession) throw new Error('denied'); session.set(key, value); },
  } });
});
const advice = (): PublishedAdvice => ({ version: 1, demo: true, id: 'published-cloud', title: 'Reviewed Cloud Cream answer', text: 'PUBLIC_ANSWER_TEXT', products: [{ name: 'Cloud Cream', price: 38, note: 'PRODUCT_NOTE' }], sourceRefs: [{ page: 8, label: 'Source', excerpt: 'SOURCE_EXCERPT' }], publishedAt: '2026-09-20T10:00:00.000Z', decision: { verdict: 'Consider', suits: 'PERSONAL_CONSTRAINT', skipIf: 'SKIP_CONSTRAINT', unknowns: 'MISSING_CONTEXT' } });

test('activity retains only public identity and event metadata, never answer text or personal constraints', () => {
  const card = advice(), before = JSON.stringify(card);
  assert.equal(recordFollowerEvent(card, 'opened').ok, true);
  const raw = values.get(FOLLOWER_ACTIVITY_STORAGE_KEY)!;
  for (const excluded of ['PUBLIC_ANSWER_TEXT', 'PRODUCT_NOTE', 'SOURCE_EXCERPT', 'PERSONAL_CONSTRAINT', 'SKIP_CONSTRAINT', 'MISSING_CONTEXT']) assert.equal(raw.includes(excluded), false);
  assert.equal(readFollowerActivity().items[0].adviceTitle, card.title);
  assert.equal(JSON.stringify(card), before);
});

test('repeat opens and both open kinds share one visit across rerenders and same-session reopening', () => {
  const card = advice();
  const first = recordFollowerEvent(card, 'opened'), repeated = recordFollowerEvent({ ...card }, 'opened');
  assert.ok(first.ok && repeated.ok); assert.equal(repeated.alreadyRecorded, true);
  assert.equal(recordFollowerEvent(card, 'shared-opened').ok, true);
  const rows = summariseFollowerActivity(readFollowerActivity().items);
  assert.equal(rows[0].opened, 1); assert.equal(rows[0].sharedOpened, 1); assert.equal(rows[0].returnVisits, 0);
  assert.equal(readFollowerActivity().items.length, 2);
});

test('only another tab session creates a return; even much later rerenders and reloads do not', context => {
  let now = Date.now(); context.mock.method(Date, 'now', () => now);
  recordFollowerEvent(advice(), 'opened');
  now += 30 * 60 * 1000; recordFollowerEvent(advice(), 'opened');
  assert.equal(summariseFollowerActivity(readFollowerActivity().items)[0].opened, 1);
  now += 24 * 60 * 60 * 1000; recordFollowerEvent(advice(), 'opened');
  assert.equal(summariseFollowerActivity(readFollowerActivity().items)[0].returnVisits, 0);
  session.clear(); recordFollowerEvent(advice(), 'shared-opened');
  const row = summariseFollowerActivity(readFollowerActivity().items)[0];
  assert.equal(row.opened, 2); assert.equal(row.returnVisits, 1); assert.equal(row.sharedOpened, 1);
});

test('changed snapshots stay separate and save/copy actions never invent visits', () => {
  const card = advice(); recordFollowerEvent(card, 'saved'); recordFollowerEvent(card, 'share-copied');
  recordFollowerEvent({ ...card, text: 'Revised public answer' }, 'opened');
  const rows = summariseFollowerActivity(readFollowerActivity().items);
  assert.equal(rows.length, 2);
  const saved = rows.find(row => row.saved)!;
  assert.equal(saved.saved, 1); assert.equal(saved.shareCopied, 1); assert.equal(saved.opened, 0); assert.equal(saved.returnVisits, 0);
});

test('read and write denial never report success and failed opens remain retryable', () => {
  denyWrite = true; assert.equal(recordFollowerEvent(advice(), 'opened').ok, false);
  assert.equal(values.size, 0);
  denyWrite = false; assert.equal(recordFollowerEvent(advice(), 'opened').ok, true);
  assert.equal(summariseFollowerActivity(readFollowerActivity().items)[0].opened, 1);
  denyRead = true; assert.ok(readFollowerActivity().error); assert.equal(recordFollowerEvent(advice(), 'saved').ok, false);
});

test('a denied localStorage getter and unconfirmed write are reported without false counts', () => {
  silentWrite = true; const result = recordFollowerEvent(advice(), 'saved'); assert.equal(result.ok, false); assert.equal(values.size, 0);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
  assert.ok(readFollowerActivity().error); assert.equal(recordFollowerEvent(advice(), 'saved').ok, false);
});

test('session storage failure prevents unreliable visit counts but never blocks save/copy actions', () => {
  denySession = true; assert.equal(recordFollowerEvent(advice(), 'opened').ok, false);
  assert.equal(recordFollowerEvent(advice(), 'saved').ok, true);
  assert.equal(recordFollowerEvent(advice(), 'share-copied').ok, true);
  const row = summariseFollowerActivity(readFollowerActivity().items)[0]; assert.equal(row.opened, 0); assert.equal(row.saved, 1);
});

test('malformed, duplicate, oversized and private-field event records are preserved and cannot be overwritten', () => {
  recordFollowerEvent(advice(), 'opened'); const item = readFollowerActivity().items[0];
  const damaged = ['{broken', '', '{}', 'x'.repeat(1_000_001), JSON.stringify([{ ...item, kind: 'purchase' }]), JSON.stringify([{ ...item, visitId: undefined }]), JSON.stringify([{ ...item, createdAt: 'tomorrow' }]), JSON.stringify([{ ...item, privateQuestion: 'secret' }]), JSON.stringify([item, item]), JSON.stringify([item, { ...item, id: 'another' }])];
  for (const raw of damaged) {
    values.set(FOLLOWER_ACTIVITY_STORAGE_KEY, raw); assert.ok(readFollowerActivity().error);
    assert.equal(recordFollowerEvent(advice(), 'saved').ok, false); assert.equal(values.get(FOLLOWER_ACTIVITY_STORAGE_KEY), raw);
  }
});

test('damaged session records stay intact instead of creating false return visits', () => {
  const raw = '{damaged'; session.set(FOLLOWER_ACTIVITY_SESSION_KEY, raw);
  assert.equal(recordFollowerEvent(advice(), 'opened').ok, false);
  assert.equal(session.get(FOLLOWER_ACTIVITY_SESSION_KEY), raw); assert.equal(values.size, 0);
});

test('the event cap retains known counts and rejects additional actions without trimming history', () => {
  const saved = recordFollowerEvent(advice(), 'saved'); assert.ok(saved.ok);
  const items = Array.from({ length: FOLLOWER_ACTIVITY_LIMIT }, (_, index) => ({ ...saved.item, id: `event-${index}` }));
  const raw = JSON.stringify(items); values.set(FOLLOWER_ACTIVITY_STORAGE_KEY, raw);
  assert.equal(readFollowerActivity().atCapacity, true); assert.equal(recordFollowerEvent(advice(), 'saved').ok, false);
  assert.equal(values.get(FOLLOWER_ACTIVITY_STORAGE_KEY), raw); assert.equal(summariseFollowerActivity(readFollowerActivity().items)[0].saved, FOLLOWER_ACTIVITY_LIMIT);
});

test('invalid answers and unknown event names cannot enter the activity store', () => {
  assert.equal(recordFollowerEvent({ ...advice(), id: '' }, 'opened').ok, false);
  assert.equal(recordFollowerEvent(advice(), 'purchased' as never).ok, false);
  assert.equal(values.size, 0); assert.equal(session.size, 0);
});
