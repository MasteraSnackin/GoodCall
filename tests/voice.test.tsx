import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import VoicePanel from '../src/components/VoicePanel';

class RecognitionMock {
  static sessions: RecognitionMock[] = [];
  static autoStart = true;
  lang = ''; continuous = false; interimResults = false; maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;
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
beforeEach(() => {
  RecognitionMock.sessions = [];
  RecognitionMock.autoStart = true;
  vi.clearAllMocks();
  synth.getVoices.mockReturnValue([]);
  vi.stubGlobal('SpeechRecognition', RecognitionMock);
  vi.stubGlobal('webkitSpeechRecognition', undefined);
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', UtteranceMock);
});
afterEach(() => { vi.unstubAllGlobals(); });
const props = () => ({ open: true, onClose: vi.fn(), selectedText: 'Cloud Cream costs £38.', onCommand: vi.fn(() => ({ ok: true, message: 'Questions are open. Let’s see what actually needs an answer.' })), onQuestion: vi.fn() });

describe('Voice companion with simulated browser speech APIs', () => {
  it('does not start listening or reading on opening', () => {
    render(<VoicePanel {...props()}/>);
    expect(RecognitionMock.sessions).toHaveLength(0);
    expect(synth.speak).not.toHaveBeenCalled();
    expect(screen.getByText('Microphone off')).toBeTruthy();
  });

  it('waits for explicit submission of a reviewed transcript', () => {
    const callbacks = props(); render(<VoicePanel {...callbacks}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));
    const session = RecognitionMock.sessions[0];
    expect(session.lang).toBe('en-GB');
    act(() => session.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Show reports' } }] }));
    expect(callbacks.onCommand).not.toHaveBeenCalled();
    expect(callbacks.onQuestion).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Run command' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Stop listening' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Show questions' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run command' }));
    expect(callbacks.onCommand).toHaveBeenCalledExactlyOnceWith('Show questions');
  });

  it('stops microphone access and ignores late results when the panel closes', () => {
    const callbacks = props(); const view = render(<VoicePanel {...callbacks}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));
    const session = RecognitionMock.sessions[0]; const lateResult = session.onresult;
    view.rerender(<VoicePanel {...callbacks} open={false}/>);
    expect(session.abort).toHaveBeenCalledOnce();
    expect(session.onresult).toBeNull();
    act(() => lateResult?.({ results: [{ isFinal: true, 0: { transcript: 'Late text' } }] }));
    view.rerender(<VoicePanel {...callbacks}/>);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });

  it('lets the user edit or submit text when recognition is unavailable', () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    const callbacks = props(); render(<VoicePanel {...callbacks}/>);
    expect(screen.getByText(/This browser does not offer speech recognition/)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Is Cloud Cream worth £38?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use as question' }));
    expect(callbacks.onQuestion).toHaveBeenCalledExactlyOnceWith('Is Cloud Cream worth £38?');
    expect(RecognitionMock.sessions).toHaveLength(0);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });

  it('aborts a pending microphone start when the user cancels', () => {
    RecognitionMock.autoStart = false;
    render(<VoicePanel {...props()}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));
    const session = RecognitionMock.sessions[0];
    fireEvent.click(screen.getByRole('button', { name: 'Cancel listening' }));
    expect(session.abort).toHaveBeenCalledOnce();
    expect(session.onstart).toBeNull();
    expect(screen.getByText('Microphone off')).toBeTruthy();
  });

  it('returns to an editable state after microphone permission is refused', () => {
    render(<VoicePanel {...props()}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));
    act(() => RecognitionMock.sessions[0].onerror?.({ error: 'not-allowed' }));
    expect(screen.getByText(/Microphone access was not allowed/)).toBeTruthy();
    expect(screen.getByText('Microphone off')).toBeTruthy();
    expect(RecognitionMock.sessions[0].abort).toHaveBeenCalledOnce();
  });

  it('keeps an unrecognised command editable and shows its explanation inside the panel', () => {
    const callbacks = { ...props(), onCommand: vi.fn(() => ({ ok: false, message: 'Select a question first.' })) };
    render(<VoicePanel {...callbacks}/>);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft an answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run command' }));
    expect(screen.getByText('Select a question first.')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Maya’s reply' })).getByRole('status').textContent).toBe('Select a question first.');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Draft an answer');
  });

  it('reads only on request and cancels reading on unmount', () => {
    const view = render(<VoicePanel {...props()}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Read selected card' }));
    expect(synth.speak).toHaveBeenCalledOnce();
    expect(synth.speak.mock.calls[0][0].text).toBe('Cloud Cream costs £38.');
    view.unmount();
    expect(synth.cancel).toHaveBeenCalledOnce();
  });

  it('bounds dictation and stops capture when the transcript is full', () => {
    render(<VoicePanel {...props()}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));
    const session = RecognitionMock.sessions[0];
    act(() => session.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'a'.repeat(2100) } }] }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toHaveLength(2000);
    expect(session.abort).toHaveBeenCalledOnce();
    expect(screen.getByText(/The transcript reached 2,000 characters/)).toBeTruthy();
  });

  it('shows successful contextual replies, clears the command and keeps the conversation open', () => {
    const callbacks = props(); render(<VoicePanel {...callbacks}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Show questions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run command' }));
    const response = within(screen.getByRole('region', { name: 'Maya’s reply' })).getByRole('status');
    expect(response.textContent).toBe('Questions are open. Let’s see what actually needs an answer.');
    expect(response.getAttribute('aria-live')).toBe('polite');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect((screen.getByRole('dialog') as HTMLDialogElement).open).toBe(true);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('labels the persona and synthetic speech, with reply speech off by default', () => {
    render(<VoicePanel {...props()}/>);
    expect(screen.getByText(/Dry, funny, decisive/)).toBeTruthy();
    expect(screen.getByText(/Synthetic browser speech, not Maya’s original voice/)).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /Speak replies/ }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole('button', { name: 'What’s missing?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Explain this card' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'What is your approach?' })).toBeTruthy();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('reads Maya’s contextual reply on request and can stop it', () => {
    const callbacks = props(); render(<VoicePanel {...callbacks}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Show questions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run command' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read Maya’s reply' }));
    expect(synth.speak).toHaveBeenCalledOnce();
    expect(synth.speak.mock.calls[0][0].text).toBe('Questions are open. Let’s see what actually needs an answer.');
    const responseArea = screen.getByRole('region', { name: 'Maya’s reply' });
    fireEvent.click(within(responseArea).getByRole('button', { name: 'Stop reading' }));
    expect(synth.cancel).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Read Maya’s reply' })).toBeTruthy();
  });

  it('speaks only future replies after opt-in and uses the selected browser voice', () => {
    const voice = { name: 'Device UK', voiceURI: 'device-uk', lang: 'en-GB', localService: true, default: false } as SpeechSynthesisVoice;
    synth.getVoices.mockReturnValue([voice]);
    render(<VoicePanel {...props()}/>);
    fireEvent.change(screen.getByRole('combobox', { name: 'Reading voice' }), { target: { value: voice.voiceURI } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Speak replies/ }));
    expect(synth.speak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show questions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run command' }));
    expect(synth.speak).toHaveBeenCalledOnce();
    expect(synth.speak.mock.calls[0][0].voice).toBe(voice);
    expect(synth.speak.mock.calls[0][0].text).toBe('Questions are open. Let’s see what actually needs an answer.');
    expect(RecognitionMock.sessions).toHaveLength(0);
  });

  it('stops an automatic reply when opt-out is selected and leaves later replies silent', () => {
    render(<VoicePanel {...props()}/>);
    fireEvent.click(screen.getByRole('checkbox', { name: /Speak replies/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Show questions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run command' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Speak replies/ }));
    expect(synth.cancel).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Show canvas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run command' }));
    expect(synth.speak).toHaveBeenCalledOnce();
  });

  it('does not interrupt a command reply when that command changes the selected card', () => {
    const callbacks = props(); const view = render(<VoicePanel {...callbacks}/>);
    fireEvent.click(screen.getByRole('checkbox', { name: /Speak replies/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Draft an answer for Sarah' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run command' }));
    view.rerender(<VoicePanel {...callbacks} selectedText="Sarah’s new draft."/>);
    expect(synth.speak).toHaveBeenCalledOnce();
    expect(synth.cancel).not.toHaveBeenCalled();
    view.rerender(<VoicePanel {...callbacks} open={false} selectedText="Sarah’s new draft."/>);
    expect(synth.cancel).toHaveBeenCalledOnce();
  });

  it('keeps source-card reading verbatim and stops it when the selected evidence changes', () => {
    const callbacks = { ...props(), selectedText: '  Cloud Cream: £38.\nEvidence version 1.  ' };
    const view = render(<VoicePanel {...callbacks}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Read selected card' }));
    expect(synth.speak.mock.calls[0][0].text).toBe(callbacks.selectedText);
    view.rerender(<VoicePanel {...callbacks} selectedText="A different evidence card."/>);
    expect(synth.cancel).toHaveBeenCalledOnce();
  });

  it('stops spoken replies before the user starts the microphone', () => {
    render(<VoicePanel {...props()}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Read Maya’s reply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));
    expect(synth.cancel).toHaveBeenCalledOnce();
    expect(RecognitionMock.sessions).toHaveLength(1);
    expect(screen.getByText('Speech service ready · waiting for audio')).toBeTruthy();
    act(() => RecognitionMock.sessions[0].onaudiostart?.());
    expect(screen.getByText('Listening')).toBeTruthy();
  });

  it('retains readable contextual replies when speech output is unavailable', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    render(<VoicePanel {...props()}/>);
    expect((screen.getByRole('checkbox', { name: /Speak replies/ }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Spoken replies are not available in this browser.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show questions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run command' }));
    expect(screen.getByText('Questions are open. Let’s see what actually needs an answer.')).toBeTruthy();
    expect(synth.speak).not.toHaveBeenCalled();
  });
});
