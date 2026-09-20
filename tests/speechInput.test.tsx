import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPanel from '../src/components/ChatPanel';
import VoicePanel from '../src/components/VoicePanel';
import { PARTIAL_TRANSCRIPT_NOTICE, SPEECH_INPUT_TIMING } from '../src/hooks/useSpeechInput';

// These tests exercise browser event ordering. They do not verify physical microphone capture.
type Result = { isFinal: boolean; 0: { transcript: string } };
class RecognitionMock {
  static sessions: RecognitionMock[] = [];
  static autoStart = true;
  lang = ''; continuous = false; interimResults = false; maxAlternatives = 1;
  onstart: (() => void) | null = null; onend: (() => void) | null = null;
  onaudiostart: (() => void) | null = null; onspeechstart: (() => void) | null = null;
  onnomatch: (() => void) | null = null;
  onresult: ((event: { results: Result[] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  start = vi.fn(() => { if (RecognitionMock.autoStart) this.onstart?.(); });
  // Real browsers can return final words after stop(), and can fail to send onend entirely.
  stop = vi.fn();
  abort = vi.fn();
  constructor() { RecognitionMock.sessions.push(this); }
}
const final = (transcript: string): Result => ({ isFinal: true, 0: { transcript } });
const partial = (transcript: string): Result => ({ isFinal: false, 0: { transcript } });
const result = (session: RecognitionMock, ...results: Result[]) => act(() => session.onresult?.({ results }));
const advance = (time: number) => act(() => vi.advanceTimersByTime(time));
const input = () => screen.getByRole('textbox') as HTMLTextAreaElement;

beforeEach(() => {
  vi.useFakeTimers();
  RecognitionMock.sessions = []; RecognitionMock.autoStart = true;
  vi.stubGlobal('SpeechRecognition', RecognitionMock);
  vi.stubGlobal('webkitSpeechRecognition', undefined);
  vi.stubGlobal('speechSynthesis', undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe.each(['voice', 'chat'] as const)('%s input lifecycle with simulated browser events', kind => {
  function mount() {
    const submitted = vi.fn(), closed = vi.fn();
    const element = (open = true) => kind === 'voice'
      ? <VoicePanel open={open} onClose={closed} selectedText="" onQuestion={submitted} onCommand={vi.fn(() => ({ ok: true, message: 'Done' }))}/>
      : <ChatPanel open={open} onClose={closed} onSend={submitted} onAddQuestion={vi.fn()} onClear={vi.fn()} messages={[]}/>;
    const view = render(element());
    // Let the dialog's initial autofocus task settle before counting recognition timers.
    advance(0);
    const start = () => {
      fireEvent.click(screen.getByRole('button', { name: kind === 'voice' ? 'Start listening' : 'Start dictation' }));
      return RecognitionMock.sessions.at(-1)!;
    };
    const stop = () => fireEvent.click(screen.getByRole('button', { name: kind === 'voice' ? 'Stop listening' : 'Stop dictation' }));
    const submit = () => screen.getByRole('button', { name: kind === 'voice' ? 'Use as question' : 'Send message' }) as HTMLButtonElement;
    return { view, element, submitted, start, stop, submit };
  }

  it('keeps interim-only words on natural end, clearly labels them and waits for explicit submission', () => {
    const ui = mount(), session = ui.start();
    result(session, partial('Is Cloud Cream worth it?'));
    expect(input().value).toBe('');
    act(() => session.onend?.());
    expect(input().value).toBe('Is Cloud Cream worth it?');
    expect(screen.getByText(PARTIAL_TRANSCRIPT_NOTICE)).toBeTruthy();
    expect(ui.submitted).not.toHaveBeenCalled();
    expect(ui.submit().disabled).toBe(false);
    fireEvent.click(ui.submit());
    expect(ui.submitted).toHaveBeenCalledExactlyOnceWith('Is Cloud Cream worth it?');
    expect(screen.queryByText(PARTIAL_TRANSCRIPT_NOTICE)).toBeNull();
  });

  it('accepts a delayed final after manual stop without duplicating the interim text', () => {
    const ui = mount(), session = ui.start();
    result(session, final('Show'), partial('the report'));
    ui.stop();
    expect(ui.submit().disabled).toBe(true);
    advance(SPEECH_INPUT_TIMING.stop - 1);
    result(session, final('Show the reports'));
    act(() => session.onend?.());
    expect(input().value).toBe('Show the reports');
    expect(screen.queryByText(PARTIAL_TRANSCRIPT_NOTICE)).toBeNull();
    expect(ui.submit().disabled).toBe(false);
    expect(session.abort).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('recovers interim words if manual stop never completes and rejects a late final', () => {
    const ui = mount(), session = ui.start();
    result(session, partial('Keep these words'));
    const late = session.onresult;
    ui.stop(); advance(SPEECH_INPUT_TIMING.stop);
    expect(input().value).toBe('Keep these words');
    expect(screen.getByText(PARTIAL_TRANSCRIPT_NOTICE)).toBeTruthy();
    expect(screen.getByText(/did not finish in time/)).toBeTruthy();
    expect(session.abort).toHaveBeenCalledOnce();
    act(() => late?.({ results: [final('late replacement')] }));
    expect(input().value).toBe('Keep these words');
    expect(ui.submitted).not.toHaveBeenCalled();
  });

  it.each(['network', 'audio-capture'])('retains current partial words on %s error', error => {
    const ui = mount(), session = ui.start();
    result(session, final('Already final'), partial('still provisional'));
    act(() => session.onerror?.({ error }));
    expect(input().value).toBe('Already final still provisional');
    expect(screen.getByText(PARTIAL_TRANSCRIPT_NOTICE)).toBeTruthy();
    expect(session.abort).toHaveBeenCalledOnce();
    expect(ui.submitted).not.toHaveBeenCalled();
    if (error === 'audio-capture') {
      expect(screen.getByText(/could not capture microphone audio/).textContent).toContain('device settings');
      expect(screen.queryByText(/No microphone was available/)).toBeNull();
    }
  });

  it('bounds startup when the browser never emits an event and ignores a stale start', () => {
    RecognitionMock.autoStart = false;
    const ui = mount(), session = ui.start(), late = session.onstart;
    expect(screen.getByText('Starting speech service…')).toBeTruthy();
    advance(SPEECH_INPUT_TIMING.startup);
    expect(screen.getByText(/speech service did not start/)).toBeTruthy();
    expect(session.abort).toHaveBeenCalledOnce();
    act(() => late?.());
    expect(screen.queryByText('Listening')).toBeNull();
    ui.start();
    expect(RecognitionMock.sessions).toHaveLength(2);
  });

  it('does not claim audio capture from onstart and bounds the wait for words', () => {
    const ui = mount(), session = ui.start();
    expect(screen.getByText('Speech service ready · waiting for audio')).toBeTruthy();
    expect(screen.queryByText('Listening')).toBeNull();
    advance(SPEECH_INPUT_TIMING.result);
    expect(screen.getByText(/speech service returned no words/)).toBeTruthy();
    expect(screen.queryByText(/No speech was detected/)).toBeNull();
    expect(session.abort).toHaveBeenCalledOnce();
    expect(ui.submitted).not.toHaveBeenCalled();
  });

  it('uses audio and speech events as distinct signals while still bounding a missing result', () => {
    RecognitionMock.autoStart = false;
    const ui = mount(), session = ui.start();
    act(() => session.onaudiostart?.());
    expect(screen.getByText('Listening')).toBeTruthy();
    act(() => session.onspeechstart?.());
    expect(screen.getByText('Speech detected · waiting for words')).toBeTruthy();
    advance(SPEECH_INPUT_TIMING.result);
    expect(screen.getByText(/speech service returned no words/)).toBeTruthy();
    expect(session.abort).toHaveBeenCalledOnce();
  });

  it('keeps current interim words when the service stops making progress', () => {
    const ui = mount(), session = ui.start();
    result(session, partial('These words arrived'));
    advance(SPEECH_INPUT_TIMING.result);
    expect(input().value).toBe('These words arrived');
    expect(screen.getByText(PARTIAL_TRANSCRIPT_NOTICE)).toBeTruthy();
    expect(screen.getByText(/stopped returning new words/)).toBeTruthy();
    expect(ui.submitted).not.toHaveBeenCalled();
  });

  it('does not allow duplicate result events to keep a stalled session alive forever', () => {
    const ui = mount(), session = ui.start();
    result(session, partial('Same words'));
    advance(SPEECH_INPUT_TIMING.result - 1);
    result(session, partial('Same words'));
    advance(1);
    expect(input().value).toBe('Same words');
    expect(session.abort).toHaveBeenCalledOnce();
  });

  it('explains nomatch and keeps any current words for review', () => {
    const ui = mount(), session = ui.start();
    result(session, partial('Possibly these words'));
    act(() => session.onnomatch?.());
    expect(input().value).toBe('Possibly these words');
    expect(screen.getByText(/could not recognise usable words/)).toBeTruthy();
    expect(screen.getByText(PARTIAL_TRANSCRIPT_NOTICE)).toBeTruthy();
    expect(ui.submitted).not.toHaveBeenCalled();
  });

  it('explains an empty completion without counting pre-existing typed text as dictation', () => {
    const ui = mount();
    fireEvent.change(input(), { target: { value: 'Existing text' } });
    const session = ui.start();
    act(() => session.onend?.());
    expect(input().value).toBe('Existing text');
    expect(screen.getByText(/ended without returning words/)).toBeTruthy();
    expect(screen.queryByText(PARTIAL_TRANSCRIPT_NOTICE)).toBeNull();
  });

  it('replaces revised and repeated result snapshots rather than appending them', () => {
    const ui = mount(), session = ui.start();
    result(session, final('Show'), partial('reports today'));
    result(session, final('Show'), partial('questions'));
    result(session, final('Show'), partial('questions'));
    act(() => session.onend?.());
    expect(input().value).toBe('Show questions');
    expect(input().value).not.toContain('reports');
  });

  it('does not resurrect a removed interim hypothesis on end', () => {
    const ui = mount(), session = ui.start();
    result(session, final('Confirmed'), partial('removed hypothesis'));
    result(session, final('Confirmed'));
    act(() => session.onend?.());
    expect(input().value).toBe('Confirmed');
    expect(screen.queryByText(PARTIAL_TRANSCRIPT_NOTICE)).toBeNull();
  });

  it('treats an empty result list as removal of all current hypotheses', () => {
    const ui = mount(), session = ui.start();
    result(session, partial('Removed words'));
    result(session);
    act(() => session.onend?.());
    expect(input().value).toBe('');
    expect(screen.getByText(/ended without returning words/)).toBeTruthy();
    expect(screen.queryByText(PARTIAL_TRANSCRIPT_NOTICE)).toBeNull();
  });

  it('discards interim words on editing and ignores all callbacks from the cancelled session', () => {
    const ui = mount(), session = ui.start();
    result(session, partial('Discard me'));
    const lateResult = session.onresult, lateEnd = session.onend, lateError = session.onerror;
    fireEvent.change(input(), { target: { value: 'My corrected text' } });
    act(() => { lateResult?.({ results: [final('Stale words')] }); lateEnd?.(); lateError?.({ error: 'network' }); });
    advance(SPEECH_INPUT_TIMING.result);
    expect(input().value).toBe('My corrected text');
    expect(screen.queryByText(PARTIAL_TRANSCRIPT_NOTICE)).toBeNull();
    expect(screen.queryByText(/could not connect/)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('discards interim words and cancels timers on close', () => {
    const ui = mount(), session = ui.start();
    result(session, partial('Discard on close'));
    ui.view.rerender(ui.element(false));
    expect(session.abort).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    ui.view.rerender(ui.element());
    expect(input().value).toBe('');
    expect(screen.queryByText(PARTIAL_TRANSCRIPT_NOTICE)).toBeNull();
  });

  it('detaches every callback and releases timers on unmount', () => {
    const ui = mount(), session = ui.start(), late = session.onresult;
    result(session, partial('Discard on unmount'));
    ui.view.unmount();
    expect(session.abort).toHaveBeenCalledOnce();
    for (const key of ['onstart', 'onend', 'onresult', 'onerror', 'onaudiostart', 'onspeechstart', 'onnomatch'] as const) expect(session[key]).toBeNull();
    act(() => late?.({ results: [final('Stale')] }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves the prefix exactly once across two sessions and ignores events from the first', () => {
    const ui = mount();
    fireEvent.change(input(), { target: { value: 'Typed prefix' } });
    const first = ui.start(), stale = first.onresult;
    result(first, final('first session'));
    act(() => first.onend?.());
    const second = ui.start();
    result(second, partial('second session'));
    act(() => stale?.({ results: [final('Old replacement')] }));
    act(() => second.onend?.());
    expect(input().value).toBe('Typed prefix first session second session');
    expect(ui.submitted).not.toHaveBeenCalled();
  });

  it('accepts words when a browser omits onstart and cancels the startup deadline', () => {
    RecognitionMock.autoStart = false;
    const ui = mount(), session = ui.start();
    result(session, partial('Words without onstart'));
    advance(SPEECH_INPUT_TIMING.startup);
    expect(session.abort).not.toHaveBeenCalled();
    expect(screen.queryByText(/speech service did not start/)).toBeNull();
    ui.stop(); act(() => session.onend?.());
    expect(input().value).toBe('Words without onstart');
  });

  it('bounds recovered interim text including its separator at 2,000 characters', () => {
    const ui = mount();
    fireEvent.change(input(), { target: { value: 'a'.repeat(1995) } });
    const session = ui.start();
    result(session, partial('many words'));
    expect(input().value).toBe('a'.repeat(1995) + ' many');
    expect(input().value).toHaveLength(2000);
    expect(screen.getByText(PARTIAL_TRANSCRIPT_NOTICE)).toBeTruthy();
    expect(session.abort).toHaveBeenCalledOnce();
  });
});
