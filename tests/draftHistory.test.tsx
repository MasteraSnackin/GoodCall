import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DraftComparison, DraftHistory } from '../src/components/DraftHistory';
import { checkpointDraft } from '../src/lib/draftHistory';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer } from '../src/lib/engine';

function draft() {
  const workspace = createWorkspace();
  return draftAnswer(workspace.questions[3], workspace.products);
}

describe('Saved draft wording', () => {
  it('explains the empty state and the review boundary', () => {
    render(<DraftHistory draft={draft()} onRestore={() => {}}/>);
    expect(screen.getByText(/No earlier versions yet/)).toBeTruthy();
    expect(screen.getByText(/Restoring brings back the wording.*current evidence/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows saved wording and complete decision details with a named restore action', () => {
    const original = { ...draft(), text: 'This is the original edited wording.' };
    const current = { ...checkpointDraft(original, 'Before evidence refresh', { now: '2026-09-20T12:00:00.000Z' }), text: 'New suggested wording.' };
    const restore = vi.fn();
    render(<DraftHistory draft={current} onRestore={restore}/>);
    fireEvent.click(screen.getByText('Before evidence refresh'));
    expect(screen.getByText(original.text)).toBeTruthy();
    expect(screen.getByText(original.decision!.skipIf)).toBeTruthy();
    expect(screen.getByText(original.decision!.unknowns)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore wording from version 1' }));
    expect(restore).toHaveBeenCalledWith(current.history![0].id);
  });

  it('compares both complete drafts and offers independent keep, replace and cancel actions', () => {
    const current = { ...draft(), text: 'My existing answer.' };
    const suggested = { ...draft(), text: 'A newly suggested answer.', decision: { ...current.decision!, verdict: 'Skip for now' as const, skipIf: 'The revised price stretches your budget.' } };
    const keep = vi.fn(), use = vi.fn(), cancel = vi.fn();
    render(<DraftComparison current={current} suggested={suggested} onKeepWording={keep} onUseSuggested={use} onCancel={cancel}/>);
    const left = screen.getByRole('region', { name: 'Your wording' });
    const right = screen.getByRole('region', { name: 'Updated suggestion' });
    expect(within(left).getByText(current.text)).toBeTruthy();
    expect(within(left).getByText(current.decision!.unknowns)).toBeTruthy();
    expect(within(right).getByText(suggested.text)).toBeTruthy();
    expect(within(right).getByText('Skip for now')).toBeTruthy();
    expect(within(right).getByText(suggested.decision.skipIf)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep my wording and refresh evidence' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use updated suggestion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel refresh' }));
    expect(keep).toHaveBeenCalledOnce(); expect(use).toHaveBeenCalledOnce(); expect(cancel).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
