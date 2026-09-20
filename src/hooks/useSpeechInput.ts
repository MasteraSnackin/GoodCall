import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onstart: (() => void) | null; onend: (() => void) | null;
  onaudiostart?: (() => void) | null; onspeechstart?: (() => void) | null; onnomatch?: (() => void) | null;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
type Phase = 'idle' | 'starting' | 'listening' | 'stopping';
type ActiveSession = { cancel: () => void; stop: () => void };

export const SPEECH_INPUT_TIMING = { startup: 10_000, result: 20_000, stop: 3_000 };
export const PARTIAL_TRANSCRIPT_NOTICE = 'Unconfirmed words kept as editable text. Review them before using this transcript.';
const PERMISSION_HELP = 'Check microphone permissions for this browser or app and in your device settings, and check the selected input device. You can type below instead.';
const ERRORS: Record<string, string> = {
  'not-allowed': `Microphone access was not allowed. ${PERMISSION_HELP}`,
  'service-not-allowed': 'Speech recognition is not permitted in this browser. You can type below instead.',
  'audio-capture': `The browser could not capture microphone audio. ${PERMISSION_HELP}`,
  'no-speech': 'The browser reported that no speech was detected. Try again when you are ready, or type below.',
  'language-not-supported': 'This browser’s speech service does not support UK English. You can type below instead.',
  network: 'The browser’s speech service could not connect. Check your connection, or type below.',
};

function inputConstructor() {
  if (typeof window === 'undefined') return undefined;
  const browser = window as SpeechWindow;
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}

/** Browser recognition is a capability check only; capture and service progress need their own events. */
export function useSpeechInput(limit = 2000) {
  const mountedRef = useRef(true);
  const sessionRef = useRef<ActiveSession | null>(null);
  const textRef = useRef('');
  const [text, setTextState] = useState('');
  const [interim, setInterim] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [signal, setSignal] = useState<'waiting' | 'audio' | 'speech' | 'words'>('waiting');
  const [notice, setNotice] = useState('');
  const [hasPartial, setHasPartial] = useState(false);

  const setText = useCallback((value: string) => {
    textRef.current = value.slice(0, limit);
    setTextState(textRef.current);
    setHasPartial(false);
  }, [limit]);

  const cancel = useCallback(() => { sessionRef.current?.cancel(); }, []);
  const isActive = useCallback(() => sessionRef.current !== null, []);
  const edit = useCallback((value: string) => { cancel(); setText(value); setNotice(''); }, [cancel, setText]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; cancel(); };
  }, [cancel]);

  const start = useCallback(() => {
    const Constructor = inputConstructor();
    if (!Constructor || sessionRef.current) return;
    setNotice('');
    if (textRef.current.length >= limit) {
      setNotice('The transcript is full. Clear or shorten it before listening again.');
      return;
    }
    let recognition: Recognition;
    try { recognition = new Constructor(); }
    catch { setNotice('Speech recognition could not start in this browser. You can type below instead.'); return; }

    const prefix = textRef.current.trim();
    const join = (...parts: string[]) => parts.filter(Boolean).join(' ').slice(0, limit);
    let finalText = prefix;
    let currentInterim = '';
    let currentWords = '';
    let started = false;
    let stopping = false;
    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    const current = () => mountedRef.current && sessionRef.current === session;
    const clearTimers = () => { clearTimeout(waitTimer); clearTimeout(stopTimer); };

    const finish = (message = '', preservePartial = true, abort = true) => {
      if (sessionRef.current !== session) return;
      sessionRef.current = null;
      clearTimers();
      recognition.onstart = recognition.onend = recognition.onresult = recognition.onerror = null;
      recognition.onaudiostart = recognition.onspeechstart = recognition.onnomatch = null;
      if (abort) { try { recognition.abort(); } catch { /* The service may already have ended. */ } }
      if (!mountedRef.current) return;
      if (preservePartial && currentInterim) {
        const recovered = join(finalText, currentInterim);
        textRef.current = recovered;
        setTextState(recovered);
        if (recovered !== finalText) setHasPartial(true);
      }
      setInterim('');
      setPhase('idle');
      setSignal('waiting');
      setNotice(message);
    };

    const waitForWords = () => {
      clearTimeout(waitTimer);
      if (stopping) return;
      waitTimer = setTimeout(() => {
        if (current()) finish(currentWords
          ? 'The browser’s speech service stopped returning new words. Review the text below, then try again if needed.'
          : `The browser’s speech service returned no words. ${PERMISSION_HELP}`);
      }, SPEECH_INPUT_TIMING.result);
    };
    const markStarted = () => {
      if (started || stopping) return;
      started = true;
      setPhase('listening');
      waitForWords();
    };
    const session: ActiveSession = {
      cancel: () => finish('', false),
      stop: () => {
        if (!current() || stopping) return;
        stopping = true;
        clearTimeout(waitTimer);
        setPhase('stopping');
        // Install the timer before stop: browsers may fire onend synchronously or send a delayed final result.
        stopTimer = setTimeout(() => {
          if (current()) finish('The browser’s speech service did not finish in time. Review any text below before using it.');
        }, SPEECH_INPUT_TIMING.stop);
        try { recognition.stop(); }
        catch { finish('The browser’s speech service could not finish the transcript. Review any text below before using it.'); }
      },
    };
    sessionRef.current = session;
    recognition.lang = 'en-GB'; recognition.continuous = true; recognition.interimResults = true; recognition.maxAlternatives = 1;
    recognition.onstart = () => { if (current()) markStarted(); };
    recognition.onaudiostart = () => { if (current()) { markStarted(); setSignal('audio'); } };
    recognition.onspeechstart = () => { if (current()) { markStarted(); setSignal('speech'); } };
    recognition.onresult = event => {
      if (!current()) return;
      markStarted();
      const finals: string[] = [], pending: string[] = [];
      // Each event contains the complete current result list. Replacing the snapshot avoids duplicates
      // and does not bring back an interim hypothesis that a later event shortened or removed.
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index];
        const words = result[0]?.transcript.trim();
        if (words) (result.isFinal ? finals : pending).push(words);
      }
      const words = [...finals, ...pending].join(' ');
      if (words !== currentWords) waitForWords();
      currentWords = words;
      finalText = join(prefix, finals.join(' '));
      const remaining = Math.max(0, limit - finalText.length - (finalText ? 1 : 0));
      currentInterim = pending.join(' ').slice(0, remaining);
      textRef.current = finalText;
      setTextState(finalText);
      setInterim(currentInterim);
      if (words) setSignal('words');
      if (join(finalText, currentInterim).length >= limit) {
        finish('The transcript reached 2,000 characters. Review or shorten it before continuing.');
      }
    };
    recognition.onerror = event => {
      if (current()) finish(ERRORS[event.error] || 'Speech recognition stopped. Review any text below, then try again or type instead.');
    };
    recognition.onnomatch = () => {
      if (current()) finish('The browser’s speech service could not recognise usable words. Review any text below, then try again or type instead.');
    };
    recognition.onend = () => {
      if (current()) finish(currentWords ? '' : 'The browser’s speech service ended without returning words. Try again, or type below.', true, false);
    };
    setPhase('starting');
    setSignal('waiting');
    setInterim('');
    waitTimer = setTimeout(() => {
      if (current()) finish(`The browser’s speech service did not start. ${PERMISSION_HELP}`);
    }, SPEECH_INPUT_TIMING.startup);
    try { recognition.start(); }
    catch { finish(`Speech recognition could not start. ${PERMISSION_HELP}`); }
  }, [limit]);

  const stop = useCallback(() => { sessionRef.current?.stop(); }, []);
  const status = phase === 'starting' ? 'Starting speech service…'
    : phase === 'stopping' ? 'Finishing transcript…'
      : phase === 'idle' ? 'Microphone off'
        : signal === 'waiting' ? 'Speech service ready · waiting for audio'
          : signal === 'audio' ? 'Listening'
            : signal === 'speech' ? 'Speech detected · waiting for words'
              : 'Recognising words · review before using';
  return { text, setText, interim, phase, status, notice, setNotice, hasPartial, start, stop, cancel, edit, isActive,
    active: phase !== 'idle', supported: Boolean(inputConstructor()) };
}
