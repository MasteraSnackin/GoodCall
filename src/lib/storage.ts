import type { Workspace } from './types';
import { createWorkspace } from './seed';
import { MAX_BACKUP_BYTES, parseWorkspaceBackup, validateWorkspace } from './workspaceValidation';

export const WORKSPACE_KEY = 'maya-answer-canvas-v1';
export const RECOVERY_KEY = `${WORKSPACE_KEY}-recovery`;
export const PRE_RESTORE_KEY = `${WORKSPACE_KEY}-before-restore`;
export const CORRUPT_PREFIX = `${WORKSPACE_KEY}-damaged-`;
export type StorageStatus = { ok: boolean; message: string; recoveryAvailable: boolean; damagedCopyKey?: string };
let status: StorageStatus = { ok: true, message: 'Workspace changes save in this browser.', recoveryAvailable: false };
const listeners = new Set<() => void>();
export function getWorkspaceStorageStatus() { return status; }
export function subscribeWorkspaceStorage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function report(next: StorageStatus) { status = next; listeners.forEach(listener => listener()); }
function failed(message: string) { report({ ...status, ok: false, message }); return false; }
function readValid(key: string): Workspace | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const result = parseWorkspaceBackup(raw);
  return result.ok ? result.workspace : null;
}
/** A damaged primary is never replaced until its exact bytes have been preserved. */
function preserveDamaged(raw: string): string | null {
  try {
    if (status.damagedCopyKey && localStorage.getItem(status.damagedCopyKey) === raw) return status.damagedCopyKey;
    const key = `${CORRUPT_PREFIX}${uid('copy')}`;
    localStorage.setItem(key, raw);
    if (localStorage.getItem(key) !== raw) return null;
    return key;
  } catch { return null; }
}
export function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    const recovery = readValid(RECOVERY_KEY);
    if (raw) {
      const parsed = parseWorkspaceBackup(raw);
      if (parsed.ok) {
        report({ ok: true, message: 'Workspace loaded from this browser.', recoveryAvailable: !!recovery });
        return parsed.workspace;
      }
      const damagedCopyKey = preserveDamaged(raw);
      report({ ok: false, recoveryAvailable: !!recovery, ...(damagedCopyKey ? { damagedCopyKey } : {}), message: damagedCopyKey
        ? `The stored workspace was damaged. Its original data has been preserved. ${recovery ? 'The last valid recovery copy is open.' : 'The supplied case-file workspace is open.'}`
        : 'The stored workspace was damaged and could not be copied. Saving is blocked to protect the original data. Download a backup of your current work before freeing browser storage.' });
      return recovery ?? createWorkspace();
    }
    report({ ok: true, message: recovery ? 'The primary workspace was missing. The last valid recovery copy is open.' : 'The supplied case-file workspace is open.', recoveryAvailable: !!recovery });
    return recovery ?? createWorkspace();
  } catch {
    report({ ok: false, message: 'Browser storage is unavailable. Changes cannot be saved here; download a workspace backup.', recoveryAvailable: false });
  }
  return createWorkspace();
}

export function saveWorkspace(workspace: Workspace): boolean {
  const checked = validateWorkspace(workspace);
  if (!checked.ok) return failed(`Changes were not saved: ${checked.error}`);
  try {
    const next = JSON.stringify(workspace);
    if (new Blob([next]).size > MAX_BACKUP_BYTES) return failed('Changes were not saved: this workspace exceeds the 5 MB limit. Download a backup before making space.');
    const previous = localStorage.getItem(WORKSPACE_KEY);
    let recoveryAvailable = status.recoveryAvailable;
    if (previous === next) { report({ ...status, ok: true, message: status.damagedCopyKey ? 'Changes are saved. The damaged original remains preserved in this browser.' : 'All workspace changes are saved in this browser.' }); return true; }
    if (previous) {
      if (parseWorkspaceBackup(previous).ok) {
        // If this write fails, keep the primary untouched rather than discarding the rollback copy.
        localStorage.setItem(RECOVERY_KEY, previous);
        recoveryAvailable = true;
      } else {
        const damagedCopyKey = preserveDamaged(previous);
        if (!damagedCopyKey) return failed('Changes were not saved: the damaged original could not be preserved. Download your current workspace backup before freeing browser storage.');
        status = { ...status, damagedCopyKey };
      }
    }
    localStorage.setItem(WORKSPACE_KEY, next);
    report({ ...status, ok: true, recoveryAvailable, message: status.damagedCopyKey ? 'Changes are saved. The damaged original remains preserved in this browser.' : 'All workspace changes are saved in this browser.' });
    return true;
  } catch { return failed('Changes were not saved. Browser storage may be full or unavailable. Download a workspace backup.'); }
}

export function workspaceBackupText(workspace: Workspace): string {
  const checked = validateWorkspace(workspace);
  if (!checked.ok) throw new Error(checked.error);
  const text = JSON.stringify({ format: 'goodcall-workspace', version: 1, exportedAt: new Date().toISOString(), workspace });
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('This workspace exceeds the 5 MB backup limit.');
  return text;
}
export function getRecoverySnapshots(): { key: string; label: string; workspace: Workspace }[] {
  try {
    return [{ key: RECOVERY_KEY, label: 'Previous saved workspace' }, { key: PRE_RESTORE_KEY, label: 'Workspace before the last restore' }].flatMap(item => {
      const workspace = readValid(item.key);
      return workspace ? [{ ...item, workspace }] : [];
    });
  } catch { return []; }
}
/** Commit only after both the live pre-restore version and any damaged primary are safe. */
export function restoreWorkspace(next: Workspace, current: Workspace): boolean {
  const checked = validateWorkspace(next), currentCheck = validateWorkspace(current);
  if (!checked.ok || !currentCheck.ok) return failed(`Restore was cancelled: ${!checked.ok ? checked.error : !currentCheck.ok ? currentCheck.error : 'invalid workspace'}`);
  try {
    const currentRaw = JSON.stringify(current), nextRaw = JSON.stringify(next);
    if ([currentRaw, nextRaw].some(raw => new Blob([raw]).size > MAX_BACKUP_BYTES)) return failed('Restore was cancelled: a workspace exceeds the 5 MB limit.');
    const primary = localStorage.getItem(WORKSPACE_KEY);
    if (primary && !parseWorkspaceBackup(primary).ok) {
      const damagedCopyKey = preserveDamaged(primary);
      if (!damagedCopyKey) return failed('Restore was cancelled because the damaged original could not be preserved. Your current workspace is unchanged.');
      status = { ...status, damagedCopyKey };
    }
    localStorage.setItem(PRE_RESTORE_KEY, currentRaw);
    localStorage.setItem(RECOVERY_KEY, currentRaw);
    localStorage.setItem(WORKSPACE_KEY, nextRaw);
    report({ ...status, ok: true, recoveryAvailable: true, message: 'Workspace restored and saved. Your previous workspace is available under recovery copies.' });
    return true;
  } catch { return failed('Restore was cancelled because browser storage could not save both workspaces. Your current workspace is unchanged. Download a backup before freeing space.'); }
}
export function downloadText(filename:string,text:string,type='text/markdown') { const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
export function uid(prefix='item'){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;}
