import type { DecisionProfile } from './decisionTypes';
import type { SourceRef } from './types';

export const DEFAULT_AI_MODEL = 'gpt-5.4-mini';
export interface AiStatus {
  configured: boolean;
  provider: 'openai';
  model: string;
  source: 'environment' | 'session' | 'none';
}
export interface AiEvidence {
  id: string;
  kind: 'product' | 'note' | 'issue' | 'case-evidence' | 'reviewed-answer';
  label: string;
  page: number;
  text: string;
  source?: SourceRef;
}
export interface AiRequest {
  task: 'draft' | 'chat';
  question: string;
  history: { role: 'user' | 'assistant'; text: string }[];
  evidence: AiEvidence[];
  productIds: string[];
  checks: string[];
  selectedContext: string;
}
export interface AiAnswer {
  kind: 'answer' | 'clarification';
  title: string;
  text: string;
  decision: DecisionProfile;
  productIds: string[];
  sourceIds: string[];
  missingEvidence: string[];
}
export interface AiResponse {
  answer: AiAnswer;
  provider: 'openai';
  model: string;
  generatedAt: string;
}
export interface AiDraftMetadata {
  provider: 'openai';
  model: string;
  generatedAt: string;
  missingEvidence: string[];
}
