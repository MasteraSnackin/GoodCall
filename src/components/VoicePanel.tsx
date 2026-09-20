import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, AudioLines, Mic, MicOff, Play, Square, Volume2, X } from 'lucide-react';
import { MAYA_PERSONA } from '../lib/persona';
import './VoicePanel.css';

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
type VoicePanelProps = {
  open: boolean;
  onClose: () => void;
  selectedText: string;
  onCommand: (command: string) => { ok: boolean; message: string };
  onQuestion: (text: string) => void;
};

const LIMIT = 2000;
const COMMANDS = ['Show canvas', 'Show questions', 'Show knowledge', 'Show reports', 'Show published answers', 'Draft an answer for Sarah', 'What’s missing?', 'Explain this card', 'What is your approach?'];
const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was not allowed. Check this browser’s microphone permission, or type below.',
  'service-not-allowed': 'Speech recognition is not permitted in this browser. You can type below instead.',
  'no-speech': 'No speech was detected. Try again when you are ready, or type below.',
  network: 'The browser’s speech service could not connect. Check your connection, or type below.',
  'audio-capture': 'No microphone was available. Check your microphone, or type below.',
  'language-not-supported': 'This browser’s speech service does not support UK English. You can type below instead.',
};

function recognitionConstructor() {
  if (typeof window === 'undefined') return undefined;
  const browser = window as SpeechWindow;
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}

export default function VoicePanel({ open, onClose, selectedText, onCommand, onQuestion }: VoicePanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const readingKindRef = useRef<'card' | 'reply' | null>(null);
  const mountedRef = useRef(true);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [phase, setPhase] = useState<'idle' | 'starting' | 'listening' | 'stopping'>('idle');
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState<'card' | 'reply' | null>(null);
  const [reply, setReply] = useState<string>(MAYA_PERSONA.greeting);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const supportsInput = Boolean(recognitionConstructor());
  const supportsOutput = typeof window !== 'undefined' && Boolean(window.speechSynthesis) && typeof window.SpeechSynthesisUtterance === 'function';
  const active = phase !== 'idle';

  const abortRecognition = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    const current = recognitionRef.current;
    recognitionRef.current = null;
    if (current) {
      current.onstart = current.onresult = current.onerror = current.onend = null;
      try { current.abort(); } catch { /* A finished browser session may already be inactive. */ }
    }
    if (mountedRef.current) {
      setPhase('idle');
      setInterim('');
    }
  }, []);

  const stopReading = useCallback(() => {
    const current = utteranceRef.current;
    utteranceRef.current = null;
    readingKindRef.current = null;
    if (current) {
      current.onend = current.onerror = current.onstart = null;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    }
    if (mountedRef.current) setReading(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRecognition();
      stopReading();
    };
  }, [abortRecognition, stopReading]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open) {
      if (dialog && !dialog.open) dialog.showModal();
      setMessage('');
    } else {
      abortRecognition();
      stopReading();
      if (dialog?.open) dialog.close();
    }
  }, [open, abortRecognition, stopReading]);

  useEffect(() => {
    if (!supportsOutput) return;
    const synth = window.speechSynthesis;
    const updateVoices = () => setVoices(synth.getVoices());
    updateVoices();
    synth.addEventListener('voiceschanged', updateVoices);
    return () => synth.removeEventListener('voiceschanged', updateVoices);
  }, [supportsOutput]);

  useEffect(() => {
    if (readingKindRef.current === 'card') stopReading();
  }, [selectedText, stopReading]);

  function close() {
    abortRecognition();
    stopReading();
    closeRef.current();
  }

  function startListening() {
    const Constructor = recognitionConstructor();
    if (!Constructor || recognitionRef.current) return;
    abortRecognition();
    stopReading();
    setMessage('');
    if (transcript.length >= LIMIT) {
      setMessage('The transcript is full. Clear or shorten it before listening again.');
      return;
    }
    let session: Recognition;
    try { session = new Constructor(); } catch {
      setMessage('Speech recognition could not start in this browser. You can type below instead.');
      return;
    }
    const prefix = transcript.trim();
    const join = (text: string) => [prefix, text].filter(Boolean).join(' ').slice(0, LIMIT);
    recognitionRef.current = session;
    session.lang = 'en-GB';
    session.continuous = true;
    session.interimResults = true;
    session.maxAlternatives = 1;
    const isCurrent = () => mountedRef.current && recognitionRef.current === session;
    session.onstart = () => { if (isCurrent()) setPhase('listening'); };
    session.onresult = event => {
      if (!isCurrent()) return;
      const finals: string[] = [];
      const pending: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        (result.isFinal ? finals : pending).push(result[0].transcript.trim());
      }
      const finalText = join(finals.join(' '));
      setTranscript(finalText);
      setInterim(pending.join(' ').slice(0, Math.max(0, LIMIT - finalText.length)));
      if (finalText.length >= LIMIT) {
        abortRecognition();
        setMessage('The transcript reached 2,000 characters. Review or shorten it before continuing.');
      }
    };
    session.onerror = event => {
      if (!isCurrent()) return;
      abortRecognition();
      if (event.error !== 'aborted') setMessage(ERRORS[event.error] || 'Speech recognition stopped. Try again when you are ready, or type below.');
    };
    session.onend = () => {
      if (!isCurrent()) return;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
      recognitionRef.current = null;
      session.onstart = session.onresult = session.onerror = session.onend = null;
      setPhase('idle');
      setInterim('');
    };
    setPhase('starting');
    try { session.start(); } catch {
      abortRecognition();
      setMessage('The microphone could not start. Check browser permissions, or type below.');
    }
  }

  function finishListening() {
    const current = recognitionRef.current;
    if (!current) return;
    setPhase('stopping');
    try {
      current.stop();
      stopTimerRef.current = setTimeout(() => {
        if (recognitionRef.current === current) abortRecognition();
      }, 3000);
    } catch { abortRecognition(); }
  }

  function editTranscript(value: string) {
    abortRecognition();
    setTranscript(value.slice(0, LIMIT));
    setMessage('');
  }

  function readText(text: string, kind: 'card' | 'reply') {
    if (!supportsOutput || !text.trim()) return;
    abortRecognition();
    stopReading();
    setMessage('');
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find(item => item.voiceURI === voiceURI)
      || voices.find(item => item.lang.toLowerCase() === 'en-gb' && item.localService)
      || voices.find(item => item.lang.toLowerCase() === 'en-gb');
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'en-GB';
    utterance.rate = 0.95;
    utteranceRef.current = utterance;
    readingKindRef.current = kind;
    setReading(kind);
    utterance.onend = () => {
      if (utteranceRef.current !== utterance || !mountedRef.current) return;
      utteranceRef.current = null;
      readingKindRef.current = null;
      setReading(null);
    };
    utterance.onerror = () => {
      if (utteranceRef.current !== utterance || !mountedRef.current) return;
      utteranceRef.current = null;
      readingKindRef.current = null;
      setReading(null);
      setMessage('The selected browser voice could not read this text. Try another voice if one is available.');
    };
    try { window.speechSynthesis.speak(utterance); } catch {
      stopReading();
      setMessage('Read aloud is unavailable in this browser. You can still read the text here.');
    }
  }

  function runCommand() {
    stopReading();
    setMessage('');
    const result = onCommand(transcript.trim());
    setReply(result.message);
    if (result.ok) setTranscript('');
    if (speakReplies) readText(result.message, 'reply');
  }

  return <dialog
    ref={dialogRef}
    className="voice-panel"
    aria-labelledby="voice-panel-title"
    aria-describedby="voice-panel-description"
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    } }}
  >
    <header className="voice-panel-header">
      <div><span className="eyebrow"><AudioLines size={13} aria-hidden="true"/>YOUR WORKSPACE, OUT LOUD</span><h2 id="voice-panel-title">Voice companion</h2></div>
      <button type="button" className="icon-button" onClick={close} aria-label="Close voice companion" autoFocus><X size={19}/></button>
    </header>
    <p id="voice-panel-description" className="voice-intro">Speak a question, navigate your workspace, or listen to a selected card.</p>
    <div className="voice-persona-label"><strong>{MAYA_PERSONA.name} · {MAYA_PERSONA.tagline}</strong><span>Case-file-based persona. Synthetic browser speech, not Maya’s original voice.</span></div>

    <section className="voice-input-section" aria-labelledby="voice-input-title">
      <div className="voice-section-title"><h3 id="voice-input-title">Speak or type</h3><span className={`voice-status ${active ? 'is-active' : ''}`} role="status">{phase === 'starting' ? 'Starting microphone…' : phase === 'listening' ? 'Listening' : phase === 'stopping' ? 'Finishing…' : 'Microphone off'}</span></div>
      {supportsInput ? <button type="button" className={`voice-listen-button ${active ? 'is-active' : ''}`} onClick={phase === 'starting' ? abortRecognition : active ? finishListening : startListening} disabled={phase === 'stopping'}>
        {active ? <MicOff size={19}/> : <Mic size={19}/>}<span>{phase === 'starting' ? 'Cancel listening' : phase === 'listening' ? 'Stop listening' : phase === 'stopping' ? 'Finishing transcript…' : 'Start listening'}</span>
      </button> : <p className="voice-support-note"><MicOff size={17} aria-hidden="true"/><span>This browser does not offer speech recognition. Type a question or command below; all other canvas controls still work.</span></p>}
      <label className="voice-transcript-label" htmlFor="voice-transcript">Your words <span>Editable before use</span></label>
      <textarea id="voice-transcript" ref={textareaRef} value={transcript} onChange={event => editTranscript(event.target.value)} maxLength={LIMIT} rows={4} placeholder="Try “Show reports”, or dictate a follower’s question…" aria-describedby="voice-transcript-help"/>
      {interim && <p className="voice-interim" aria-live="polite"><span>Hearing:</span> {interim}</p>}
      <div id="voice-transcript-help" className="voice-transcript-meta"><span>{active ? 'Editing the text stops dictation.' : 'Review your words, then choose an action.'}</span><span>{transcript.length.toLocaleString()} / 2,000</span></div>
      {message && <p className="voice-message" role="status">{message}</p>}
      <div className="voice-transcript-actions">
        <button type="button" className="primary small" disabled={!transcript.trim() || active} onClick={() => { stopReading(); onQuestion(transcript.trim()); setTranscript(''); }}><ArrowUpRight size={15}/>Use as question</button>
        <button type="button" className="secondary small" disabled={!transcript.trim() || active} onClick={runCommand}><Play size={13}/>Run command</button>
        <button type="button" className="quiet-button" disabled={!transcript && !interim} onClick={() => editTranscript('')}>Clear</button>
      </div>
    </section>

    <section className="voice-reply-section" aria-labelledby="voice-reply-title">
      <div className="voice-section-title"><h3 id="voice-reply-title">Maya’s reply</h3><span className="voice-reply-label">Case-file persona</span></div>
      <p className="voice-reply-text" role="status" aria-live="polite" aria-atomic="true">{reply}</p>
      <label className="voice-speak-replies"><input type="checkbox" checked={speakReplies} disabled={!supportsOutput} onChange={event => { setSpeakReplies(event.target.checked); if (!event.target.checked && readingKindRef.current === 'reply') stopReading(); }}/><span>Speak replies</span><small>{speakReplies ? 'Reads new replies' : 'Off by default'}</small></label>
      {supportsOutput ? <div className="voice-reply-actions">
        <button type="button" className="secondary small" disabled={!reply.trim() || reading === 'reply' || active} onClick={() => readText(reply, 'reply')}><Volume2 size={15}/>{reading === 'reply' ? 'Reading Maya’s reply…' : 'Read Maya’s reply'}</button>
        <button type="button" className="quiet-button" disabled={reading !== 'reply'} onClick={stopReading}><Square size={12}/>Stop reading</button>
      </div> : <p className="voice-reply-unavailable">Spoken replies are not available in this browser.</p>}
    </section>

    <section className="voice-command-section" aria-labelledby="voice-commands-title"><h3 id="voice-commands-title">Things you can say</h3><div className="voice-command-list">{COMMANDS.map(command => <button type="button" key={command} onClick={() => { editTranscript(command); textareaRef.current?.focus(); }}>{command}</button>)}</div><p>Choose a phrase to try it. Commands navigate or prepare a draft; approval and publishing stay with you.</p></section>

    <section className="voice-output-section" aria-labelledby="voice-output-title"><div className="voice-section-title"><h3 id="voice-output-title">Listen to your evidence</h3><Volume2 size={17} aria-hidden="true"/></div>
      <p>{selectedText.trim() ? 'Read the card currently selected on your canvas.' : 'Select a question, product, answer or issue on the canvas, then open voice to hear it.'}</p>
      {supportsOutput ? <>
        {voices.length > 0 && <label className="voice-picker">Reading voice<select value={voiceURI} onChange={event => { stopReading(); setVoiceURI(event.target.value); }}><option value="">Automatic · UK English preferred</option>{voices.map((voice, index) => <option key={`${voice.voiceURI}-${index}`} value={voice.voiceURI}>{voice.name} ({voice.lang}){voice.localService ? ' · device voice' : ''}</option>)}</select></label>}
        <div className="voice-output-actions"><button type="button" className="secondary small" disabled={!selectedText.trim() || reading === 'card' || active} onClick={() => readText(selectedText, 'card')}><Volume2 size={15}/>{reading === 'card' ? 'Reading selected card…' : 'Read selected card'}</button><button type="button" className="quiet-button" disabled={reading !== 'card'} onClick={stopReading}><Square size={12}/>Stop reading</button></div>
      </> : <p className="voice-support-note">Read aloud is not available in this browser.</p>}
    </section>
    <footer className="voice-privacy-note">Your microphone starts only when you press “Start listening”. Your browser’s speech provider may process audio online. Reading uses your selected browser voice, which may also use an online service. This app does not store audio. Text becomes part of your workspace only when you use it as a question.</footer>
  </dialog>;
}
