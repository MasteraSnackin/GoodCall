import { draftAnswer, groupQuestion, validateDraft } from './engine';
import { isDecisionProfile } from './decisionTypes';
import type { Draft, Question, Workspace } from './types';

const productKey = (ids: string[]) => [...new Set(ids)].sort().join('|');

/** Matching topic and products suggest a starting point; they do not establish personal fit. */
export function findReusableAnswers(question: Question, workspace: Workspace): Draft[] {
  const resolved = draftAnswer(question, workspace.products).productIds;
  if (!resolved.length) return [];
  const key = productKey(resolved);
  const intent = groupQuestion(question.text);
  return workspace.drafts.filter(draft => {
    if (draft.questionId === question.id || !['approved', 'published'].includes(draft.status)) return false;
    if (!isDecisionProfile(draft.decision) || productKey(draft.productIds) !== key) return false;
    const original = workspace.questions.find(item => item.id === draft.questionId);
    if (!original || groupQuestion(original.text) !== intent) return false;
    return validateDraft(draft, workspace).length === 0;
  });
}

/** Copy a currently reviewed candidate into a fresh, unapproved draft for this question. */
export function reuseAnswer(question: Question, source: Draft, workspace: Workspace): Draft {
  // Use the canonical workspace record, rather than accepting stale or substituted copy text.
  const candidate = findReusableAnswers(question, workspace).find(item => item.id === source.id);
  if (!candidate || !isDecisionProfile(candidate.decision)) {
    throw new Error('This answer is no longer an eligible reviewed starting point. Generate a fresh draft and review its evidence.');
  }
  const fresh = draftAnswer(question, workspace.products);
  return {
    ...fresh,
    title: candidate.title,
    text: candidate.text,
    decision: { ...candidate.decision },
    reusedFrom: { draftId: candidate.id, title: candidate.title, ...(candidate.approvedAt ? { approvedAt: candidate.approvedAt } : {}) },
    // fresh carries this question’s evidence and current product revisions. Review state,
    // publication IDs and original audience-source references are deliberately not inherited.
    status: 'draft',
  };
}
