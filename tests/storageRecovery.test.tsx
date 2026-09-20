import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkspaceRecovery from '../src/components/WorkspaceRecovery';
import { createWorkspace } from '../src/lib/seed';
import { loadWorkspace, PRE_RESTORE_KEY, saveWorkspace, WORKSPACE_KEY, workspaceBackupText } from '../src/lib/storage';

describe('Workspace backup and restore DOM workflow', () => {
  it('clears the checking state when a later oversized file supersedes a pending read', () => {
    loadWorkspace(); const current = createWorkspace();
    vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(() => {});
    render(<WorkspaceRecovery workspace={current} onRestore={() => {}}/>);
    const input = screen.getByLabelText('Choose a backup to restore');
    fireEvent.change(input, { target: { files: [new File(['{}'], 'pending.json')] } });
    expect(screen.getByText('Checking the workspace backup…')).toBeTruthy();
    const large = new File(['{}'], 'large.json');
    Object.defineProperty(large, 'size', { value: 5_000_001 });
    fireEvent.change(input, { target: { files: [large] } });
    expect(screen.queryByText('Checking the workspace backup…')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('too large');
    expect(screen.queryByRole('button', { name: 'Replace workspace' })).toBeNull();
  });
  it('previews a valid backup and changes nothing until Replace workspace is selected', async () => {
    loadWorkspace(); const current = createWorkspace(); saveWorkspace(current);
    const imported = createWorkspace(); imported.questions[0].text = 'Imported question';
    const onRestore = vi.fn(); render(<WorkspaceRecovery workspace={current} onRestore={onRestore}/>);
    fireEvent.change(screen.getByLabelText('Choose a backup to restore'), { target: { files: [new File([workspaceBackupText(imported)], 'private-backup.json', { type: 'application/json' })] } });
    await screen.findByRole('region', { name: 'Restore preview' });
    expect(screen.getByText(/Backup: 12 questions, 10 products/)).toBeTruthy();
    expect(onRestore).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY)!).questions[0].text).toBe(current.questions[0].text);
    fireEvent.click(screen.getByRole('button', { name: 'Replace workspace' }));
    expect(onRestore).toHaveBeenCalledWith(imported);
    expect(JSON.parse(localStorage.getItem(PRE_RESTORE_KEY)!)).toEqual(current);
    expect(screen.queryByRole('region', { name: 'Restore preview' })).toBeNull();
  });

  it('rejects malformed nested data and cancelling a preview leaves the current workspace intact', async () => {
    loadWorkspace(); const current = createWorkspace(); saveWorkspace(current);
    const onRestore = vi.fn(); render(<WorkspaceRecovery workspace={current} onRestore={onRestore}/>);
    const input = screen.getByLabelText('Choose a backup to restore');
    const malformed = { ...current, drafts: [null] };
    fireEvent.change(input, { target: { files: [new File([JSON.stringify(malformed)], 'bad.json')] } });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Replace workspace' })).toBeNull();
    expect(onRestore).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File([workspaceBackupText(current)], 'valid.json')] } });
    await screen.findByRole('region', { name: 'Restore preview' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel restore' }));
    expect(onRestore).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY)!)).toEqual(current);
  });

  it('does not change the open workspace when saving the recovery guard fails', async () => {
    loadWorkspace(); const current = createWorkspace(); saveWorkspace(current);
    const onRestore = vi.fn(); render(<WorkspaceRecovery workspace={current} onRestore={onRestore}/>);
    fireEvent.change(screen.getByLabelText('Choose a backup to restore'), { target: { files: [new File([workspaceBackupText(current)], 'restore.json')] } });
    await screen.findByRole('button', { name: 'Replace workspace' });
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) { if (key === PRE_RESTORE_KEY) throw new Error('Quota exceeded'); original.call(this, key, value); });
    fireEvent.click(screen.getByRole('button', { name: 'Replace workspace' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Restore was cancelled/));
    expect(onRestore).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(WORKSPACE_KEY)!)).toEqual(current);
  });

  it('offers a preview of the previous saved workspace and explains backup scope', () => {
    loadWorkspace(); const current = createWorkspace(); saveWorkspace(current);
    const next = structuredClone(current); next.questions[0].text = 'Changed'; saveWorkspace(next);
    render(<WorkspaceRecovery workspace={next} onRestore={() => {}}/>);
    expect(screen.getByText(/Chat conversations, follower saves, feedback and visual preferences/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Preview previous saved workspace' }));
    expect(screen.getByRole('region', { name: 'Restore preview' })).toBeTruthy();
  });
});
