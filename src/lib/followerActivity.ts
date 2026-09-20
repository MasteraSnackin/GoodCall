import type { PublishedAdvice } from './types';
import { isAdvice } from './share';
import { feedbackAdviceVersion } from './feedback';

export const FOLLOWER_ACTIVITY_STORAGE_KEY = 'goodcall-follower-activity-v1';
export const FOLLOWER_ACTIVITY_SESSION_KEY = 'goodcall-follower-visits-v1';
export const FOLLOWER_ACTIVITY_EVENT = 'goodcall-follower-activity-changed';
export const FOLLOWER_ACTIVITY_LIMIT = 1000;
export type FollowerEventKind = 'opened' | 'saved' | 'share-copied' | 'shared-opened';
export interface FollowerActivityRecord {
  version: 1;
  id: string;
  adviceId: string;
  adviceTitle: string;
  adviceVersion: string;
  kind: FollowerEventKind;
  createdAt: string;
  visitId?: string;
}
export type FollowerActivityRead = { items: FollowerActivityRecord[]; error?: string; atCapacity?: boolean };
export type FollowerActivityResult = { ok: true; item: FollowerActivityRecord; alreadyRecorded?: boolean } | { ok: false; error: string };
export interface FollowerActivitySummary {
  adviceId: string;
  adviceTitle: string;
  adviceVersion: string;
  opened: number;
  saved: number;
  shareCopied: number;
  sharedOpened: number;
  returnVisits: number;
  lastActivityAt: string;
}
type Visit = { adviceId: string; adviceVersion: string; visitId: string; lastSeenAt: number };
const MAX_RAW = 1_000_000;
const kinds: FollowerEventKind[] = ['opened', 'saved', 'share-copied', 'shared-opened'];
const bounded = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const timestamp = (value: unknown): value is string => bounded(value, 80) && Number.isFinite(Date.parse(value));
const isOpen = (kind: FollowerEventKind) => kind === 'opened' || kind === 'shared-opened';
const identity = (value: { adviceId: string; adviceVersion: string }) => JSON.stringify([value.adviceId, value.adviceVersion]);
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 14)}`;

export function validFollowerActivity(value: unknown): value is FollowerActivityRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as FollowerActivityRecord;
  const allowed = ['version', 'id', 'adviceId', 'adviceTitle', 'adviceVersion', 'kind', 'createdAt', 'visitId'];
  return Object.keys(item).every(key => allowed.includes(key)) && item.version === 1
    && bounded(item.id, 120) && bounded(item.adviceId, 100) && bounded(item.adviceTitle, 300)
    && bounded(item.adviceVersion, 100) && kinds.includes(item.kind) && timestamp(item.createdAt)
    && (isOpen(item.kind) ? bounded(item.visitId, 120) : item.visitId === undefined);
}

/** Read failures are distinct from an empty store; damaged originals are never replaced. */
export function readFollowerActivity(): FollowerActivityRead {
  try {
    const raw = localStorage.getItem(FOLLOWER_ACTIVITY_STORAGE_KEY);
    if (raw === null) return { items: [] };
    if (raw.length > MAX_RAW) return { items: [], error: 'Saved follower activity is too large to read. Its stored copy has been left unchanged.' };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > FOLLOWER_ACTIVITY_LIMIT || !parsed.every(validFollowerActivity)
      || new Set(parsed.map(item => item.id)).size !== parsed.length) {
      return { items: [], error: 'Saved follower activity could not be validated. Its stored copy has been left unchanged.' };
    }
    const visits = parsed.filter(item => isOpen(item.kind)).map(item => JSON.stringify([identity(item), item.kind, item.visitId]));
    if (new Set(visits).size !== visits.length) return { items: [], error: 'Saved follower activity contains duplicate visits. Its stored copy has been left unchanged.' };
    return { items: parsed, atCapacity: parsed.length >= FOLLOWER_ACTIVITY_LIMIT };
  } catch {
    return { items: [], error: 'Follower activity could not be read on this device. Counts are unavailable until browser storage can be read.' };
  }
}

function currentVisit(adviceId: string, adviceVersion: string, now: number): string {
  const raw = sessionStorage.getItem(FOLLOWER_ACTIVITY_SESSION_KEY);
  if (raw !== null && raw.length > MAX_RAW) throw new Error('session');
  const visits: Visit[] = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(visits) || visits.length > FOLLOWER_ACTIVITY_LIMIT || !visits.every(visit => visit && typeof visit === 'object'
    && Object.keys(visit).every(key => ['adviceId', 'adviceVersion', 'visitId', 'lastSeenAt'].includes(key))
    && bounded(visit.adviceId, 100) && bounded(visit.adviceVersion, 100) && bounded(visit.visitId, 120)
    && typeof visit.lastSeenAt === 'number' && Number.isSafeInteger(visit.lastSeenAt) && visit.lastSeenAt >= 0)
    || new Set(visits.map(identity)).size !== visits.length) throw new Error('session');
  const key = identity({ adviceId, adviceVersion });
  const previous = visits.find(visit => identity(visit) === key);
  if (!previous && visits.length >= FOLLOWER_ACTIVITY_LIMIT) throw new Error('session');
  // Session identity, rather than a timeout, prevents late rerenders from inventing returns.
  const visitId = previous?.visitId ?? id('visit');
  const next = [{ adviceId, adviceVersion, visitId, lastSeenAt: now }, ...visits.filter(visit => identity(visit) !== key)];
  const encoded = JSON.stringify(next);
  sessionStorage.setItem(FOLLOWER_ACTIVITY_SESSION_KEY, encoded);
  if (sessionStorage.getItem(FOLLOWER_ACTIVITY_SESSION_KEY) !== encoded) throw new Error('session');
  return visitId;
}

/** Call only after the named action succeeds; previews must never call this function. */
export function recordFollowerEvent(advice: PublishedAdvice, kind: FollowerEventKind): FollowerActivityResult {
  if (!isAdvice(advice) || !bounded(advice.id, 100) || !kinds.includes(kind)) return { ok: false, error: 'Follower activity was not recorded because this published answer or action is incomplete.' };
  const stored = readFollowerActivity();
  if (stored.error) return { ok: false, error: stored.error };
  const adviceVersion = feedbackAdviceVersion(advice);
  let visitId: string | undefined;
  if (isOpen(kind)) {
    try { visitId = currentVisit(advice.id, adviceVersion, Date.now()); }
    catch { return { ok: false, error: 'This visit could not be recorded reliably because browser session storage is unavailable or damaged. The answer is still available.' }; }
    const previous = stored.items.find(item => item.adviceId === advice.id && item.adviceVersion === adviceVersion && item.kind === kind && item.visitId === visitId);
    if (previous) return { ok: true, item: previous, alreadyRecorded: true };
  }
  if (stored.atCapacity) return { ok: false, error: 'This browser has reached its limit of 1,000 follower activity events. This action was not added to the counts.' };
  const item: FollowerActivityRecord = {
    version: 1, id: id('activity'), adviceId: advice.id, adviceTitle: advice.title,
    adviceVersion, kind, createdAt: new Date().toISOString(), ...(visitId ? { visitId } : {}),
  };
  const encoded = JSON.stringify([item, ...stored.items]);
  if (!validFollowerActivity(item) || encoded.length > MAX_RAW) return { ok: false, error: 'Follower activity could not be recorded because this browser’s activity store is full.' };
  try {
    localStorage.setItem(FOLLOWER_ACTIVITY_STORAGE_KEY, encoded);
    if (localStorage.getItem(FOLLOWER_ACTIVITY_STORAGE_KEY) !== encoded) return { ok: false, error: 'Follower activity could not be confirmed in browser storage. Its counts may not include this action.' };
  } catch {
    return { ok: false, error: 'Follower activity could not be saved on this device. The action still succeeded, but its count was not recorded.' };
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FOLLOWER_ACTIVITY_EVENT));
  return { ok: true, item };
}

export function summariseFollowerActivity(items: FollowerActivityRecord[]): FollowerActivitySummary[] {
  const groups = new Map<string, { summary: FollowerActivitySummary; visits: Set<string>; sharedVisits: Set<string> }>();
  for (const item of items) {
    const key = identity(item);
    let group = groups.get(key);
    if (!group) {
      group = { summary: { adviceId: item.adviceId, adviceTitle: item.adviceTitle, adviceVersion: item.adviceVersion, opened: 0, saved: 0, shareCopied: 0, sharedOpened: 0, returnVisits: 0, lastActivityAt: item.createdAt }, visits: new Set(), sharedVisits: new Set() };
      groups.set(key, group);
    }
    if (Date.parse(item.createdAt) > Date.parse(group.summary.lastActivityAt)) group.summary.lastActivityAt = item.createdAt;
    if (isOpen(item.kind)) group.visits.add(item.visitId!);
    if (item.kind === 'shared-opened') group.sharedVisits.add(item.visitId!);
    if (item.kind === 'saved') group.summary.saved++;
    if (item.kind === 'share-copied') group.summary.shareCopied++;
  }
  return [...groups.values()].map(({ summary, visits, sharedVisits }) => ({ ...summary, opened: visits.size, sharedOpened: sharedVisits.size, returnVisits: Math.max(0, visits.size - 1) }))
    .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));
}
