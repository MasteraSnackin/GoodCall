import { useState } from 'react';
import { ArrowUpRight, CheckCircle2, LoaderCircle, Plug, Unplug } from 'lucide-react';
import { connectAi, disconnectAi } from '../lib/aiClient';
import type { AiStatus } from '../lib/aiTypes';
import './AiSettings.css';

interface Props { status: AiStatus; enabled: boolean; onStatus: (status: AiStatus) => void; onEnabled: (enabled: boolean) => void; busy?: boolean }

export default function AiSettings({ status, enabled, onStatus, onEnabled, busy = false }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(status.model);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function connect() {
    if (!apiKey.trim() || working || busy) return;
    const key = apiKey.trim(); setApiKey(''); setWorking(true); setError(''); setNotice('');
    try { const next = await connectAi(key, model.trim()); onStatus(next); onEnabled(true); setNotice('Connection checked. Live AI is ready for your next question.'); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'The AI connection could not be checked.'); }
    finally { setWorking(false); }
  }
  async function disconnect() {
    setWorking(true); setError(''); setNotice('');
    try { onStatus(await disconnectAi()); onEnabled(false); setNotice('AI disconnected. Existing drafts are unchanged.'); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'The connection could not be changed.'); }
    finally { setWorking(false); }
  }
  return <section className="ai-settings" aria-label="AI connection settings">
    <div className={`ai-connection-state ${status.configured ? 'is-ready' : ''}`}><Plug size={18}/><div><strong>{status.configured ? 'OpenAI configured' : 'Connect live AI'}</strong><span>{status.configured ? status.model : 'Draft answers and chat using Maya’s evidence.'}</span></div></div>
    <p>Live AI receives the question, relevant chat context and supporting case-file records. It suggests answers in Maya’s style, with evidence references. You review each draft before publishing.</p>
    {status.configured && <><label className="ai-enable"><input type="checkbox" checked={enabled} disabled={working || busy} onChange={event => onEnabled(event.target.checked)}/><span>Use live AI for new answers and chat</span></label><p className="ai-settings-note">{enabled ? 'New requests use OpenAI. Existing answers keep their current wording.' : 'New requests use the local evidence templates.'} {status.source === 'session' ? 'The key is held in this local server session and is forgotten when the server stops.' : 'The key is configured in the server environment.'}</p><button className="secondary full" onClick={disconnect} disabled={working || busy}><Unplug size={15}/>Disconnect AI</button></>}
    {!status.configured && <form onSubmit={event => { event.preventDefault(); void connect(); }}>
      <label className="field">OpenAI API key<input aria-label="OpenAI API key" type="password" autoComplete="off" spellCheck={false} value={apiKey} maxLength={1000} placeholder="Enter your API key here" onChange={event => setApiKey(event.target.value)} disabled={working || busy}/></label>
      <label className="field">Model<input aria-label="AI model" value={model} maxLength={120} onChange={event => setModel(event.target.value)} disabled={working || busy}/></label>
      <p className="ai-settings-note">The key goes only to this local server and OpenAI. It is not saved in browser storage, workspace backups or the repository. Connecting checks access; generating answers uses your API account.</p>
      <button className="primary full" type="submit" disabled={!apiKey.trim() || !model.trim() || working || busy}>{working ? <LoaderCircle className="ai-spinner" size={16}/> : <CheckCircle2 size={16}/>} {working ? 'Checking connection…' : 'Connect and enable AI'}</button>
      <a className="ai-key-link" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Create or manage an OpenAI API key<ArrowUpRight size={13}/></a>
    </form>}
    {error && <p className="ai-message ai-message--error" role="alert">{error}</p>}
    {notice && <p className="ai-message" role="status">{notice}</p>}
    <p className="ai-settings-note">Tano and social accounts remain separate connections. The voice feature uses synthetic browser speech.</p>
  </section>;
}
