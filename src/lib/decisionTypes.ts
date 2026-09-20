/** Public, creator-reviewed guidance; never contains inbox metadata. */
export interface DecisionProfile {
  verdict: 'Consider' | 'Skip for now' | 'Need more context';
  suits: string;
  skipIf: string;
  unknowns: string;
}
export interface ReuseReference {
  draftId: string;
  title: string;
  approvedAt?: string;
}
export const DECISION_VERDICTS: DecisionProfile['verdict'][] = ['Consider', 'Skip for now', 'Need more context'];
export const DECISION_FIELD_LIMIT = 800;
export function isDecisionProfile(value: unknown): value is DecisionProfile {
  if (!value || typeof value !== 'object') return false;
  const item = value as DecisionProfile;
  return DECISION_VERDICTS.includes(item.verdict) && [item.suits,item.skipIf,item.unknowns].every(text => typeof text === 'string' && text.trim().length > 0 && text.length <= DECISION_FIELD_LIMIT);
}
