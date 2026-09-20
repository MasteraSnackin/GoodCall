import { INTENTS } from './types';
import type { Workspace } from './types';
import { mayaNotes } from './seed';
import { CASE_EVIDENCE } from './caseEvidence';

export const MAX_BACKUP_BYTES = 5_000_000;
type RecordValue = Record<string, unknown>;
export type WorkspaceValidation = { ok: true; workspace: Workspace } | { ok: false; error: string };
const object = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown, limit = 30_000): value is string => typeof value === 'string' && value.length <= limit;
const id = (value: unknown): value is string => string(value, 200) && value.length > 0 && !['__proto__', 'constructor', 'prototype'].includes(value);
const number = (value: unknown, max = 1_000_000_000): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const integer = (value: unknown, max = 1_000_000): value is number => number(value, max) && Number.isInteger(value);
const date = (value: unknown) => string(value, 100) && Number.isFinite(Date.parse(value));
const optional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value);
const oneOf = (value: unknown, choices: readonly string[]) => typeof value === 'string' && choices.includes(value);
const list = (value: unknown, check: (value: unknown) => boolean, max = 5_000): value is unknown[] => Array.isArray(value) && value.length <= max && value.every(check);
const ids = (value: unknown) => list(value, id, 1_000) && new Set(value).size === value.length;
const source = (value: unknown) => object(value) && integer(value.page) && string(value.label, 2_000) && string(value.excerpt);
const sources = (value: unknown) => list(value, source, 200);
const decision = (value: unknown) => object(value) && oneOf(value.verdict, ['Consider', 'Skip for now', 'Need more context']) && ['suits', 'skipIf', 'unknowns'].every(key => string(value[key], 800));
const reuse = (value: unknown) => object(value) && id(value.draftId) && string(value.title) && optional(value.approvedAt, date);
const revisions = (value: unknown) => object(value) && Object.entries(value).length <= 1_000 && Object.entries(value).every(([key, revision]) => id(key) && integer(revision));
const aiMetadata = (value: unknown) => object(value) && oneOf(value.provider, ['openai', 'anthropic']) && string(value.model, 120) && value.model.length > 0 && date(value.generatedAt) && list(value.missingEvidence, item => string(item, 1000), 20);
const persona = (value: unknown) => object(value) && id(value.id) && integer(value.version);

function draft(value: unknown, historyAllowed = true): boolean {
  if (!object(value)) return false;
  const valid = id(value.id) && id(value.questionId) && string(value.title) && string(value.text, 100_000) && ids(value.productIds) && sources(value.sourceRefs) && revisions(value.productRevisions)
    && oneOf(value.status, ['draft', 'approved', 'published']) && oneOf(value.mode, ['Evidence template', 'Written by Maya', 'AI suggestion']) && date(value.createdAt) && date(value.updatedAt)
    && optional(value.approvedAt, date) && optional(value.publishedAt, date) && optional(value.cardId, id) && optional(value.decision, decision) && optional(value.reusedFrom, reuse) && optional(value.persona, persona) && optional(value.ai, aiMetadata);
  if (!valid) return false;
  if (!historyAllowed) return value.history === undefined;
  return optional(value.history, history => list(history, entry => object(entry) && id(entry.id) && date(entry.savedAt) && string(entry.reason, 2_000) && draft(entry.snapshot, false) && object(entry.snapshot) && entry.snapshot.id === value.id && entry.snapshot.questionId === value.questionId, 50)
    && new Set(history.map(entry => (entry as RecordValue).id)).size === history.length);
}

/** Validate structure and references before any UI or rules consume imported data. Empty decision fields are valid work in progress. */
export function validateWorkspace(value: unknown): WorkspaceValidation {
  const fail = (error: string): WorkspaceValidation => ({ ok: false, error });
  if (!object(value) || value.version !== 1) return fail('This is not a supported GoodCall workspace (version 1).');
  const checks: Record<string, (item: unknown) => boolean> = {
    questions: item => object(item) && id(item.id) && string(item.handle, 1_000) && string(item.text) && oneOf(item.intent, INTENTS) && source(item.source) && ids(item.productIds) && optional(item.originalSource, source) && optional(item.addedAt, date),
    products: item => object(item) && id(item.id) && ['name', 'type', 'skin', 'finish', 'note'].every(key => string(item[key])) && number(item.price) && number(item.score, 10) && source(item.source) && integer(item.revision),
    issues: item => object(item) && id(item.id) && ['title', 'description', 'nextAction'].every(key => string(item[key])) && oneOf(item.kind, ['Missing material', 'Conflicting information', 'Needs clarification']) && oneOf(item.area, ['Audience advice', 'Case-file report']) && oneOf(item.severity, ['Blocks affected answer', 'Needs review', 'Admin only']) && sources(item.sourceRefs) && ids(item.questionIds) && ids(item.productIds) && oneOf(item.status, ['Open', 'Checking', 'Resolved']) && optional(item.resolution, string) && optional(item.resolutionSource, string) && optional(item.resolvedAt, date),
    drafts: item => draft(item),
    cards: item => object(item) && id(item.id) && id(item.entityId) && oneOf(item.kind, ['question', 'product', 'note', 'draft', 'issue', 'evidence']) && typeof item.x === 'number' && Number.isFinite(item.x) && Math.abs(item.x) <= 10_000_000 && typeof item.y === 'number' && Number.isFinite(item.y) && Math.abs(item.y) <= 10_000_000,
    links: item => object(item) && id(item.id) && id(item.source) && id(item.target) && optional(item.evidenceOrigin, origin => oneOf(origin, ['generated', 'manual'])),
    activity: item => object(item) && id(item.id) && string(item.text) && date(item.at),
  };
  for (const [key, check] of Object.entries(checks)) {
    const items = value[key];
    if (!list(items, check)) return fail(`The ${key} data is incomplete, invalid or exceeds the workspace limits.`);
    if (new Set(items.map(item => (item as RecordValue).id)).size !== items.length) return fail(`The ${key} data contains repeated identifiers.`);
  }
  const workspace = value as unknown as Workspace;
  const productIds = new Set(workspace.products.map(item => item.id));
  const questionIds = new Set(workspace.questions.map(item => item.id));
  const sets = { question: questionIds, product: productIds, draft: new Set(workspace.drafts.map(item => item.id)), issue: new Set(workspace.issues.map(item => item.id)), note: new Set(mayaNotes.map(item => item.id)), evidence: new Set(CASE_EVIDENCE.map(item => item.id)) };
  if (workspace.questions.some(item => item.productIds.some(key => !productIds.has(key))) || workspace.issues.some(item => item.productIds.some(key => !productIds.has(key)) || item.questionIds.some(key => !questionIds.has(key)))) return fail('A question or issue refers to a missing product or question.');
  const relatedDraft = (item: Workspace['drafts'][number]) => questionIds.has(item.questionId) && item.productIds.every(key => productIds.has(key)) && Object.keys(item.productRevisions).every(key => productIds.has(key));
  if (workspace.drafts.some(item => !relatedDraft(item) || item.history?.some(entry => !relatedDraft(entry.snapshot)))) return fail('An answer or earlier draft refers to a missing question or product.');
  if (workspace.cards.some(item => !sets[item.kind].has(item.entityId))) return fail('A canvas card refers to a missing workspace item.');
  const cardIds = new Set(workspace.cards.map(item => item.id));
  if (workspace.links.some(item => !cardIds.has(item.source) || !cardIds.has(item.target))) return fail('A canvas connection refers to a missing card.');
  return { ok: true, workspace };
}

export function parseWorkspaceBackup(raw: string): WorkspaceValidation {
  if (new Blob([raw]).size > MAX_BACKUP_BYTES) return { ok: false, error: 'This file is too large. Workspace backups must be smaller than 5 MB.' };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (object(parsed) && 'format' in parsed) {
      if (parsed.format !== 'goodcall-workspace' || parsed.version !== 1 || !date(parsed.exportedAt)) return { ok: false, error: 'This backup format is not supported.' };
      return validateWorkspace(parsed.workspace);
    }
    return validateWorkspace(parsed);
  } catch { return { ok: false, error: 'The file could not be read as a workspace JSON backup.' }; }
}
