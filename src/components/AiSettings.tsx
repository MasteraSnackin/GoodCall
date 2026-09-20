import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CheckCircle2, LoaderCircle, Plug, Unplug } from 'lucide-react';
import { connectAi, disconnectAi, getAiStatus, setAiModel } from '../lib/aiClient';
import { AI_DEFAULT_MODELS, AI_PROVIDER_LABELS } from '../lib/aiTypes';
import type { AiProvider, AiStatus } from '../lib/aiTypes';
import { isStaticDemo } from '../lib/staticDemo';
import './AiSettings.css';

interface Props { status: AiStatus; enabled: boolean; onStatus: (status: AiStatus) => void; onEnabled: (enabled: boolean) => void; busy?: boolean }
const PROVIDER_OPTIONS: Record<AiProvider, { keyLabel: string; keyUrl: string; modelPlaceholder: string; models: { value: string; label: string }[] }> = {
  anthropic: {
    keyLabel: 'Anthropic API key',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    modelPlaceholder: 'Enter a Claude model ID',
    models: [{ value: AI_DEFAULT_MODELS.anthropic, label: 'Claude Haiku 4.5' }],
  },
  openai: {
    keyLabel: 'OpenAI API key',
    keyUrl: 'https://platform.openai.com/api-keys',
    modelPlaceholder: 'Enter an OpenAI Responses model ID',
    models: [
      { value: AI_DEFAULT_MODELS.openai, label: 'GPT-4.1 mini' },
      { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
    ],
  },
};

export default function AiSettings(props: Props) {
  if (isStaticDemo()) return <section className="ai-settings" aria-label="AI connection settings">
    <div className="ai-connection-state"><Plug size={18}/><div><strong>Hosted demo</strong><span>Answers and chat use local evidence templates.</span></div></div>
    <p>Live AI is not connected in this hosted version. You can explore the canvas and review drafts using the example evidence.</p>
    <p className="ai-settings-note">API keys cannot be entered here. Use the local app to connect Claude or OpenAI.</p>
    <p className="ai-settings-note">Tano and social accounts are not connected. Voice uses your browser’s speech features.</p>
  </section>;
  return <LocalAiSettings {...props}/>;
}

function LocalAiSettings({ status, enabled, onStatus, onEnabled, busy = false }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<AiProvider>(status.provider);
  const [model, setModel] = useState(status.model);
  const [working, setWorking] = useState(true);
  const operation = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { setProvider(status.provider); setModel(status.model); setApiKey(''); }, [status.provider, status.model]);
  // A closed dialog must never apply a late result over a newer connection action.
  // Read authoritative state on reopen in case the server committed before cancellation.
  useEffect(() => {
    const controller = new AbortController(); operation.current = controller;
    getAiStatus(controller.signal).then(next => {
      if (!isCurrent(controller)) return;
      if (next.configured !== status.configured || next.provider !== status.provider || next.model !== status.model || next.source !== status.source) onStatus(next);
    }).catch(() => { if (isCurrent(controller)) setError('The current AI connection could not be checked. Try reopening AI settings.'); })
      .finally(() => { if (isCurrent(controller)) setWorking(false); });
    return () => { operation.current?.abort(); operation.current = null; };
  }, []);
  function startOperation() { operation.current?.abort(); const controller = new AbortController(); operation.current = controller; return controller; }
  function isCurrent(controller: AbortController) { return operation.current === controller && !controller.signal.aborted; }
  function chooseProvider(next: AiProvider) {
    setProvider(next); setApiKey(''); setModel(AI_DEFAULT_MODELS[next]); setError(''); setNotice('');
  }
  async function connect() {
    if (!apiKey.trim() || !model.trim() || working || busy) return;
    const key = apiKey.trim(); setApiKey(''); setWorking(true); setError(''); setNotice('');
    const controller = startOperation();
    try { const next = await connectAi(key, model.trim(), controller.signal, provider); if (!isCurrent(controller)) return; onStatus(next); onEnabled(true); setNotice('Model access checked. Generating answers still requires available API credit and account capacity.'); }
    catch (problem) { if (isCurrent(controller)) setError(problem instanceof Error ? problem.message : 'The AI connection could not be checked.'); }
    finally { if (isCurrent(controller)) setWorking(false); }
  }
  async function disconnect() {
    if (working || busy) return;
    setWorking(true); setError(''); setNotice('');
    const controller = startOperation();
    try { const next = await disconnectAi(controller.signal); if (!isCurrent(controller)) return; onStatus(next); onEnabled(false); setNotice('AI disconnected. Existing drafts are unchanged.'); }
    catch (problem) { if (isCurrent(controller)) setError(problem instanceof Error ? problem.message : 'The connection could not be changed.'); }
    finally { if (isCurrent(controller)) setWorking(false); }
  }
  async function changeModel() {
    const selectedModel = model.trim();
    if (!status.configured || provider !== status.provider || !selectedModel || selectedModel === status.model || working || busy) return;
    setWorking(true); setError(''); setNotice('');
    const controller = startOperation();
    try { const next = await setAiModel(selectedModel, controller.signal); if (!isCurrent(controller)) return; onStatus(next); setNotice(`Model changed to ${next.model}. Your next AI request will use it.`); }
    catch (problem) { if (isCurrent(controller)) setError(problem instanceof Error ? problem.message : 'The model could not be changed.'); }
    finally { if (isCurrent(controller)) setWorking(false); }
  }
  const options = PROVIDER_OPTIONS[provider];
  const sameProvider = status.configured && status.provider === provider;
  const knownModel = options.models.some(option => option.value === model);
  const modelFields = <>
    <label className="field">Model<select aria-label="AI model" value={knownModel ? model : 'custom'} disabled={working || busy} onChange={event => { setModel(event.target.value === 'custom' ? '' : event.target.value); setNotice(''); setError(''); }}>
      {options.models.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      <option value="custom">Another {AI_PROVIDER_LABELS[provider]} model</option>
    </select></label>
    {!knownModel && <label className="field">Model ID<input aria-label="Custom AI model" value={model} maxLength={100} placeholder={options.modelPlaceholder} onChange={event => setModel(event.target.value)} disabled={working || busy}/></label>}
  </>;
  return <section className="ai-settings" aria-label="AI connection settings">
    <div className={`ai-connection-state ${status.configured ? 'is-ready' : ''}`}><Plug size={18}/><div><strong>{status.configured ? `${AI_PROVIDER_LABELS[status.provider]} configured` : 'Connect live AI'}</strong><span>{status.configured ? status.model : 'Draft answers and chat using Maya’s evidence.'}</span></div></div>
    <p>Live AI receives the question, relevant chat context and supporting case-file records. It suggests answers in Maya’s style, with evidence references. You review each draft before publishing.</p>
    {status.configured && <><label className="ai-enable"><input type="checkbox" checked={enabled} disabled={working || busy} onChange={event => onEnabled(event.target.checked)}/><span>Use live AI for new answers and chat</span></label><p className="ai-settings-note">{enabled ? `New requests use ${AI_PROVIDER_LABELS[status.provider]}. Existing answers keep their current wording.` : 'New requests use the local evidence templates.'} {status.source === 'session' ? 'The key is held in this local server session and is forgotten when the server restarts.' : 'The key is configured in the server environment.'}</p><button className="secondary full" onClick={disconnect} disabled={working || busy}><Unplug size={15}/>Disconnect AI</button></>}
    <label className="field">Provider<select aria-label="AI provider" value={provider} disabled={working || busy} onChange={event => chooseProvider(event.target.value as AiProvider)}>
      <option value="anthropic">Claude (Anthropic)</option>
      <option value="openai">OpenAI</option>
    </select></label>
    {sameProvider ? <form className="ai-model-form" onSubmit={event => { event.preventDefault(); void changeModel(); }}>
      {modelFields}
      <p className="ai-settings-note">Uses your existing key. We check access before switching; if the check fails, your current model stays active. Changing models does not restore API credit or account limits.</p>
      <button className="primary full" type="submit" disabled={!model.trim() || model.trim() === status.model || working || busy}>{working ? <LoaderCircle className="ai-spinner" size={16}/> : <CheckCircle2 size={16}/>} {working ? 'Checking model…' : 'Use selected model'}</button>
    </form> : <form onSubmit={event => { event.preventDefault(); void connect(); }}>
      {status.configured && <p className="ai-settings-note">Your current {AI_PROVIDER_LABELS[status.provider]} connection stays active until the new {AI_PROVIDER_LABELS[provider]} connection passes its model access check.</p>}
      <label className="field">{options.keyLabel}<input aria-label={options.keyLabel} type="password" autoComplete="off" spellCheck={false} value={apiKey} maxLength={1000} placeholder="Enter your API key here" onChange={event => setApiKey(event.target.value)} disabled={working || busy}/></label>
      {modelFields}
      <p className="ai-settings-note">The key goes only to this local server and {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}. It is held only for this server session and is forgotten when the server restarts. It is not saved in browser storage, workspace backups or the repository. Connecting checks model access; generating answers still requires available API credit and account capacity.</p>
      <button className="primary full" type="submit" disabled={!apiKey.trim() || !model.trim() || working || busy}>{working ? <LoaderCircle className="ai-spinner" size={16}/> : <CheckCircle2 size={16}/>} {working ? 'Checking connection…' : 'Connect and enable AI'}</button>
      <a className="ai-key-link" href={options.keyUrl} target="_blank" rel="noreferrer">Create or manage an {options.keyLabel}<ArrowUpRight size={13}/></a>
    </form>}
    {error && <p className="ai-message ai-message--error" role="alert">{error}</p>}
    {notice && <p className="ai-message" role="status">{notice}</p>}
    <p className="ai-settings-note">Tano and social accounts remain separate connections. The voice feature uses synthetic browser speech.</p>
  </section>;
}
