import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createAiMiddleware } from '../server/aiServer';
import type { AiServerOptions } from '../server/aiServer';
import type { AiAnswer, AiRequest } from '../src/lib/aiTypes';

const input: AiRequest = {
  task: 'chat', question: 'Is Cloud Cream worth £38?', history: [],
  evidence: [{ id: 'product:cloud-cream', kind: 'product', page: 8, label: 'E-04.1', text: 'Cloud Cream costs £38.' }],
  productIds: ['cloud-cream'], checks: [], selectedContext: '',
};
const answer: AiAnswer = {
  kind: 'answer', title: 'Cloud Cream', text: 'Cloud Cream costs £38.',
  decision: { verdict: 'Consider', suits: 'The recorded rich finish.', skipIf: 'The cost exceeds your budget.', unknowns: 'The existing routine.' },
  productIds: ['cloud-cream'], sourceIds: ['product:cloud-cream'], missingEvidence: [],
};
async function fixture(options: AiServerOptions) {
  const ai = createAiMiddleware(options);
  const server = createServer((request, response) => ai.middleware(request, response, () => { response.writeHead(404); response.end(); }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    post(body: unknown) {
      return fetch(`${origin}/api/ai/answer`, {
        method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-GoodCall-Client': 'canvas' }, body: JSON.stringify(body),
      });
    },
    async close() { ai.dispose(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); },
  };
}

test('malformed request enums and inherited evidence kinds return controlled 400s without provider calls', async () => {
  let calls = 0;
  const app = await fixture({ provider: 'openai', apiKey: 'sk-test-boundary-not-a-real-key', fetch: async () => { calls++; throw new Error('No provider request is expected.'); } });
  const bad: unknown[] = [
    ...[['chat'], [['chat']], { toString: null }, {}, null, 1, true].map(task => ({ ...input, task })),
    ...[['user'], [['assistant']], { toString: null }, {}, null, 1, true].map(role => ({ ...input, history: [{ role, text: 'Hello' }] })),
    ...['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty', ['product'], null].map(kind => ({
      ...input, productIds: [], evidence: [{ ...input.evidence[0], kind, id: 'undefineddraft-example' }],
    })),
  ];
  try {
    for (const value of bad) {
      const response = await app.post(value);
      assert.equal(response.status, 400, JSON.stringify(value));
      assert.equal((await response.json()).error.code, 'invalid_request');
    }
    assert.equal(calls, 0);
  } finally { await app.close(); }
});

test('both providers reject malformed answer enums with controlled 502s and cannot bypass source checks', async () => {
  const bad: unknown[] = [
    ...[['answer'], [['answer']], ['clarification'], { toString: null }, {}, null, 1, true].map(kind => ({ ...answer, kind })),
    ...[['Consider'], [['Consider']], { toString: null }, {}, null, 1, true].map(verdict => ({ ...answer, decision: { ...answer.decision, verdict } })),
    { ...answer, kind: ['answer'], productIds: [], sourceIds: [] },
    { ...answer, kind: ['clarification'], decision: { ...answer.decision, verdict: 'Consider' } },
    { ...answer, productIds: [], sourceIds: [] },
  ];
  for (const provider of ['openai', 'anthropic'] as const) {
    let current: unknown, calls = 0;
    const app = await fixture({
      provider, apiKey: provider === 'anthropic' ? 'sk-ant-test-boundary-not-a-real-key' : 'sk-test-boundary-not-a-real-key',
      fetch: async () => {
        calls++;
        const body = provider === 'anthropic'
          ? { type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(current) }] }
          : { status: 'completed', output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(current) }] }] };
        return new Response(JSON.stringify(body));
      },
    });
    try {
      for (const value of bad) {
        current = value;
        const response = await app.post(input);
        assert.equal(response.status, 502, `${provider}: ${JSON.stringify(value)}`);
        assert.equal((await response.json()).error.code, 'invalid_provider_response');
      }
      assert.equal(calls, bad.length, 'failed answers must not cause retries');
      current = { ...answer, kind: 'clarification', decision: { ...answer.decision, verdict: 'Need more context' }, productIds: [], sourceIds: [] };
      assert.equal((await app.post(input)).status, 200, 'a valid clarification may still have no sources');
    } finally { await app.close(); }
  }
});
