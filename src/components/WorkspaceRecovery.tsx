import { useRef, useState, useSyncExternalStore } from 'react';
import type { Workspace } from '../lib/types';
import { downloadText, getRecoverySnapshots, getWorkspaceStorageStatus, restoreWorkspace, subscribeWorkspaceStorage, workspaceBackupText } from '../lib/storage';
import { MAX_BACKUP_BYTES, parseWorkspaceBackup } from '../lib/workspaceValidation';
import './WorkspaceRecovery.css';

type Preview = { label: string; workspace: Workspace };
function counts(workspace: Workspace) {
  return `${workspace.questions.length} questions, ${workspace.products.length} products, ${workspace.drafts.length} answers, ${workspace.issues.length} evidence issues and ${workspace.cards.length} canvas cards`;
}
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the file.'));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsText(file);
  });
}

export default function WorkspaceRecovery({ workspace, onRestore }: { workspace: Workspace; onRestore: (workspace: Workspace) => void }) {
  const storage = useSyncExternalStore(subscribeWorkspaceStorage, getWorkspaceStorageStatus, getWorkspaceStorageStatus);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const snapshots = getRecoverySnapshots();

  function backup() {
    try {
      downloadText(`goodcall-private-workspace-${new Date().toISOString().slice(0, 10)}.json`, workspaceBackupText(workspace), 'application/json');
      setError(false); setMessage('Workspace backup prepared for download. Keep it somewhere private: it includes follower questions and unpublished drafts.');
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : 'The backup could not be prepared.'); }
  }
  async function inspectFile(file?: File) {
    if (!file) return;
    const request = ++sequence.current;
    setPreview(null); setMessage(''); setError(false); setReading(false);
    if (file.size > MAX_BACKUP_BYTES) { setError(true); setMessage('This file is too large. Choose a workspace backup smaller than 5 MB.'); return; }
    setReading(true);
    try {
      const result = parseWorkspaceBackup(await readFile(file));
      if (request !== sequence.current) return;
      if (!result.ok) { setError(true); setMessage(`${result.error} Your current workspace has not changed.`); }
      else setPreview({ label: file.name, workspace: result.workspace });
    } catch { if (request === sequence.current) { setError(true); setMessage('The file could not be read. Your current workspace has not changed.'); } }
    finally { if (request === sequence.current) setReading(false); }
  }
  function confirmRestore() {
    if (!preview) return;
    if (!restoreWorkspace(preview.workspace, workspace)) { setError(true); setMessage(getWorkspaceStorageStatus().message); return; }
    onRestore(preview.workspace);
    setPreview(null); setError(false); setMessage('Workspace replaced and saved. The workspace you had open is kept as a recovery copy.');
    if (input.current) input.current.value = '';
  }

  return <section className="workspace-recovery" aria-labelledby="workspace-recovery-title">
    <h3 id="workspace-recovery-title">Workspace backup & recovery</h3>
    <p>Back up questions, product evidence, answers and their history, reports, and the canvas. Chat conversations, follower saves, feedback and visual preferences are separate and are not included.</p>
    <p className={`workspace-save-status ${storage.ok ? 'saved' : 'unsaved'}`} role="status">{storage.message}</p>
    <button type="button" className="secondary" onClick={backup}>Download private workspace backup</button>
    <label className="workspace-import">Choose a backup to restore
      <input ref={input} type="file" accept=".json,application/json" onChange={event => { void inspectFile(event.target.files?.[0]); }} />
    </label>
    {reading && <p role="status">Checking the workspace backup…</p>}
    {!!snapshots.length && <div className="workspace-recovery-copies"><h4>Recovery copies in this browser</h4><p>Previous saved versions stay on this device. A downloaded backup also protects against browser data being cleared.</p>{snapshots.map(snapshot => <button type="button" key={snapshot.key} className="secondary small" onClick={() => { ++sequence.current; setReading(false); setError(false); setMessage(''); setPreview({ label: snapshot.label, workspace: snapshot.workspace }); }}>Preview {snapshot.label.toLowerCase()}</button>)}</div>}
    {preview && <div className="workspace-restore-preview" role="region" aria-label="Restore preview"><h4>Review before replacing</h4><p><strong>{preview.label}</strong></p><p>Backup: {counts(preview.workspace)}.</p><p>Current: {counts(workspace)}.</p><p>This replaces your current workspace. A copy of the workspace you have open will be saved first; if that fails, the restore is cancelled.</p><div className="workspace-restore-actions"><button type="button" className="primary" onClick={confirmRestore}>Replace workspace</button><button type="button" className="secondary" onClick={() => { setPreview(null); if (input.current) input.current.value = ''; }}>Cancel restore</button></div></div>}
    {message && <p role={error ? 'alert' : 'status'} className={error ? 'workspace-recovery-error' : 'workspace-recovery-message'}>{message}</p>}
  </section>;
}
