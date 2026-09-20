import type { DecisionProfile } from './decisionTypes';
import type { SourceRef } from './types';

export type AiProvider = 'openai' | 'anthropic';
export const DEFAULT_AI_PROVIDER: AiProvider = 'anthropic';
export const AI_DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-haiku-4-5-20251001',
};
export const AI_PROVIDER_LABELS: Record<AiProvider, string> = { openai: 'OpenAI', anthropic: 'Claude' };
export const DEFAULT_AI_MODEL = AI_DEFAULT_MODELS[DEFAULT_AI_PROVIDER];
export interface AiStatus {
  configured: boolean;
  provider: AiProvider;
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
  provider: AiProvider;
  model: string;
  generatedAt: string;
}
export interface AiDraftMetadata {
  provider: AiProvider;
  model: string;
  generatedAt: string;
  missingEvidence: string[];
}
