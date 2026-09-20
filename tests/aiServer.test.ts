import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ANSWER_SCHEMA, createAiMiddleware, requestAnthropicAnswer, requestOpenAiAnswer, validateAiAnswer, validateAiRequest } from '../server/aiServer';
import type { AiServerOptions } from '../server/aiServer';
import type { AiAnswer, AiRequest } from '../src/lib/aiTypes';
import { AI_DEFAULT_MODELS } from '../src/lib/aiTypes';
import { buildAiRequest } from '../src/lib/aiContext';
import { createWorkspace } from '../src/lib/seed';
import { CASE_EVIDENCE } from '../src/lib/caseEvidence';

const KEY = 'sk-test-only-not-a-real-key-1234567890';
const NEXT_KEY = 'sk-test-only-second-key-1234567890';
const MODEL = AI_DEFAULT_MODELS.openai;
const CLAUDE_MODEL = AI_DEFAULT_MODELS.anthropic;
const CLAUDE_KEY = 'sk-ant-test-only-not-a-real-key-1234567890';
const PREVIOUS_MODEL = 'gpt-5.4-mini-2026-03-17';
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
  const ai = createAiMiddleware({ provider: 'openai', ...options, fetch: options.fetch ?? fakeFetch(() => { calls++; throw new Error('Unexpected provider request'); }) });
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

test('model switching reuses the existing key, preserves its source and updates subsequent answers', async () => {
  for (const source of ['environment', 'session'] as const) {
    const requests: { url: string; init: RequestInit }[] = [];
    const app = await fixture({ apiKey: source === 'environment' ? KEY : undefined, model: PREVIOUS_MODEL, fetch: fakeFetch((url, init) => {
      requests.push({ url, init }); return providerResponse(url.endsWith('/responses') ? providerEnvelope() : { id: MODEL });
    }) });
    try {
      if (source === 'session') assert.equal((await app.post('connect', { apiKey: KEY, model: PREVIOUS_MODEL })).status, 200);
      requests.length = 0;
      const result = await app.post('model', { model: MODEL });
      assert.equal(result.status, 200);
      const content = await result.text(); assert.ok(!content.includes(KEY));
      assert.deepEqual(JSON.parse(content), { configured: true, provider: 'openai', model: MODEL, source });
      assert.equal(requests.length, 1); assert.equal(requests[0].url, `https://api.openai.com/v1/models/${MODEL}`);
      assert.equal(requests[0].init.method, 'GET'); assert.equal(requests[0].init.redirect, 'error');
      assert.equal((requests[0].init.headers as Record<string, string>).Authorization, `Bearer ${KEY}`);
      assert.equal(requests[0].init.body, undefined);
      const response = await app.post('answer', input); assert.equal(response.status, 200);
      assert.equal((await response.json()).model, MODEL);
      assert.equal(JSON.parse(String(requests[1].init.body)).model, MODEL);
      assert.equal((requests[1].init.headers as Record<string, string>).Authorization, `Bearer ${KEY}`);
    } finally { await app.close(); }
  }
});

test('model switching needs a configured key and validates the local request before provider access', async () => {
  const empty = await fixture(); const configured = await fixture({ apiKey: KEY, model: PREVIOUS_MODEL });
  try {
    const missing = await empty.post('model', { model: MODEL });
    assert.equal(missing.status, 503); assert.equal((await missing.json()).error.code, 'not_configured');
    for (const body of [null, {}, { model: '../outside' }, { model: MODEL, apiKey: NEXT_KEY }, { model: 'x'.repeat(101) }]) {
      assert.equal((await configured.post('model', body)).status, 400);
    }
    assert.equal((await configured.post('model', { model: MODEL }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await configured.post('model', { model: MODEL }, { 'X-GoodCall-Client': 'other' })).status, 403);
    assert.equal((await configured.post('model', { model: MODEL }, { 'Content-Type': 'text/plain' })).status, 403);
    assert.equal(empty.calls(), 0); assert.equal(configured.calls(), 0);
  } finally { await empty.close(); await configured.close(); }
});

test('failed model validation leaves the previous model and credential intact', async () => {
  let calls = 0;
  const app = await fixture({ apiKey: KEY, model: PREVIOUS_MODEL, fetch: fakeFetch((url, init) => {
    calls++;
    assert.equal((init.headers as Record<string, string>).Authorization, `Bearer ${KEY}`);
    return url.endsWith('/responses') ? providerResponse() : providerResponse({ error: { message: KEY } }, 404);
  }) });
  try {
    const result = await app.post('model', { model: MODEL });
    assert.equal(result.status, 502); assert.ok(!(await result.text()).includes(KEY));
    assert.deepEqual(await (await app.get()).json(), { configured: true, provider: 'openai', model: PREVIOUS_MODEL, source: 'environment' });
    const response = await app.post('answer', input); assert.equal(response.status, 200);
    assert.equal((await response.json()).model, PREVIOUS_MODEL); assert.equal(calls, 2);
  } finally { await app.close(); }
});

test('model validation is mutually exclusive with answers and connections, and disconnect cancels it', async () => {
  let started!: () => void; const running = new Promise<void>(resolve => { started = resolve; });
  let providerSignal: AbortSignal | undefined; let calls = 0;
  const app = await fixture({ apiKey: KEY, model: PREVIOUS_MODEL, fetch: fakeFetch((_url, init) => {
    calls++; providerSignal = init.signal!; started();
    return new Promise<Response>(() => {}); // A transport ignoring abort must not commit late state.
  }) });
  try {
    const first = app.post('model', { model: MODEL }); await running;
    assert.equal((await (await app.get()).json()).model, PREVIOUS_MODEL);
    assert.equal((await app.post('model', { model: MODEL })).status, 409);
    assert.equal((await app.post('connect', { apiKey: NEXT_KEY, model: MODEL })).status, 409);
    assert.equal((await app.post('answer', input)).status, 409);
    assert.equal((await app.post('disconnect', {})).status, 200);
    const result = await first; assert.equal(result.status, 409); assert.equal((await result.json()).error.code, 'cancelled');
    assert.equal(providerSignal?.aborted, true); assert.equal(calls, 1);
    assert.equal((await (await app.get()).json()).configured, false);
  } finally { await app.close(); }
});

test('an in-flight answer rejects model switching without making a model-access request', async () => {
  let started!: () => void; const running = new Promise<void>(resolve => { started = resolve; });
  let calls = 0;
  const app = await fixture({ apiKey: KEY, fetch: fakeFetch(() => { calls++; started(); return new Promise<Response>(() => {}); }) });
  try {
    const first = app.post('answer', input); await running;
    assert.equal((await app.post('model', { model: MODEL })).status, 409); assert.equal(calls, 1);
    await app.post('disconnect', {}); assert.equal((await first).status, 409);
  } finally { await app.close(); }
});

test('timed-out and client-cancelled model changes preserve the previous model and release the slot', async () => {
  let calls = 0; let timedOutSignal: AbortSignal | undefined;
  const timed = await fixture({ apiKey: KEY, model: PREVIOUS_MODEL, connectTimeoutMs: 25, fetch: fakeFetch((_url, init) => {
    calls++; timedOutSignal = init.signal!; return calls === 1 ? new Promise<Response>(() => {}) : providerResponse({ id: MODEL });
  }) });
  try {
    const result = await timed.post('model', { model: MODEL }); assert.equal(result.status, 504); assert.equal(timedOutSignal?.aborted, true);
    assert.equal((await (await timed.get()).json()).model, PREVIOUS_MODEL);
    assert.equal((await timed.post('model', { model: MODEL })).status, 200);
  } finally { await timed.close(); }

  let started!: () => void; const running = new Promise<void>(resolve => { started = resolve; });
  let stopped!: () => void; const cancelledUpstream = new Promise<void>(resolve => { stopped = resolve; });
  let attempts = 0;
  const app = await fixture({ apiKey: KEY, model: PREVIOUS_MODEL, fetch: fakeFetch((_url, init) => {
    attempts++; if (attempts > 1) return providerResponse({ id: MODEL });
    started();
    return new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => { stopped(); reject(new Error(KEY)); }, { once: true }));
  }) });
  try {
    const controller = new AbortController();
    const first = app.post('model', { model: MODEL }, {}, controller.signal); const rejected = assert.rejects(first, /abort/i);
    await running; controller.abort(); await rejected; await cancelledUpstream;
    assert.equal((await (await app.get()).json()).model, PREVIOUS_MODEL);
    assert.equal((await app.post('model', { model: MODEL })).status, 200);
  } finally { await app.close(); }
});

test('429 errors use allowlisted billing and rate-limit codes without disclosing provider prose or retrying', async () => {
  const cases: [Record<string, unknown>, string, RegExp][] = [
    [{ code: 'credit_balance_exhausted', type: 'insufficient_quota' }, 'provider_credit_balance_exhausted', /prepaid API credit balance is exhausted/],
    [{ code: 'organization_spend_limit_exceeded', type: 'insufficient_quota' }, 'provider_organization_spend_limit', /organisation spend limit/],
    [{ code: 'project_spend_limit_exceeded', type: 'insufficient_quota' }, 'provider_project_spend_limit', /project spend limit/],
    [{ code: 'organization_usage_limit_exceeded', type: 'insufficient_quota' }, 'provider_organization_usage_limit', /organisation usage limit/],
    [{ code: 'insufficient_quota' }, 'provider_insufficient_quota', /insufficient API quota/],
    [{ code: 'unknown', type: 'insufficient_quota' }, 'provider_insufficient_quota', /insufficient API quota/],
    [{ code: 'rate_limit_exceeded' }, 'provider_rate_limit', /temporary rate limit/],
    [{ code: 'slow_down', type: 'rate_limit_error' }, 'provider_rate_limit', /temporary rate limit/],
    [{ type: 'rate_limit_error' }, 'provider_rate_limit', /temporary rate limit/],
    [{ code: 'unknown', type: 'unknown' }, 'provider_rate_limit_or_quota', /cause was not specified/],
    [{ code: '__proto__', type: 'constructor' }, 'provider_rate_limit_or_quota', /cause was not specified/],
    [{ code: { toString: 'insufficient_quota' } }, 'provider_rate_limit_or_quota', /cause was not specified/],
  ];
  for (const [details, expectedCode, message] of cases) {
    let calls = 0;
    const app = await fixture({ apiKey: KEY, fetch: fakeFetch(() => { calls++; return providerResponse({ error: { ...details, message: `SECRET ${KEY}`, organisation: 'PRIVATE_ACCOUNT' } }, 429); }) });
    try {
      const result = await app.post('answer', input); assert.equal(result.status, 429);
      const text = await result.text(); const error = JSON.parse(text).error;
      assert.equal(error.code, expectedCode); assert.match(error.message, message);
      assert.ok(!text.includes(KEY)); assert.ok(!text.includes('SECRET')); assert.ok(!text.includes('PRIVATE_ACCOUNT')); assert.equal(calls, 1);
    } finally { await app.close(); }
  }
});

test('malformed and oversized provider errors retain a safe 429 fallback and failed model changes remain atomic', async () => {
  for (const body of ['broken JSON', JSON.stringify({ error: { code: 'credit_balance_exhausted', message: KEY.repeat(1000) } })]) {
    let calls = 0;
    const app = await fixture({ apiKey: KEY, model: PREVIOUS_MODEL, fetch: fakeFetch(() => { calls++; return new Response(body, { status: 429 }); }) });
    try {
      const result = await app.post('model', { model: MODEL }); assert.equal(result.status, 429);
      const content = await result.text(); assert.equal(JSON.parse(content).error.code, 'provider_rate_limit_or_quota'); assert.ok(!content.includes(KEY));
      assert.equal((await (await app.get()).json()).model, PREVIOUS_MODEL); assert.equal(calls, 1);
    } finally { await app.close(); }
  }
  const app = await fixture({ apiKey: KEY, fetch: fakeFetch(() => providerResponse({ error: { code: 'credit_balance_exhausted', message: KEY } }, 429)) });
  try {
    const connect = await app.post('connect', { apiKey: NEXT_KEY, model: MODEL }); assert.equal(connect.status, 429);
    assert.equal((await connect.json()).error.code, 'provider_credit_balance_exhausted');
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

const anthropicEnvelope = (value: unknown = answer) => ({ type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(value) }] });

test('Claude is the server default and environment status never makes a provider request', async () => {
  const empty = await fixture({ provider: undefined });
  const configured = await fixture({ provider: undefined, apiKey: CLAUDE_KEY });
  try {
    assert.deepEqual(await (await empty.get()).json(), { configured: false, provider: 'anthropic', model: CLAUDE_MODEL, source: 'none' });
    const content = await (await configured.get()).text();
    assert.deepEqual(JSON.parse(content), { configured: true, provider: 'anthropic', model: CLAUDE_MODEL, source: 'environment' });
    assert.ok(!content.includes(CLAUDE_KEY)); assert.equal(empty.calls(), 0); assert.equal(configured.calls(), 0);
  } finally { await empty.close(); await configured.close(); }
});

test('Claude connection and generation use only Anthropic endpoints, headers and structured output parameters', async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const app = await fixture({ apiKey: KEY, now: () => new Date('2026-09-20T12:00:00Z'), fetch: fakeFetch((url, init) => {
    requests.push({ url, init }); return providerResponse(url.endsWith('/messages') ? anthropicEnvelope() : { id: CLAUDE_MODEL });
  }) });
  try {
    const connected = await app.post('connect', { provider: 'anthropic', apiKey: CLAUDE_KEY, model: CLAUDE_MODEL });
    const content = await connected.text(); assert.equal(connected.status, 200); assert.ok(!content.includes(CLAUDE_KEY));
    assert.deepEqual(JSON.parse(content), { configured: true, provider: 'anthropic', model: CLAUDE_MODEL, source: 'session' });
    assert.equal(requests[0].url, `https://api.anthropic.com/v1/models/${CLAUDE_MODEL}`); assert.equal(requests[0].init.method, 'GET');
    assert.equal(requests[0].init.body, undefined);
    const source = { page: input.evidence[0].page, label: input.evidence[0].label, excerpt: 'LOCAL-CANONICAL-EXCERPT' };
    const result = await app.post('answer', { ...input, evidence: [{ ...input.evidence[0], source }] }); assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { answer, provider: 'anthropic', model: CLAUDE_MODEL, generatedAt: '2026-09-20T12:00:00.000Z' });
    assert.equal(requests.length, 2); assert.equal(requests[1].url, 'https://api.anthropic.com/v1/messages'); assert.equal(requests[1].init.method, 'POST');
    for (const { init } of requests) {
      const headers = new Headers(init.headers); assert.equal(headers.get('x-api-key'), CLAUDE_KEY); assert.equal(headers.get('anthropic-version'), '2023-06-01');
      assert.equal(headers.get('authorization'), null); assert.equal(init.redirect, 'error'); assert.ok(!JSON.stringify(init).includes(KEY));
    }
    const sent = JSON.parse(String(requests[1].init.body));
    assert.deepEqual(Object.keys(sent).sort(), ['max_tokens', 'messages', 'model', 'output_config', 'system']);
    assert.equal(sent.max_tokens, 2500); assert.equal(sent.model, CLAUDE_MODEL); assert.equal(sent.messages.length, 1); assert.equal(sent.messages[0].role, 'user');
    assert.match(sent.system, /UNTRUSTED DATA/); assert.match(sent.system, /Use ONLY supplied facts/); assert.match(sent.system, /UK English/);
    assert.deepEqual(JSON.parse(sent.messages[0].content), input); assert.ok(!JSON.stringify(sent).includes(source.excerpt));
    assert.equal(sent.output_config.format.type, 'json_schema');
    const schema = sent.output_config.format.schema;
    assert.equal(schema.additionalProperties, false); assert.deepEqual(schema.required, Object.keys(answer));
    assert.equal(schema.properties.decision.additionalProperties, false);
    assert.match(schema.properties.title.description, /160 characters/); assert.match(schema.properties.missingEvidence.description, /20 items/);
    assert.match(schema.properties.missingEvidence.items.description, /1000 characters/);
    assert.doesNotMatch(JSON.stringify(schema), /"(?:maxLength|minLength|maxItems)"/);
    assert.equal(ANSWER_SCHEMA.properties.title.maxLength, 160); assert.equal(ANSWER_SCHEMA.properties.missingEvidence.maxItems, 20);
  } finally { await app.close(); }
});

test('provider switches are atomic and credentials never cross provider hosts on success or failure', async () => {
  const requests: { url: string; key: string | null }[] = [];
  let failClaudeConnection = true; let failOpenAiConnection = true;
  const app = await fixture({ apiKey: KEY, fetch: fakeFetch((url, init) => {
    const headers = new Headers(init.headers);
    if (url.startsWith('https://api.anthropic.com/')) {
      assert.equal(headers.get('x-api-key'), CLAUDE_KEY); assert.equal(headers.get('authorization'), null); requests.push({ url, key: headers.get('x-api-key') });
      return failClaudeConnection ? providerResponse({ error: { message: CLAUDE_KEY } }, 401) : providerResponse(url.endsWith('/messages') ? anthropicEnvelope() : { id: CLAUDE_MODEL });
    }
    assert.ok(url.startsWith('https://api.openai.com/')); assert.equal(headers.get('authorization'), `Bearer ${KEY}`); assert.equal(headers.get('x-api-key'), null);
    requests.push({ url, key: headers.get('authorization') });
    return url.endsWith('/responses') ? providerResponse() : failOpenAiConnection ? providerResponse({ error: { message: KEY } }, 401) : providerResponse({ id: MODEL });
  }) });
  try {
    const failed = await app.post('connect', { provider: 'anthropic', apiKey: CLAUDE_KEY, model: CLAUDE_MODEL }); assert.equal(failed.status, 401);
    assert.deepEqual(await (await app.get()).json(), { configured: true, provider: 'openai', model: MODEL, source: 'environment' });
    assert.equal((await (await app.post('answer', input)).json()).provider, 'openai');
    failClaudeConnection = false;
    assert.equal((await app.post('connect', { provider: 'anthropic', apiKey: CLAUDE_KEY, model: CLAUDE_MODEL })).status, 200);
    assert.equal((await (await app.post('answer', input)).json()).provider, 'anthropic');
    assert.equal((await app.post('connect', { provider: 'openai', apiKey: KEY, model: MODEL })).status, 401);
    assert.deepEqual(await (await app.get()).json(), { configured: true, provider: 'anthropic', model: CLAUDE_MODEL, source: 'session' });
    assert.equal((await (await app.post('answer', input)).json()).provider, 'anthropic');
    failOpenAiConnection = false;
    assert.equal((await app.post('connect', { provider: 'openai', apiKey: KEY, model: MODEL })).status, 200);
    assert.equal((await (await app.post('answer', input)).json()).provider, 'openai');
    assert.equal(requests.length, 8);
  } finally { await app.close(); }
});

test('invalid providers and mismatched credential prefixes fail locally without changing the active provider', async () => {
  const app = await fixture({ provider: 'anthropic', apiKey: CLAUDE_KEY });
  try {
    for (const body of [
      { provider: 'other', apiKey: CLAUDE_KEY, model: CLAUDE_MODEL }, { provider: null, apiKey: CLAUDE_KEY, model: CLAUDE_MODEL },
      { provider: 'openai', apiKey: CLAUDE_KEY, model: MODEL }, { provider: 'anthropic', apiKey: KEY, model: CLAUDE_MODEL },
      { apiKey: CLAUDE_KEY, model: CLAUDE_MODEL }, { provider: 'anthropic', apiKey: `${CLAUDE_KEY}\r\nInjected: value`, model: CLAUDE_MODEL },
    ]) assert.equal((await app.post('connect', body)).status, 400);
    assert.equal((await app.post('model', { provider: 'openai', model: MODEL })).status, 400);
    assert.deepEqual(await (await app.get()).json(), { configured: true, provider: 'anthropic', model: CLAUDE_MODEL, source: 'environment' }); assert.equal(app.calls(), 0);
  } finally { await app.close(); }
  for (const options of [{ provider: 'openai' as const, apiKey: CLAUDE_KEY }, { provider: 'anthropic' as const, apiKey: KEY }]) {
    const mismatched = await fixture(options);
    try { assert.equal((await (await mismatched.get()).json()).configured, false); assert.equal((await mismatched.post('answer', input)).status, 503); assert.equal(mismatched.calls(), 0); }
    finally { await mismatched.close(); }
  }
  let directCalls = 0;
  const directOptions = { model: MODEL, signal: new AbortController().signal, fetch: fakeFetch(() => { directCalls++; throw new Error('Unexpected provider access'); }) };
  await assert.rejects(requestOpenAiAnswer(input, { ...directOptions, apiKey: CLAUDE_KEY }), /invalid/);
  await assert.rejects(requestAnthropicAnswer(input, { ...directOptions, apiKey: KEY }), /invalid/);
  assert.equal(directCalls, 0);
});

test('Claude model changes retain the provider and credential, and failed checks preserve the previous model', async () => {
  const nextModel = 'claude-sonnet-4-6'; let rejectModel = true; let calls = 0;
  const app = await fixture({ provider: 'anthropic', apiKey: CLAUDE_KEY, fetch: fakeFetch((url, init) => {
    calls++; assert.ok(url.startsWith('https://api.anthropic.com/v1/')); assert.equal(new Headers(init.headers).get('x-api-key'), CLAUDE_KEY);
    if (url.endsWith('/messages')) return providerResponse(anthropicEnvelope());
    assert.equal(url, `https://api.anthropic.com/v1/models/${nextModel}`);
    return rejectModel ? providerResponse({ error: { message: CLAUDE_KEY } }, 404) : providerResponse({ id: nextModel });
  }) });
  try {
    assert.equal((await app.post('model', { model: nextModel })).status, 502);
    assert.deepEqual(await (await app.get()).json(), { configured: true, provider: 'anthropic', model: CLAUDE_MODEL, source: 'environment' });
    rejectModel = false; assert.equal((await app.post('model', { model: nextModel })).status, 200);
    assert.deepEqual(await (await app.get()).json(), { configured: true, provider: 'anthropic', model: nextModel, source: 'environment' });
    const result = await (await app.post('answer', input)).json(); assert.equal(result.provider, 'anthropic'); assert.equal(result.model, nextModel); assert.equal(calls, 3);
  } finally { await app.close(); }
});

test('Claude canonicalises only known kind and verdict casing before strict answer validation', async () => {
  const accepted = [
    { kind: 'ANSWER', verdict: 'consider', expectedKind: 'answer', expectedVerdict: 'Consider' },
    { kind: 'Answer', verdict: 'SKIP FOR NOW', expectedKind: 'answer', expectedVerdict: 'Skip for now' },
    { kind: 'Clarification', verdict: 'Need More Context', expectedKind: 'clarification', expectedVerdict: 'Need more context' },
    { kind: 'cLaRiFiCaTiOn', verdict: 'nEeD mOrE cOnTeXt', expectedKind: 'clarification', expectedVerdict: 'Need more context' },
  ];
  for (const { kind, verdict, expectedKind, expectedVerdict } of accepted) {
    const value = { ...answer, kind, decision: { ...answer.decision, verdict } };
    const app = await fixture({ provider: 'anthropic', apiKey: CLAUDE_KEY, fetch: fakeFetch(() => providerResponse(anthropicEnvelope(value))) });
    try {
      const result = await app.post('answer', input); assert.equal(result.status, 200);
      assert.deepEqual((await result.json()).answer, { ...answer, kind: expectedKind, decision: { ...answer.decision, verdict: expectedVerdict } });
    } finally { await app.close(); }
  }
  const rejected = [
    { ...answer, kind: 'explanation' }, { ...answer, kind: ' ANSWER' },
    { ...answer, decision: { ...answer.decision, verdict: 'Approved' } },
    { ...answer, decision: { ...answer.decision, verdict: 'Consider ' } },
    { ...answer, kind: 'Clarification', decision: { ...answer.decision, verdict: 'Consider' } },
    { ...answer, kind: 'ANSWER', sourceIds: ['product:invented'] },
  ];
  for (const value of rejected) {
    const app = await fixture({ provider: 'anthropic', apiKey: CLAUDE_KEY, fetch: fakeFetch(() => providerResponse(anthropicEnvelope(value))) });
    try { const result = await app.post('answer', input); assert.equal(result.status, 502); assert.equal((await result.json()).error.code, 'invalid_provider_response'); }
    finally { await app.close(); }
  }
  const openai = await fixture({ apiKey: KEY, fetch: fakeFetch(() => providerResponse(providerEnvelope({ ...answer, kind: 'ANSWER' }))) });
  try { assert.equal((await openai.post('answer', input)).status, 502); }
  finally { await openai.close(); }
});

test('Claude rejects truncated, refused, tool-use, malformed and ungrounded responses without leaking provider data', async () => {
  const malformed = [
    ...['max_tokens', 'refusal', 'tool_use', 'pause_turn', 'stop_sequence', null].map(stop_reason => ({ ...anthropicEnvelope(), stop_reason })),
    { ...anthropicEnvelope(), type: 'error' }, { ...anthropicEnvelope(), role: 'user' }, { ...anthropicEnvelope(), error: { message: CLAUDE_KEY } },
    { ...anthropicEnvelope(), content: [] }, { ...anthropicEnvelope(), content: [...anthropicEnvelope().content, ...anthropicEnvelope().content] },
    { ...anthropicEnvelope(), content: [{ type: 'tool_use', name: 'publish', input: CLAUDE_KEY }] },
    { ...anthropicEnvelope(), content: [{ type: 'refusal', text: CLAUDE_KEY }] },
    { ...anthropicEnvelope(), content: [{ type: 'text', text: 'broken JSON' }] },
    anthropicEnvelope({ ...answer, text: CLAUDE_KEY }), anthropicEnvelope({ ...answer, text: 'Contact @privatehandle' }),
    anthropicEnvelope({ ...answer, text: 'See E-99.5' }), anthropicEnvelope({ ...answer, sourceIds: ['product:invented'] }),
    anthropicEnvelope({ ...answer, text: 'x'.repeat(5501) }), anthropicEnvelope({ ...answer, title: 'x'.repeat(161) }),
    anthropicEnvelope({ ...answer, missingEvidence: Array(21).fill('Unknown') }), anthropicEnvelope({ ...answer, missingEvidence: ['x'.repeat(1001)] }),
    anthropicEnvelope({ ...answer, title: 'x'.repeat(256 * 1024) }),
  ];
  for (const body of malformed) {
    let calls = 0;
    const app = await fixture({ provider: 'anthropic', apiKey: CLAUDE_KEY, fetch: fakeFetch(() => { calls++; return providerResponse(body); }) });
    try {
      const result = await app.post('answer', input); assert.equal(result.status, 502);
      const content = await result.text(); assert.equal(JSON.parse(content).error.code, 'invalid_provider_response'); assert.ok(!content.includes(CLAUDE_KEY)); assert.equal(calls, 1);
    } finally { await app.close(); }
  }
});

test('Claude HTTP and transport failures use fixed safe provider-specific messages without automatic retries', async () => {
  const cases: [number, string, number, string][] = [
    [401, 'authentication_error', 401, 'provider_auth'], [403, 'permission_error', 401, 'provider_auth'],
    [400, 'invalid_request_error', 502, 'provider_request_or_billing'], [400, 'billing_error', 402, 'provider_billing'],
    [402, 'billing_error', 402, 'provider_billing'], [404, 'not_found_error', 502, 'provider_model'],
    [429, 'rate_limit_error', 429, 'provider_rate_limit_or_quota'], [529, 'overloaded_error', 503, 'provider_overloaded'],
    [500, 'api_error', 502, 'provider_unavailable'],
  ];
  for (const [status, type, expectedStatus, code] of cases) {
    let calls = 0;
    const app = await fixture({ provider: 'anthropic', apiKey: CLAUDE_KEY, fetch: fakeFetch(() => { calls++; return providerResponse({ error: { type, message: `SECRET ${CLAUDE_KEY}` }, request_id: 'PRIVATE_ACCOUNT' }, status); }) });
    try {
      const result = await app.post('answer', input); assert.equal(result.status, expectedStatus);
      const content = await result.text(); const error = JSON.parse(content).error; assert.equal(error.code, code); assert.match(error.message, /Claude/);
      assert.ok(!content.includes(CLAUDE_KEY)); assert.doesNotMatch(content, /SECRET|PRIVATE_ACCOUNT|OpenAI/); assert.equal(calls, 1);
    } finally { await app.close(); }
  }
  for (const body of ['broken JSON', JSON.stringify({ error: { type: 'billing_error', message: CLAUDE_KEY.repeat(1000) } })]) {
    const app = await fixture({ provider: 'anthropic', apiKey: CLAUDE_KEY, fetch: fakeFetch(() => new Response(body, { status: 400 })) });
    try { const result = await app.post('answer', input); assert.equal(result.status, 502); const content = await result.text(); assert.equal(JSON.parse(content).error.code, 'provider_request_or_billing'); assert.ok(!content.includes(CLAUDE_KEY)); }
    finally { await app.close(); }
  }
  const app = await fixture({ provider: 'anthropic', apiKey: CLAUDE_KEY, fetch: fakeFetch(() => { throw new Error(CLAUDE_KEY); }) });
  try { const result = await app.post('answer', input); assert.equal(result.status, 502); const content = await result.text(); assert.match(content, /Claude could not be reached/); assert.ok(!content.includes(CLAUDE_KEY)); }
  finally { await app.close(); }
});

test('disconnect cancels pending Claude connections and answers, excludes parallel work and never restores an environment key', async () => {
  for (const path of ['connect', 'answer']) {
    let started!: () => void; const running = new Promise<void>(resolve => { started = resolve; }); let signal: AbortSignal | undefined; let calls = 0;
    const app = await fixture({ provider: 'anthropic', apiKey: CLAUDE_KEY, fetch: fakeFetch((_url, init) => { calls++; signal = init.signal!; started(); return new Promise<Response>(() => {}); }) });
    try {
      const first = app.post(path, path === 'connect' ? { provider: 'anthropic', apiKey: CLAUDE_KEY, model: CLAUDE_MODEL } : input); await running;
      assert.equal((await app.post('answer', input)).status, 409);
      assert.equal((await app.post('model', { model: CLAUDE_MODEL })).status, 409);
      assert.equal((await app.post('connect', { provider: 'openai', apiKey: KEY, model: MODEL })).status, 409);
      assert.equal((await app.post('disconnect', {})).status, 200); const result = await first; assert.equal(result.status, 409);
      assert.equal((await result.json()).error.code, 'cancelled'); assert.equal(signal?.aborted, true); assert.equal(calls, 1);
      assert.equal((await (await app.get()).json()).configured, false); assert.equal((await app.post('answer', input)).status, 503);
    } finally { await app.close(); }
  }
});

test('Claude timeouts and client cancellation abort upstream work and release the active request slot', async () => {
  let timedSignal: AbortSignal | undefined; let attempts = 0;
  const timed = await fixture({ provider: 'anthropic', apiKey: CLAUDE_KEY, answerTimeoutMs: 25, fetch: fakeFetch((_url, init) => {
    attempts++; timedSignal = init.signal!; return attempts === 1 ? new Promise<Response>(() => {}) : providerResponse(anthropicEnvelope());
  }) });
  try {
    const result = await timed.post('answer', input); assert.equal(result.status, 504); assert.match((await result.json()).error.message, /Claude took too long/); assert.equal(timedSignal?.aborted, true);
    assert.equal((await timed.post('answer', input)).status, 200); assert.equal(attempts, 2);
  } finally { await timed.close(); }
  let started!: () => void; const running = new Promise<void>(resolve => { started = resolve; });
  let stopped!: () => void; const cancelledUpstream = new Promise<void>(resolve => { stopped = resolve; }); let calls = 0;
  const app = await fixture({ provider: 'anthropic', apiKey: CLAUDE_KEY, fetch: fakeFetch((_url, init) => {
    calls++; if (calls > 1) return providerResponse(anthropicEnvelope()); started();
    return new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => { stopped(); reject(new Error(CLAUDE_KEY)); }, { once: true }));
  }) });
  try {
    const controller = new AbortController(); const first = app.post('answer', input, {}, controller.signal); const rejected = assert.rejects(first, /abort/i);
    await running; controller.abort(); await rejected; await cancelledUpstream;
    assert.equal((await app.post('answer', input)).status, 200); assert.equal(calls, 2);
  } finally { await app.close(); }
});
