import { DEFAULT_AI_MODEL } from './aiTypes';
import type { AiRequest, AiResponse, AiStatus } from './aiTypes';

export const EMPTY_AI_STATUS: AiStatus = { configured: false, provider: 'openai', model: DEFAULT_AI_MODEL, source: 'none' };

async function call<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/ai/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-GoodCall-Client': 'canvas' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal, cache: 'no-store', credentials: 'same-origin',
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = result && typeof result === 'object' ? (result as { error?: { message?: unknown } }).error : undefined;
    throw new Error(typeof error?.message === 'string' ? error.message.slice(0, 400) : 'The AI connection is unavailable. Check AI settings and try again.');
  }
  if (!result || typeof result !== 'object') throw new Error('The AI service returned an unreadable response.');
  return result as T;
}

export const getAiStatus = (signal?: AbortSignal) => call<AiStatus>('status', undefined, signal);
export const connectAi = (apiKey: string, model: string) => call<AiStatus>('connect', { apiKey, model });
export const disconnectAi = () => call<AiStatus>('disconnect', {});
export const requestAiAnswer = (request: AiRequest, signal?: AbortSignal) => call<AiResponse>('answer', request, signal);
