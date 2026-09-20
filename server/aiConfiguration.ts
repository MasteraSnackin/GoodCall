import { AI_DEFAULT_MODELS, DEFAULT_AI_PROVIDER } from '../src/lib/aiTypes';
import type { AiProvider } from '../src/lib/aiTypes';

/** Select one provider without ever substituting the other provider's credential. */
export function resolveAiConfiguration(env: Record<string, string | undefined>) {
  const configured = env.AI_PROVIDER?.trim();
  if (configured && configured !== 'anthropic' && configured !== 'openai') {
    throw new Error('AI_PROVIDER must be anthropic or openai.');
  }
  const provider: AiProvider = configured === 'anthropic' || configured === 'openai'
    ? configured
    : env.ANTHROPIC_API_KEY ? 'anthropic' : env.OPENAI_API_KEY ? 'openai' : DEFAULT_AI_PROVIDER;
  const prefix = provider === 'anthropic' ? 'ANTHROPIC' : 'OPENAI';
  return { provider, apiKey: env[`${prefix}_API_KEY`], model: env[`${prefix}_MODEL`] || AI_DEFAULT_MODELS[provider] };
}
