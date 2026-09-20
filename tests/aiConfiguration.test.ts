import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAiConfiguration } from '../server/aiConfiguration';

test('a fresh local server offers Claude without inventing a credential', () => {
  assert.deepEqual(resolveAiConfiguration({}), { provider: 'anthropic', apiKey: undefined, model: 'claude-haiku-4-5-20251001' });
});

test('explicit provider selects only its matching key and model', () => {
  const env = { ANTHROPIC_API_KEY: 'anthropic-test-value', ANTHROPIC_MODEL: 'claude-custom', OPENAI_API_KEY: 'openai-test-value', OPENAI_MODEL: 'gpt-custom' };
  assert.deepEqual(resolveAiConfiguration({ ...env, AI_PROVIDER: 'anthropic' }), { provider: 'anthropic', apiKey: env.ANTHROPIC_API_KEY, model: 'claude-custom' });
  assert.deepEqual(resolveAiConfiguration({ ...env, AI_PROVIDER: 'openai' }), { provider: 'openai', apiKey: env.OPENAI_API_KEY, model: 'gpt-custom' });
  assert.equal(resolveAiConfiguration({ AI_PROVIDER: 'anthropic', OPENAI_API_KEY: 'do-not-use' }).apiKey, undefined);
  assert.equal(resolveAiConfiguration({ AI_PROVIDER: 'openai', ANTHROPIC_API_KEY: 'do-not-use' }).apiKey, undefined);
});

test('existing OpenAI configuration remains supported and invalid selectors fail clearly', () => {
  assert.equal(resolveAiConfiguration({ OPENAI_API_KEY: 'legacy-test-value' }).provider, 'openai');
  assert.equal(resolveAiConfiguration({ ANTHROPIC_API_KEY: 'a-test-value', OPENAI_API_KEY: 'b-test-value' }).provider, 'anthropic');
  assert.throws(() => resolveAiConfiguration({ AI_PROVIDER: 'untrusted-provider' }), /must be anthropic or openai/);
});
