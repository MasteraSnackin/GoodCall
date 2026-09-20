import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, BookOpen, Check, ChevronDown, MessageCircle, Mic, MicOff, Plus, Square, Volume2, X } from 'lucide-react';
import type { ChatMessage } from '../lib/chat';
import './ChatPanel.css';

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onstart: (() => void) | null; onend: (() => void) | null;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onAddQuestion: (text: string) => void;
  onClear: () => void;
  selectedLabel?: string;
  storageError?: string;
}

const LIMIT = 2000;
const SUGGESTIONS = ['What’s missing?', 'Explain selected card', 'Is Cloud Cream worth £38?'];
const INPUT_ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was not allowed. You can type your message instead.',
  'service-not-allowed': 'This browser does not permit speech recognition. Type your message instead.',
  'audio-capture': 'No microphone was available. Check the microphone, or type your message.',
  'no-speech': 'No speech was detected. Try again, or type your message.',
  'language-not-supported': 'UK English dictation is unavailable in this browser. You can type instead.',
  network: 'The browser’s speech service could not connect. You can type your message instead.',
};
function inputConstructor() {
  if (typeof window === 'undefined') return undefined;
  const browser = window as SpeechWindow;
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}

export default function ChatPanel({ open, onClose, messages, onSend, onAddQuestion, onClear, selectedLabel, storageError }: ChatPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const readingAutoRef = useRef(false);
  const mountedRef = useRef(true);
  const seenIdsRef = useRef(new Set(messages.map(message => message.id)));
  const wasOpenRef = useRef(false);
  const [composer, setComposer] = useState('');
  const [interim, setInterim] = useState('');
  const [phase, setPhase] = useState<'idle' | 'starting' | 'listening' | 'stopping'>('idle');
  const [notice, setNotice] = useState('');
  const [readingId, setReadingId] = useState<string | null>(null);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set());
  const supportsInput = Boolean(inputConstructor());
  const supportsOutput = typeof window !== 'undefined' && Boolean(window.speechSynthesis) && typeof window.SpeechSynthesisUtterance === 'function';
  const active = phase !== 'idle';

  const abortListening = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    const session = recognitionRef.current;
    recognitionRef.current = null;
    if (session) {
      session.onstart = session.onresult = session.onerror = session.onend = null;
      try { session.abort(); } catch { /* A browser session may have already ended. */ }
    }
    if (mountedRef.current) { setPhase('idle'); setInterim(''); }
  }, []);

  const stopReading = useCallback(() => {
    const utterance = utteranceRef.current;
    utteranceRef.current = null;
    readingAutoRef.current = false;
    if (utterance) {
      utterance.onstart = utterance.onend = utterance.onerror = null;
      window.speechSynthesis?.cancel();
    }
    if (mountedRef.current) setReadingId(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; abortListening(); stopReading(); };
  }, [abortListening, stopReading]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open) {
      if (dialog && !dialog.open) dialog.showModal();
      setNotice('');
    } else {
      abortListening(); stopReading();
      if (dialog?.open) dialog.close();
    }
  }, [open, abortListening, stopReading]);

  useEffect(() => {
    if (!supportsOutput) return;
    const synth = window.speechSynthesis;
    const update = () => setVoices(synth.getVoices());
    update(); synth.addEventListener('voiceschanged', update);
    return () => synth.removeEventListener('voiceschanged', update);
  }, [supportsOutput]);

  useEffect(() => {
    if (open && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [messages, open]);

  const readMessage = useCallback((message: ChatMessage, automatic = false) => {
    if (!supportsOutput || !message.text.trim()) return;
    abortListening(); stopReading(); setNotice('');
    const utterance = new SpeechSynthesisUtterance(message.text);
    const voice = voices.find(item => item.voiceURI === voiceURI)
      || voices.find(item => item.lang.toLowerCase() === 'en-gb' && item.localService)
      || voices.find(item => item.lang.toLowerCase() === 'en-gb');
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'en-GB';
    utterance.rate = .95;
    utteranceRef.current = utterance;
    readingAutoRef.current = automatic;
    setReadingId(message.id);
    utterance.onend = () => {
      if (utteranceRef.current !== utterance || !mountedRef.current) return;
      utteranceRef.current = null; readingAutoRef.current = false; setReadingId(null);
    };
    utterance.onerror = () => {
      if (utteranceRef.current !== utterance || !mountedRef.current) return;
      utteranceRef.current = null; readingAutoRef.current = false; setReadingId(null);
      setNotice('The browser voice could not read that reply. Try another voice, or read the answer here.');
    };
    try { window.speechSynthesis.speak(utterance); }
    catch { stopReading(); setNotice('Read aloud is unavailable. You can still read every reply here.'); }
  }, [supportsOutput, voices, voiceURI, abortListening, stopReading]);

  useEffect(() => {
    const fresh = messages.filter(message => message.role === 'assistant' && !seenIdsRef.current.has(message.id));
    seenIdsRef.current = new Set(messages.map(message => message.id));
    if (!open) { wasOpenRef.current = false; return; }
    if (!wasOpenRef.current) { wasOpenRef.current = true; return; }
    const latest = fresh.at(-1);
    if (latest && speakReplies && !recognitionRef.current) readMessage(latest, true);
  }, [open, messages, speakReplies, readMessage]);

  function close() { abortListening(); stopReading(); onClose(); }
  function edit(value: string) { abortListening(); setComposer(value.slice(0, LIMIT)); setNotice(''); }
  function startListening() {
    const Constructor = inputConstructor();
    if (!Constructor || recognitionRef.current) return;
    stopReading(); setNotice('');
    if (composer.length >= LIMIT) { setNotice('Your message is full. Shorten it before dictating more.'); return; }
    let session: Recognition;
    try { session = new Constructor(); }
    catch { setNotice('Speech recognition could not start. You can type your message instead.'); return; }
    recognitionRef.current = session;
    session.lang = 'en-GB'; session.continuous = true; session.interimResults = true; session.maxAlternatives = 1;
    const prefix = composer.trim();
    const current = () => mountedRef.current && recognitionRef.current === session;
    session.onstart = () => { if (current()) setPhase('listening'); };
    session.onresult = event => {
      if (!current()) return;
      const final: string[] = [], pending: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        (result.isFinal ? final : pending).push(result[0].transcript.trim());
      }
      const text = [prefix, final.join(' ')].filter(Boolean).join(' ').slice(0, LIMIT);
      setComposer(text); setInterim(pending.join(' ').slice(0, LIMIT - text.length));
      if (text.length >= LIMIT) { abortListening(); setNotice('Your message reached 2,000 characters. Review it before sending.'); }
    };
    session.onerror = event => {
      if (!current()) return;
      abortListening();
      if (event.error !== 'aborted') setNotice(INPUT_ERRORS[event.error] || 'Dictation stopped. Try again when ready, or type your message.');
    };
    session.onend = () => {
      if (!current()) return;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null; recognitionRef.current = null;
      session.onstart = session.onresult = session.onerror = session.onend = null;
      setPhase('idle'); setInterim('');
    };
    setPhase('starting');
    try { session.start(); }
    catch { abortListening(); setNotice('The microphone could not start. Check browser permissions, or type your message.'); }
  }

  function finishListening() {
    const session = recognitionRef.current;
    if (!session) return;
    setPhase('stopping');
    try {
      session.stop();
      if (recognitionRef.current === session) stopTimerRef.current = setTimeout(() => { if (recognitionRef.current === session) abortListening(); }, 3000);
    } catch { abortListening(); }
  }

  function send() {
    const text = composer.trim();
    if (!text || active) return;
    stopReading(); setNotice(''); onSend(text); setComposer(''); composerRef.current?.focus();
  }

  return <dialog ref={dialogRef} className="chat-panel" aria-labelledby="chat-panel-title" aria-describedby="chat-panel-description"
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}>
    <header className="chat-panel-header">
      <div className="chat-mark" aria-hidden="true">m.</div>
      <div><h2 id="chat-panel-title">Chat with Maya</h2><p id="chat-panel-description">Local case-file assistant · no live AI</p></div>
      <button className="chat-clear" type="button" aria-label="Clear chat" disabled={!messages.length} onClick={() => { abortListening(); stopReading(); onClear(); setAddedIds(new Set()); }}>Clear history</button>
      <button type="button" className="chat-icon-button" onClick={close} aria-label="Close chat"><X size={19}/></button>
    </header>
    {selectedLabel && <div className="chat-selected"><BookOpen size={13}/><span>In view: <strong>{selectedLabel}</strong></span></div>}
    <div className="chat-history" ref={historyRef} role="log" aria-label="Conversation with Maya" aria-live="polite" aria-relevant="additions text">
      {messages.length === 0 && <div className="chat-welcome"><span className="chat-welcome-icon"><MessageCircle size={24} strokeWidth={1.4}/></span><h3>A little clarity, before the next answer.</h3><p>Ask about a product, the evidence that is missing, or the card you are working on. We’ll start with what the case file actually tells us.</p><small>Suggestions stay in this chat. You decide what becomes an audience question.</small></div>}
      {messages.map((message, index) => <article className={`chat-message chat-message--${message.role}`} key={message.id} aria-label={`${message.role === 'assistant' ? 'Maya’s reply' : 'Your message'} ${index + 1}`}>
        <span className="chat-message-author">{message.role === 'assistant' ? 'Maya · case-file persona' : 'You'}</span>
        <div className="chat-message-text">{message.text}</div>
        {message.role === 'assistant' && <>
          {!!message.sourceRefs?.length && <details className="chat-message-sources"><summary><BookOpen size={12}/>Supporting evidence <span>{message.sourceRefs.length}</span><ChevronDown size={12}/></summary><div>{message.sourceRefs.map((source, sourceIndex) => <div className="chat-source" key={`${source.label}-${sourceIndex}`}>{source.page > 0 ? <a href={`/operation-shade-case-file.pdf#page=${source.page}`} target="_blank" rel="noreferrer">{source.label} · p. {source.page}<ArrowUpRight size={11}/></a> : <span>{source.label} · workspace note</span>}<p>{source.excerpt}</p></div>)}</div></details>}
          <div className="chat-message-actions"><button type="button" disabled={!supportsOutput} onClick={() => readingId === message.id ? stopReading() : readMessage(message)}>{readingId === message.id ? <Square size={12}/> : <Volume2 size={13}/>} {readingId === message.id ? 'Stop reading' : 'Read aloud'}</button>{message.questionText && <button type="button" disabled={addedIds.has(message.id)} onClick={() => { onAddQuestion(message.questionText!); setAddedIds(previous => new Set([...previous, message.id])); }}>{addedIds.has(message.id) ? <Check size={12}/> : <Plus size={12}/>} {addedIds.has(message.id) ? 'Added to questions' : 'Add to audience questions'}</button>}</div>
        </>}
      </article>)}
    </div>
    <div className="chat-prompt-chips" aria-label="Suggested messages">{SUGGESTIONS.map(prompt => <button type="button" key={prompt} onClick={() => { edit(prompt); composerRef.current?.focus(); }}>{prompt}</button>)}</div>
    <section className="chat-compose-area" aria-label="Write or dictate a message">
      <div className="chat-voice-settings"><label><input type="checkbox" aria-label="Speak replies" checked={speakReplies} disabled={!supportsOutput} onChange={event => { setSpeakReplies(event.target.checked); if (!event.target.checked && readingAutoRef.current) stopReading(); }}/><span>Speak replies</span><small>{speakReplies ? 'New replies only' : 'Off'}</small></label>{supportsOutput && voices.length > 0 && <label className="chat-voice-picker"><span className="chat-sr-only">Reading voice</span><select aria-label="Reading voice" value={voiceURI} onChange={event => { stopReading(); setVoiceURI(event.target.value); }}><option value="">Automatic voice</option>{voices.map((voice, index) => <option key={`${voice.voiceURI}-${index}`} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}</select></label>}</div>
      {storageError && <p className="chat-notice chat-notice--error" role="alert">{storageError}</p>}
      {notice && <p className="chat-notice" role="status">{notice}</p>}
      {interim && <p className="chat-interim" aria-live="polite">Hearing: {interim}</p>}
      <form className={`chat-composer ${active ? 'is-listening' : ''}`} onSubmit={event => { event.preventDefault(); send(); }}>
        <label htmlFor="maya-chat-message" className="chat-sr-only">Message Maya</label>
        <textarea id="maya-chat-message" ref={composerRef} rows={3} maxLength={LIMIT} value={composer} placeholder="Ask a question, or talk it through…" onChange={event => edit(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }}/>
        <div className="chat-composer-tools"><span className="chat-input-status" role="status">{phase === 'starting' ? 'Starting microphone…' : phase === 'listening' ? 'Listening · review before sending' : phase === 'stopping' ? 'Finishing transcript…' : composer.length > 1700 ? `${composer.length.toLocaleString()} / 2,000` : 'Enter to send · Shift + Enter for a new line'}</span><div>
          <button type="button" className={`chat-mic ${active ? 'active' : ''}`} disabled={!supportsInput || phase === 'stopping'} aria-label={phase === 'starting' ? 'Cancel dictation' : phase === 'listening' ? 'Stop dictation' : phase === 'stopping' ? 'Finishing dictation' : 'Start dictation'} title={supportsInput ? 'Dictate your message' : 'Speech recognition is unavailable'} onClick={phase === 'starting' ? abortListening : active ? finishListening : startListening}>{active ? <MicOff size={17}/> : <Mic size={17}/>}</button>
          <button type="submit" className="chat-send" disabled={!composer.trim() || active} aria-label="Send message"><ArrowUp size={18}/></button>
        </div></div>
      </form>
      {(!supportsInput || !supportsOutput) && <p className="chat-support-note">{!supportsInput ? 'Dictation is unavailable in this browser. You can type your message. ' : ''}{!supportsOutput ? 'Read aloud is unavailable here; replies remain on screen.' : ''}</p>}
      <p className="chat-privacy">Synthetic browser voice, not a clone of Maya. Browser speech may use an online service. This app does not store audio.</p>
    </section>
  </dialog>;
}
