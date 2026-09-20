import type { PublishedAdvice, SourceRef } from './types';
import { isDecisionProfile } from './decisionTypes';

const MAX = 22000;
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function validSource(value: unknown): value is SourceRef {
  return object(value) && Number.isInteger(value.page) && (value.page as number) >= 0 && (value.page as number) <= 999
    && typeof value.label === 'string' && value.label.length <= 300
    && typeof value.excerpt === 'string' && value.excerpt.length <= 2000;
}
export function isAdvice(value: unknown): value is PublishedAdvice {
  if (!object(value)) return false;
  return (value.decision === undefined || (object(value.decision) && isDecisionProfile(value.decision)))
    && value.version === 1 && value.demo === true
    && typeof value.id === 'string' && value.id.length <= 100
    && typeof value.title === 'string' && value.title.length > 0 && value.title.length <= 300
    && typeof value.text === 'string' && value.text.length > 0 && value.text.length <= 6000
    && typeof value.publishedAt === 'string' && Number.isFinite(Date.parse(value.publishedAt))
    && Array.isArray(value.sourceRefs) && value.sourceRefs.length <= 20 && value.sourceRefs.every(validSource)
    && Array.isArray(value.products) && value.products.length <= 15 && value.products.every(product =>
      object(product) && typeof product.name === 'string' && product.name.length <= 200
      && typeof product.note === 'string' && product.note.length <= 1000
      && typeof product.price === 'number' && Number.isFinite(product.price) && product.price >= 0 && product.price < 100000);
}

/** Share only known public fields, including when reading older or imported snapshots. */
export function toPublicAdviceSnapshot(value: unknown): PublishedAdvice | null {
  if (!isAdvice(value)) return null;
  return {
    version: 1, id: value.id, title: value.title, text: value.text,
    products: value.products.map(({ name, price, note }) => ({ name, price, note })),
    sourceRefs: value.sourceRefs.map(({ page, label, excerpt }) => ({ page, label, excerpt })),
    ...(value.decision ? { decision: {
      verdict: value.decision.verdict, suits: value.decision.suits,
      skipIf: value.decision.skipIf, unknowns: value.decision.unknowns,
    } } : {}),
    publishedAt: value.publishedAt, demo: true,
  };
}

export function encodeAdvice(advice: PublishedAdvice): string {
  const snapshot = toPublicAdviceSnapshot(advice);
  if (!snapshot) throw new Error('This advice card is incomplete.');
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const token = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  if (token.length > MAX) throw new Error('This card is too long to share. Shorten the answer first.');
  return token;
}
export function decodeAdvice(token: string): PublishedAdvice | null {
  try {
    if (!token || token.length > MAX || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
    const raw = atob(token.replaceAll('-', '+').replaceAll('_', '/'));
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(raw, character => character.charCodeAt(0))));
    return toPublicAdviceSnapshot(value);
  } catch { return null; }
}
export function shareUrl(advice: PublishedAdvice) {
  return `${location.origin}${location.pathname}#/advice/${encodeAdvice(advice)}`;
}
