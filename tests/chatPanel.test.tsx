import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ChatPanel from '../src/components/ChatPanel';
import type { ChatMessage } from '../src/lib/chat';

// These are DOM integration tests with simulated browser speech APIs, not microphone or voice playback acceptance.
class RecognitionMock {
  static sessions: RecognitionMock[] = [];
  static autoStart = true;
  lang = ''; continuous = false; interimResults = false; maxAlternatives = 1;
  onstart: (() => void) | null = null; onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null = null;
  start = vi.fn(() => { if (RecognitionMock.autoStart) this.onstart?.(); });
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() { RecognitionMock.sessions.push(this); }
}
class UtteranceMock {
  text: string; lang = ''; rate = 1; voice = null;
  onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(text: string) { this.text = text; }
}
const synth = { getVoices: vi.fn<() => SpeechSynthesisVoice[]>(() => []), addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn(), speak: vi.fn() };
const message = (id = 'reply-1', text = 'Cloud Cream costs £38.'): ChatMessage => ({ id, role: 'assistant', text, createdAt: '2026-09-20T12:00:00Z', kind: 'answer' });
const props = (messages: ChatMessage[] = []) => ({ open: true, onClose: vi.fn(), onSend: vi.fn(), onAddQuestion: vi.fn(), onClear: vi.fn(), messages });
beforeEach(() => {
  RecognitionMock.sessions = []; RecognitionMock.autoStart = true;
  vi.clearAllMocks(); synth.getVoices.mockReturnValue([]);
  vi.stubGlobal('SpeechRecognition', RecognitionMock); vi.stubGlobal('webkitSpeechRecognition', undefined);
  vi.stubGlobal('speechSynthesis', synth); vi.stubGlobal('SpeechSynthesisUtterance', UtteranceMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Chat panel with simulated browser speech APIs', () => {
  it('opens silently with the local-assistant disclosure and speech opt-in off', () => {
    render(<ChatPanel {...props([message()])}/>);
    expect(screen.getByRole('dialog', { name: 'Chat with Maya' })).toBeTruthy();
    expect(screen.getByText('Local case-file assistant · no live AI')).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'Speak replies' }) as HTMLInputElement).checked).toBe(false);
    expect(RecognitionMock.sessions).toHaveLength(0); expect(synth.speak).not.toHaveBeenCalled();
  });
  it('uses suggested prompts as editable text and sends only on explicit submission', () => {
    const callbacks = props(); render(<ChatPanel {...callbacks}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Is Cloud Cream worth £38?' }));
    expect(callbacks.onSend).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Message Maya' }), { target: { value: ' Is Cloud Cream worth it for dry skin? ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(callbacks.onSend).toHaveBeenCalledExactlyOnceWith('Is Cloud Cream worth it for dry skin?');
    expect((screen.getByRole('textbox', { name: 'Message Maya' }) as HTMLTextAreaElement).value).toBe('');
  });
  it('submits Enter but preserves Shift+Enter and composing keyboard input', () => {
    const callbacks = props(); render(<ChatPanel {...callbacks}/>);
    const input = screen.getByRole('textbox', { name: 'Message Maya' });
    fireEvent.change(input, { target: { value: 'What is missing?' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(callbacks.onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(callbacks.onSend).toHaveBeenCalledExactlyOnceWith('What is missing?');
  });
  it('keeps dictation editable and does not submit recognised speech automatically', () => {
    const callbacks = props(); render(<ChatPanel {...callbacks}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Start dictation' }));
    const session = RecognitionMock.sessions[0]; expect(session.lang).toBe('en-GB');
    act(() => session.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Cloud Cream' } }, { isFinal: false, 0: { transcript: 'worth it' } }] }));
    expect(callbacks.onSend).not.toHaveBeenCalled(); expect(screen.getByText('Hearing: worth it')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Stop dictation' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Message Maya' }), { target: { value: 'Is Cloud Cream worth £38?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(callbacks.onSend).toHaveBeenCalledExactlyOnceWith('Is Cloud Cream worth £38?');
  });
  it('cancels a pending microphone start and permits a new session', () => {
    RecognitionMock.autoStart = false; render(<ChatPanel {...props()}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Start dictation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel dictation' }));
    expect(RecognitionMock.sessions[0].abort).toHaveBeenCalledOnce(); expect(RecognitionMock.sessions[0].onstart).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start dictation' })); expect(RecognitionMock.sessions).toHaveLength(2);
  });
  it('aborts microphone capture on close and ignores late results', () => {
    const callbacks = props(); const view = render(<ChatPanel {...callbacks}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Start dictation' })); const session = RecognitionMock.sessions[0], late = session.onresult;
    view.rerender(<ChatPanel {...callbacks} open={false}/>);
    expect(session.abort).toHaveBeenCalledOnce(); expect(session.onresult).toBeNull();
    act(() => late?.({ results: [{ isFinal: true, 0: { transcript: 'late result' } }] }));
    view.rerender(<ChatPanel {...callbacks}/>);
    expect((screen.getByRole('textbox', { name: 'Message Maya' }) as HTMLTextAreaElement).value).toBe(''); expect(callbacks.onSend).not.toHaveBeenCalled();
  });
  it('returns to typing after permission refusal without starting another session', () => {
    const callbacks = props(); render(<ChatPanel {...callbacks}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Start dictation' }));
    act(() => RecognitionMock.sessions[0].onerror?.({ error: 'not-allowed' }));
    expect(screen.getByText(/Microphone access was not allowed/)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Message Maya' }), { target: { value: 'Show the missing evidence' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' })); expect(callbacks.onSend).toHaveBeenCalledOnce(); expect(RecognitionMock.sessions).toHaveLength(1);
  });
  it('bounds dictated and pasted messages to 2,000 characters', () => {
    render(<ChatPanel {...props()}/>); fireEvent.click(screen.getByRole('button', { name: 'Start dictation' }));
    act(() => RecognitionMock.sessions[0].onresult?.({ results: [{ isFinal: true, 0: { transcript: 'a'.repeat(2100) } }] }));
    const input = screen.getByRole('textbox', { name: 'Message Maya' }) as HTMLTextAreaElement;
    expect(input.value.length).toBe(2000); expect(RecognitionMock.sessions[0].abort).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { value: 'b'.repeat(2200) } }); expect(input.value.length).toBe(2000);
  });
  it('stops a reading reply before microphone capture and cancels speech on unmount', () => {
    const view = render(<ChatPanel {...props([message()])}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Read aloud' })); expect(synth.speak.mock.calls[0][0].text).toBe('Cloud Cream costs £38.');
    fireEvent.click(screen.getByRole('button', { name: 'Start dictation' })); expect(synth.cancel).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Stop dictation' })); fireEvent.click(screen.getByRole('button', { name: 'Read aloud' }));
    view.unmount(); expect(synth.cancel).toHaveBeenCalledTimes(2);
  });
  it('prevents reading a reply during every dictation phase without losing interim words', () => {
    RecognitionMock.autoStart = false;
    render(<ChatPanel {...props([message()])}/>);
    const read = screen.getByRole('button', { name: 'Read aloud' }) as HTMLButtonElement;
    fireEvent.click(screen.getByRole('button', { name: 'Start dictation' }));
    const session = RecognitionMock.sessions[0];
    expect(read.disabled).toBe(true);
    act(() => session.onstart?.());
    act(() => session.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'Keep my dictated words' } }] }));
    expect(read.disabled).toBe(true);
    fireEvent.click(read);
    expect(synth.speak).not.toHaveBeenCalled();
    expect(session.abort).not.toHaveBeenCalled();
    expect(screen.getByText('Hearing: Keep my dictated words')).toBeTruthy();
    session.stop.mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Stop dictation' }));
    expect(read.disabled).toBe(true);
    act(() => session.onend?.());
    expect(read.disabled).toBe(false);
    fireEvent.click(read);
    expect(synth.speak).toHaveBeenCalledOnce();
    expect((screen.getByRole('textbox', { name: 'Message Maya' }) as HTMLTextAreaElement).value).toBe('Keep my dictated words');
  });
  it('reads only new replies after opt-in, using the selected browser voice', () => {
    const voice = { name: 'Device UK', voiceURI: 'device-uk', lang: 'en-GB', localService: true, default: false } as SpeechSynthesisVoice; synth.getVoices.mockReturnValue([voice]);
    const callbacks = props([message()]); const view = render(<ChatPanel {...callbacks}/>);
    fireEvent.change(screen.getByRole('combobox', { name: 'Reading voice' }), { target: { value: voice.voiceURI } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Speak replies' })); expect(synth.speak).not.toHaveBeenCalled();
    const next = message('reply-2', 'Let’s check the missing materials.'); view.rerender(<ChatPanel {...callbacks} messages={[...callbacks.messages, next]}/>);
    expect(synth.speak).toHaveBeenCalledOnce(); expect(synth.speak.mock.calls[0][0].text).toBe(next.text); expect(synth.speak.mock.calls[0][0].voice).toBe(voice);
    view.rerender(<ChatPanel {...callbacks} messages={[...callbacks.messages, next]} open={false}/>);
    view.rerender(<ChatPanel {...callbacks} messages={[...callbacks.messages, next]}/>);
    expect(synth.speak).toHaveBeenCalledOnce();
  });
  it('stops an automatic reply when opted out and leaves later replies silent', () => {
    const callbacks = props(); const view = render(<ChatPanel {...callbacks}/>);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Speak replies' })); view.rerender(<ChatPanel {...callbacks} messages={[message()]}/>);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Speak replies' })); expect(synth.cancel).toHaveBeenCalledOnce();
    view.rerender(<ChatPanel {...callbacks} messages={[message(), message('reply-2')]}/>); expect(synth.speak).toHaveBeenCalledOnce();
  });
  it('uses text chat when browser speech input and output are unavailable', () => {
    vi.stubGlobal('SpeechRecognition', undefined); vi.stubGlobal('speechSynthesis', undefined);
    const callbacks = props([message()]); render(<ChatPanel {...callbacks}/>);
    expect((screen.getByRole('button', { name: 'Start dictation' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Read aloud' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Dictation is unavailable in this browser/)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Message Maya' }), { target: { value: 'Tell me about Cloud Cream' } }); fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(callbacks.onSend).toHaveBeenCalledOnce(); expect(synth.speak).not.toHaveBeenCalled();
  });
  it('adds an audience question only through its explicit action and clears history only on request', () => {
    const callbacks = props([{ ...message(), questionText: 'Is Cloud Cream worth £38?' }]); render(<ChatPanel {...callbacks}/>);
    expect(callbacks.onAddQuestion).not.toHaveBeenCalled(); expect(callbacks.onClear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add to audience questions' })); expect(callbacks.onAddQuestion).toHaveBeenCalledExactlyOnceWith('Is Cloud Cream worth £38?');
    expect((screen.getByRole('button', { name: 'Added to questions' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear chat' })); expect(callbacks.onClear).toHaveBeenCalledOnce();
  });
  it('links only case-file sources and displays storage failure feedback inside the chat', () => {
    const callbacks = props([{ ...message(), sourceRefs: [{ page: 8, label: 'Product inventory', excerpt: 'Cloud Cream 38' }, { page: 0, label: 'Workspace correction', excerpt: 'Checked by the creator.' }] }]);
    render(<ChatPanel {...callbacks} selectedLabel="Cloud Cream" storageError="Chat history could not be saved."/>);
    expect(screen.getByRole('alert').textContent).toBe('Chat history could not be saved.');
    const reply = screen.getByRole('article', { name: 'Maya’s reply 1' }); fireEvent.click(within(reply).getByText('Supporting evidence'));
    expect(within(reply).getAllByRole('link')).toHaveLength(1); expect(within(reply).getByRole('link').getAttribute('href')).toBe('/operation-shade-case-file.pdf#page=8');
    expect(screen.getByText('Workspace correction · workspace note')).toBeTruthy(); expect(screen.getByText('Cloud Cream')).toBeTruthy();
  });
});
