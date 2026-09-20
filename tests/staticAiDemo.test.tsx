import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AiSettings from '../src/components/AiSettings';
import { connectAi, disconnectAi, EMPTY_AI_STATUS, getAiStatus, requestAiAnswer, setAiModel } from '../src/lib/aiClient';
import type { AiRequest, AiStatus } from '../src/lib/aiTypes';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const request: AiRequest = { task: 'chat', question: 'Which moisturiser suits dry skin?', history: [], evidence: [], productIds: [], checks: [], selectedContext: '' };

describe('hosted static demo AI boundary', () => {
  it('reports AI as disconnected without contacting a server', async () => {
    vi.stubEnv('VITE_STATIC_DEMO', 'true');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(await getAiStatus()).toEqual(EMPTY_AI_STATUS);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects credentials, model changes, disconnects and generation before sending any request', async () => {
    vi.stubEnv('VITE_STATIC_DEMO', 'true');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    for (const operation of [
      () => connectAi('never-send-this-test-key', 'test-model'),
      () => setAiModel('test-model'),
      () => disconnectAi(),
      () => requestAiAnswer(request),
    ]) await expect(operation()).rejects.toThrow('Live AI is unavailable in this hosted demo.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('explains the hosted limits without offering key inputs or stale configured controls', () => {
    vi.stubEnv('VITE_STATIC_DEMO', 'true');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const staleStatus: AiStatus = { ...EMPTY_AI_STATUS, configured: true, source: 'session' };
    const { container } = render(<AiSettings status={staleStatus} enabled onStatus={vi.fn()} onEnabled={vi.fn()}/>);
    expect(screen.getByText('Hosted demo')).toBeTruthy();
    expect(screen.getByText('Answers and chat use local evidence templates.')).toBeTruthy();
    expect(screen.getByText(/Live AI is not connected/)).toBeTruthy();
    expect(container.querySelector('input, select, form')).toBeNull();
    expect(screen.queryByRole('button', { name: /connect/i })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps local connection settings usable when static mode is disabled', async () => {
    vi.stubEnv('VITE_STATIC_DEMO', 'false');
    const connected: AiStatus = { ...EMPTY_AI_STATUS, configured: true, source: 'session' };
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => EMPTY_AI_STATUS })
      .mockResolvedValueOnce({ ok: true, json: async () => connected });
    vi.stubGlobal('fetch', fetch);
    const onStatus = vi.fn(), onEnabled = vi.fn();
    render(<AiSettings status={EMPTY_AI_STATUS} enabled={false} onStatus={onStatus} onEnabled={onEnabled}/>);
    await waitFor(() => expect((screen.getByLabelText('Anthropic API key') as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Anthropic API key'), { target: { value: 'local-test-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect and enable AI' }));
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith(connected));
    expect(fetch).toHaveBeenCalledWith('/api/ai/connect', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ apiKey: 'local-test-key', model: EMPTY_AI_STATUS.model, provider: EMPTY_AI_STATUS.provider }),
    }));
    expect(onEnabled).toHaveBeenCalledWith(true);
  });
});
