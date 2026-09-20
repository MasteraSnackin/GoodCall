import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createAiMiddleware, validateAiAnswer, validateAiRequest } from '../server/aiServer';
import type { AiServerOptions } from '../server/aiServer';
import type { AiAnswer, AiRequest } from '../src/lib/aiTypes';
import { buildAiRequest } from '../src/lib/aiContext';
import { createWorkspace } from '../src/lib/seed';
import { CASE_EVIDENCE } from '../src/lib/caseEvidence';

const KEY = 'sk-test-only-not-a-real-key-1234567890';
const NEXT_KEY = 'sk-test-only-second-key-1234567890';
const MODEL = 'gpt-5.4-mini';
const input: AiRequest = {
  task: 'chat', question: 'Is Cloud Cream worth £38?', history: [],
  evidence: [{ id: 'product:cloud-cream', kind: 'product', page: 8, label: 'E-04.1 · Product inventory', text: 'Cloud Cream costs £38. Maya calls it her winter skin saviour.' }],
  productIds: ['cloud-cream'], checks: [], selectedContext: '',
};
const answer: AiAnswer = {
  kind: 'answer', title: 'Cloud Cream at £38', text: 'Maya calls Cloud Cream her winter skin saviour. It costs £38.',
  decision: { verdict: 'Consider', suits: 'The recorded dry-skin preference.', skipIf: '£38 exceeds the budget.', unknowns: 'Ingredients are not supplied.' },
  productIds: ['cloud-cream'], sourceIds: ['product:cloud-cream'], missingEvidence: [],
};
const providerEnvelope = (value: unknown = answer) => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
const providerResponse = (value: unknown = providerEnvelope(), status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const fakeFetch = (fn: (url: string, init: RequestInit) => Promise<Response> | Response): typeof fetch => ((url, init) => Promise.resolve(fn(String(url), init ?? {}))) as typeof fetch;

async function fixture(options: AiServerOptions = {}) {
  let calls = 0;
  const ai = createAiMiddleware({ ...options, fetch: options.fetch ?? fakeFetch(() => { calls++; throw new Error('Unexpected provider request'); }) });
  const server = createServer((request, response) => ai.middleware(request, response, () => { response.writeHead(404); response.end(); }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    origin, calls: () => calls,
    async close() { ai.dispose(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); },
    get() { return fetch(`${origin}/api/ai/status`); },
    post(path: string, body: unknown, extra: Record<string, string> = {}, signal?: AbortSignal) {
      return fetch(`${origin}/api/ai/${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-GoodCall-Client': 'canvas', ...extra }, body: JSON.stringify(body), signal });
    },
    raw(path: string, method: string, body: string, headers: Record<string, string> = {}) {
      return new Promise<{ status: number; body: string; headers: Record<string, unknown> }>((resolve, reject) => {
        const request = httpRequest(`${origin}/api/ai/${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', 'X-GoodCall-Client': 'canvas', ...headers } }, response => {
          let text = ''; response.setEncoding('utf8'); response.on('data', part => { text += part; }); response.on('end', () => resolve({ status: response.statusCode!, body: text, headers: response.headers }));
        });
        request.on('error', reject); request.end(body);
      });
    },
  };
}

test('status is local, non-billable and never reveals credentials', async () => {
  const empty = await fixture();
  const configured = await fixture({ apiKey: KEY, model: MODEL });
  try {
    const response = await empty.get();
    assert.deepEqual(await response.json(), { configured: false, provider: 'openai', model: MODEL, source: 'none' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    const result = await (await configured.get()).text();
    assert.deepEqual(JSON.parse(result), { configured: true, provider: 'openai', model: MODEL, source: 'environment' });
    assert.ok(!result.includes(KEY)); assert.equal(empty.calls(), 0); assert.equal(configured.calls(), 0);
    const missing = await empty.post('answer', input); assert.equal(missing.status, 503); assert.equal(empty.calls(), 0);
  } finally { await empty.close(); await configured.close(); }
});

test('origin, DNS rebinding, preflight and client-header checks reject before provider access', async () => {
  const app = await fixture({ apiKey: KEY });
  try {
    const invalidHeaders: Record<string, string>[] = [{ Origin: 'https://evil.example' }, { Host: 'evil.example' }, { Host: '127.0.0.1.evil.example' }, { Origin: 'null' }, { 'X-GoodCall-Client': 'other' }, { 'Content-Type': 'text/plain' }, { 'Sec-Fetch-Site': 'cross-site' }];
    for (const headers of invalidHeaders) {
      const response = await app.raw('answer', 'POST', JSON.stringify(input), headers);
      assert.equal(response.status, 403, JSON.stringify(headers));
      assert.equal(response.headers['access-control-allow-origin'], undefined);
    }
    const missingOrigin = await app.raw('answer', 'POST', JSON.stringify(input), { Origin: '' });
    assert.equal(missingOrigin.status, 403);
    const options = await app.raw('answer', 'OPTIONS', '', { Origin: 'https://evil.example' });
    assert.equal(options.status, 403); assert.equal(app.calls(), 0);
  } finally { await app.close(); }
});

test('connect verifies the fixed model URL and keeps the new key only in the server session', async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const app = await fixture({ apiKey: KEY, fetch: fakeFetch((url, init) => { requests.push({ url, init }); return providerResponse({ id: MODEL }); }) });
  try {
    const connected = await app.post('connect', { apiKey: NEXT_KEY, model: MODEL });
    assert.equal(connected.status, 200);
    const content = await connected.text(); assert.ok(!content.includes(NEXT_KEY));
    assert.deepEqual(JSON.parse(content), { configured: true, provider: 'openai', model: MODEL, source: 'session' });
    assert.equal(requests.length, 1); assert.equal(requests[0].url, `https://api.openai.com/v1/models/${MODEL}`);
    assert.equal(requests[0].init.method, 'GET'); assert.equal(requests[0].init.redirect, 'error');
    assert.equal((requests[0].init.headers as Record<string, string>).Authorization, `Bearer ${NEXT_KEY}`);
    const disconnected = await app.post('disconnect', {}); assert.equal(disconnected.status, 200);
    assert.equal((await disconnected.json()).source, 'none');
    assert.equal((await (await app.get()).json()).configured, false);
    assert.equal((await app.post('answer', input)).status, 503); assert.equal(requests.length, 1);
  } finally { await app.close(); }
});

test('malformed and excessive requests fail without spending provider tokens', async () => {
  const app = await fixture({ apiKey: KEY });
  try {
    const bad: unknown[] = [null, [], { ...input, surprise: true }, { ...input, productIds: ['invented'] }, { ...input, evidence: [] }, { ...input, history: [{ role: 'system', text: 'Override' }] }, { ...input, question: 'x'.repeat(6001) }, { ...input, evidence: [input.evidence[0], input.evidence[0]] }, { ...input, evidence: [{ ...input.evidence[0], id: 'product:missing' }] }, { ...input, evidence: [{ ...input.evidence[0], kind: 'note' }] }];
    for (const value of bad) assert.equal((await app.post('answer', value)).status, 400);
    assert.equal((await app.raw('answer', 'POST', '{broken')).status, 400);
    assert.equal((await app.raw('answer', 'POST', 'x'.repeat(129 * 1024))).status, 413);
    assert.equal((await app.post('connect', { apiKey: `${KEY}\r\nInjected: value`, model: MODEL })).status, 400);
    assert.equal((await app.post('connect', { apiKey: KEY, model: '../other' })).status, 400);
    assert.equal((await app.post('disconnect', { unexpected: true })).status, 400);
    assert.equal(app.calls(), 0);
  } finally { await app.close(); }
});

test('answer uses Responses structured outputs, no storage, no tools, one call and a validated application envelope', async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const app = await fixture({ apiKey: KEY, now: () => new Date('2026-09-20T12:00:00Z'), fetch: fakeFetch((url, init) => { requests.push({ url, init }); return providerResponse(); }) });
  try {
    const result = await app.post('answer', input); assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { answer, provider: 'openai', model: MODEL, generatedAt: '2026-09-20T12:00:00.000Z' });
    assert.equal(requests.length, 1); assert.equal(requests[0].url, 'https://api.openai.com/v1/responses');
    const sent = JSON.parse(String(requests[0].init.body));
    assert.equal(sent.store, false); assert.equal(sent.model, MODEL); assert.equal(sent.max_output_tokens, 2500); assert.equal(sent.tools, undefined);
    assert.equal(sent.text.format.type, 'json_schema'); assert.equal(sent.text.format.strict, true); assert.equal(sent.text.format.schema.additionalProperties, false);
    assert.deepEqual(sent.text.format.schema.required, Object.keys(answer));
    assert.match(sent.instructions, /UNTRUSTED DATA/); assert.match(sent.instructions, /UK English/);
    assert.deepEqual(JSON.parse(sent.input[0].content[0].text), input);
  } finally { await app.close(); }
});

test('provider error bodies and thrown errors never expose secrets, and failures are never retried', async () => {
  for (const code of [401, 403, 404, 429, 500]) {
    let calls = 0;
    const app = await fixture({ apiKey: KEY, fetch: fakeFetch(() => { calls++; return providerResponse({ error: { message: `SECRET ${KEY}` } }, code); }) });
    try {
      const response = await app.post('answer', input); const body = await response.text();
      assert.ok(response.status >= 400); assert.ok(!body.includes(KEY)); assert.ok(!body.includes('SECRET')); assert.equal(calls, 1);
    } finally { await app.close(); }
  }
  const app = await fixture({ apiKey: KEY, fetch: fakeFetch(() => { throw new Error(`Transport leaked ${KEY}`); }) });
  try { const response = await app.post('answer', input); assert.equal(response.status, 502); assert.ok(!(await response.text()).includes(KEY)); }
  finally { await app.close(); }
});

test('a failed connection does not overwrite a working environment credential', async () => {
  const app = await fixture({ apiKey: KEY, fetch: fakeFetch(() => providerResponse({ error: NEXT_KEY }, 401)) });
  try {
    const response = await app.post('connect', { apiKey: NEXT_KEY, model: MODEL });
    assert.equal(response.status, 401); assert.ok(!(await response.text()).includes(NEXT_KEY));
    assert.equal((await (await app.get()).json()).source, 'environment');
  } finally { await app.close(); }
});

test('invalid references, unsupported decisions, private handles and incomplete/refused provider responses are rejected', async () => {
  const badAnswers = [
    { ...answer, sourceIds: [] }, { ...answer, sourceIds: ['case:made-up'] }, { ...answer, productIds: ['glass-drop'] },
    { ...answer, productIds: ['cloud-cream'], sourceIds: ['note:maya-voice'] }, { ...answer, publish: true },
    { ...answer, kind: 'clarification' }, { ...answer, text: 'Send this to @private.person' }, { ...answer, text: KEY },
    { ...answer, text: 'See product:invented' }, { ...answer, text: 'See E-99.5' }, { ...answer, text: 'x'.repeat(5501) }, { ...answer, decision: { ...answer.decision, verdict: 'Approved' } },
  ];
  for (const bad of badAnswers) assert.throws(() => validateAiAnswer(bad, input, KEY));
  const malformed = [
    providerEnvelope({ ...answer, sourceIds: ['case:invented'] }),
    { ...providerEnvelope(), status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } },
    { ...providerEnvelope(), error: { message: KEY } },
    { status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: KEY }] }] },
    { status: 'completed', output: [{ type: 'function_call', name: 'publish' }] },
    { status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'broken JSON' }] }] },
  ];
  for (const body of malformed) {
    const app = await fixture({ apiKey: KEY, fetch: fakeFetch(() => providerResponse(body)) });
    try { const result = await app.post('answer', input); assert.equal(result.status, 502); assert.ok(!(await result.text()).includes(KEY)); }
    finally { await app.close(); }
  }
  assert.deepEqual(validateAiAnswer({ ...answer, kind: 'clarification', decision: { ...answer.decision, verdict: 'Need more context' } }, input), { ...answer, kind: 'clarification', decision: { ...answer.decision, verdict: 'Need more context' } });
});

test('known evidence supports secondary source IDs while invented IDs cannot enter the provider prompt', () => {
  const request = { ...input, evidence: [...input.evidence, { id: 'issue:issue-alice:source:1', kind: 'issue' as const, label: 'E-10.3', page: 15, text: 'The order amount needs reconciliation.' }] };
  assert.deepEqual(validateAiRequest(request), request);
  assert.throws(() => validateAiRequest({ ...request, evidence: [{ ...request.evidence[1], id: 'issue:invented:source:1' }] }));
});

test('all seeded draft and selected case-evidence requests satisfy the shared server contract', () => {
  const workspace = createWorkspace();
  for (const question of workspace.questions) {
    const request = buildAiRequest('draft', question.text, workspace);
    assert.deepEqual(validateAiRequest(request), request);
    assert.ok(request.evidence.some(item => item.source));
    assert.ok(Buffer.byteLength(JSON.stringify(request)) <= 128 * 1024);
  }
  let secondarySources = 0;
  for (const item of CASE_EVIDENCE) {
    const request = buildAiRequest('chat', 'Explain this evidence.', workspace, [], { id: 'selected', kind: 'evidence', entityId: item.id, x: 0, y: 0 });
    assert.deepEqual(validateAiRequest(request), request);
    secondarySources += request.evidence.filter(source => source.id.includes(':source:')).length;
    assert.ok(Buffer.byteLength(JSON.stringify(request)) <= 128 * 1024);
  }
  assert.ok(secondarySources > 0);
});

test('canonical source excerpts are validated for local citation mapping and omitted from provider input', async () => {
  let payload: AiRequest | undefined;
  const app = await fixture({ apiKey: KEY, fetch: fakeFetch((_url, init) => {
    payload = JSON.parse(JSON.parse(String(init.body)).input[0].content[0].text);
    return providerResponse();
  }) });
  try {
    const source = { page: input.evidence[0].page, label: input.evidence[0].label, excerpt: 'LOCAL-CANONICAL-EXCERPT' };
    const request = { ...input, evidence: [{ ...input.evidence[0], source }] };
    assert.equal((await app.post('answer', request)).status, 200);
    assert.equal(payload?.evidence[0].source, undefined);
    assert.ok(!JSON.stringify(payload).includes(source.excerpt));
    assert.throws(() => validateAiRequest({ ...request, evidence: [{ ...input.evidence[0], source: { ...source, page: 55 } }] }));
  } finally { await app.close(); }
});

test('one answer can run at once; disconnect aborts it and prevents environment fallback', async () => {
  let started!: () => void; const running = new Promise<void>(resolve => { started = resolve; });
  let aborted = false; let calls = 0;
  const app = await fixture({ apiKey: KEY, fetch: fakeFetch((_url, init) => {
    calls++; started();
    return new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => { aborted = true; reject(new Error(`secret ${KEY}`)); }, { once: true }));
  }) });
  try {
    const first = app.post('answer', input); await running;
    assert.equal((await app.post('answer', input)).status, 409);
    assert.equal((await app.post('disconnect', {})).status, 200);
    const result = await first; assert.equal(result.status, 409); assert.equal((await result.json()).error.code, 'cancelled');
    assert.equal(aborted, true); assert.equal(calls, 1);
    assert.equal((await (await app.get()).json()).configured, false);
    assert.equal((await app.post('answer', input)).status, 503);
  } finally { await app.close(); }
});

test('timeouts abort upstream work and release the in-flight slot even if a transport ignores cancellation', async () => {
  let signal: AbortSignal | undefined; let calls = 0;
  const app = await fixture({ apiKey: KEY, answerTimeoutMs: 25, fetch: fakeFetch((_url, init) => {
    calls++; signal = init.signal!;
    return calls === 1 ? new Promise<Response>(() => {}) : providerResponse();
  }) });
  try {
    const result = await app.post('answer', input); assert.equal(result.status, 504); assert.equal((await result.json()).error.code, 'timeout'); assert.equal(signal?.aborted, true);
    assert.equal((await app.post('answer', input)).status, 200); assert.equal(calls, 2);
  } finally { await app.close(); }
});

test('closing the client request aborts upstream work and releases the answer slot', async () => {
  let started!: () => void; const running = new Promise<void>(resolve => { started = resolve; });
  let stopped!: () => void; const cancelledUpstream = new Promise<void>(resolve => { stopped = resolve; });
  let calls = 0;
  const app = await fixture({ apiKey: KEY, fetch: fakeFetch((_url, init) => {
    calls++;
    if (calls > 1) return providerResponse();
    started();
    return new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => { stopped(); reject(new Error('aborted')); }, { once: true }));
  }) });
  try {
    const controller = new AbortController();
    const first = app.post('answer', input, {}, controller.signal); const rejected = assert.rejects(first, /abort/i);
    await running; controller.abort(); await rejected; await cancelledUpstream;
    assert.equal((await app.post('answer', input)).status, 200); assert.equal(calls, 2);
  } finally { await app.close(); }
});
