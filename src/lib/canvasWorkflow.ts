import type { Workspace } from './types';

/** Private workflow tracking. These records are not follower replies or source evidence. */
export interface QuestionFollowUp {
  id: string;
  questionId: string;
  prompt: string;
  status: 'Waiting for reply' | 'Context received';
  createdAt: string;
  updatedAt: string;
}

/** A visual grouping of existing evidence cards; membership creates no evidence links. */
export interface DecisionSection {
  id: string;
  title: string;
  cardIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type WorkflowWorkspace = Workspace & {
  questionFollowUps?: QuestionFollowUp[];
  decisionSections?: DecisionSection[];
};
export const FOLLOW_UP_LIMIT = 500;
export const FOLLOW_UP_PROMPT_LIMIT = 1000;
export const DECISION_SECTION_LIMIT = 100;
export const DECISION_SECTION_TITLE_LIMIT = 120;
export const DECISION_SECTION_MEMBER_LIMIT = 1000;
const validText = (value: string, limit: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
const validId = (value: string) => validText(value, 200) && !['__proto__', 'constructor', 'prototype'].includes(value);
const validDate = (value: string) => typeof value === 'string' && value.length <= 100 && Number.isFinite(Date.parse(value));
const freshId = (kind: string) => `${kind}-${globalThis.crypto.randomUUID()}`;
const takenId = (workspace: WorkflowWorkspace, id: string) => [
  ...workspace.cards, ...(workspace.reviewNotes ?? []), ...(workspace.questionFollowUps ?? []), ...(workspace.decisionSections ?? []),
].some(item => item.id === id);

/** One tracking record per question. Editing its wording reopens a received follow-up. */
export function setQuestionFollowUp(workspace: WorkflowWorkspace, questionId: string, prompt: string, now = new Date().toISOString(), id = freshId('follow-up')): WorkflowWorkspace {
  if (!workspace.questions.some(question => question.id === questionId) || !validText(prompt, FOLLOW_UP_PROMPT_LIMIT) || !validDate(now)) return workspace;
  const cleanPrompt = prompt.trim();
  const records = workspace.questionFollowUps ?? [];
  const existing = records.find(item => item.questionId === questionId);
  if (existing) {
    if (existing.prompt === cleanPrompt) return workspace;
    return { ...workspace, questionFollowUps: records.map(item => item.id === existing.id ? { ...item, prompt: cleanPrompt, status: 'Waiting for reply', updatedAt: now } : item) };
  }
  if (records.length >= FOLLOW_UP_LIMIT || !validId(id) || takenId(workspace, id)) return workspace;
  return { ...workspace, questionFollowUps: [...records, { id, questionId, prompt: cleanPrompt, status: 'Waiting for reply', createdAt: now, updatedAt: now }] };
}

export function setFollowUpStatus(workspace: WorkflowWorkspace, followUpId: string, status: QuestionFollowUp['status'], now = new Date().toISOString()): WorkflowWorkspace {
  const records = workspace.questionFollowUps ?? [];
  const existing = records.find(item => item.id === followUpId);
  if (!existing || existing.status === status || !['Waiting for reply', 'Context received'].includes(status) || !validDate(now)) return workspace;
  return { ...workspace, questionFollowUps: records.map(item => item.id === followUpId ? { ...item, status, updatedAt: now } : item) };
}

export function removeQuestionFollowUp(workspace: WorkflowWorkspace, followUpId: string): WorkflowWorkspace {
  if (!workspace.questionFollowUps?.some(item => item.id === followUpId)) return workspace;
  return { ...workspace, questionFollowUps: workspace.questionFollowUps.filter(item => item.id !== followUpId) };
}

/** Ignores stale IDs and private review notes, which never enter the evidence card collection. */
export function getDecisionSectionCardIds(workspace: Workspace, section: Pick<DecisionSection, 'cardIds'>): string[] {
  const known = new Set(workspace.cards.map(card => card.id));
  return [...new Set(section.cardIds)].filter(id => known.has(id));
}

function sectionMembers(workspace: Workspace, cardIds: string[]): string[] | null {
  if (!Array.isArray(cardIds) || cardIds.length > DECISION_SECTION_MEMBER_LIMIT || !cardIds.every(validId)) return null;
  const members = getDecisionSectionCardIds(workspace, { cardIds });
  return members.length ? members : null;
}

export function createDecisionSection(workspace: WorkflowWorkspace, title: string, cardIds: string[], now = new Date().toISOString(), id = freshId('section')): WorkflowWorkspace {
  const members = sectionMembers(workspace, cardIds);
  const sections = workspace.decisionSections ?? [];
  if (!members || !validText(title, DECISION_SECTION_TITLE_LIMIT) || sections.length >= DECISION_SECTION_LIMIT || !validDate(now) || !validId(id) || takenId(workspace, id)) return workspace;
  return { ...workspace, decisionSections: [...sections, { id, title: title.trim(), cardIds: members, createdAt: now, updatedAt: now }] };
}

export function renameDecisionSection(workspace: WorkflowWorkspace, sectionId: string, title: string, now = new Date().toISOString()): WorkflowWorkspace {
  const existing = workspace.decisionSections?.find(item => item.id === sectionId);
  if (!existing || !validText(title, DECISION_SECTION_TITLE_LIMIT) || existing.title === title.trim() || !validDate(now)) return workspace;
  return { ...workspace, decisionSections: workspace.decisionSections!.map(item => item.id === sectionId ? { ...item, title: title.trim(), updatedAt: now } : item) };
}

export function replaceDecisionSectionMembers(workspace: WorkflowWorkspace, sectionId: string, cardIds: string[], now = new Date().toISOString()): WorkflowWorkspace {
  const existing = workspace.decisionSections?.find(item => item.id === sectionId);
  const members = sectionMembers(workspace, cardIds);
  if (!existing || !members || !validDate(now) || (existing.cardIds.length === members.length && existing.cardIds.every((id, index) => id === members[index]))) return workspace;
  return { ...workspace, decisionSections: workspace.decisionSections!.map(item => item.id === sectionId ? { ...item, cardIds: members, updatedAt: now } : item) };
}

export function removeDecisionSection(workspace: WorkflowWorkspace, sectionId: string): WorkflowWorkspace {
  if (!workspace.decisionSections?.some(item => item.id === sectionId)) return workspace;
  return { ...workspace, decisionSections: workspace.decisionSections.filter(item => item.id !== sectionId) };
}
