import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CanvasWorkflowPanel } from '../src/components/CanvasWorkflow';
import { createWorkspace } from '../src/lib/seed';
import type { Workspace } from '../src/lib/types';
import { createDecisionSection, setQuestionFollowUp } from '../src/lib/canvasWorkflow';
import type { WorkflowWorkspace } from '../src/lib/canvasWorkflow';

function harness(initial: WorkflowWorkspace, selectedCardIds: string[]) {
  let latest: WorkflowWorkspace = initial;
  const focus = vi.fn(), clarify = vi.fn(), close = vi.fn();
  function Harness() {
    const [workspace, setWorkspace] = useState<Workspace>(initial);
    latest = workspace;
    return <CanvasWorkflowPanel workspace={workspace} selectedCardIds={selectedCardIds} onChange={setWorkspace} onClose={close} onFocusCards={focus} onClarifyQuestion={clarify} />;
  }
  render(<Harness />);
  return { current: () => latest, focus, clarify, close };
}

describe('Canvas workflow panel', () => {
  it('explains that tracking and grouping do not send replies or approve evidence', () => {
    const controls = harness(createWorkspace(), []);
    expect(screen.getByRole('complementary', { name: 'Follow-ups and decision sections' })).toBeTruthy();
    expect(screen.getByText(/Copying a question does not send it/)).toBeTruthy();
    expect(screen.getByText(/Context received.*reminder only/)).toBeTruthy();
    expect(screen.getByText(/Select a question card to add/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Create section from selection' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close follow-ups and sections' }));
    expect(controls.close).toHaveBeenCalledOnce();
  });

  it('tracks a selected question and keeps context correction separate from the received marker', () => {
    const original = createWorkspace();
    const card = original.cards.find(item => item.kind === 'question')!;
    const question = original.questions.find(item => item.id === card.entityId)!;
    const controls = harness(original, [card.id]);
    fireEvent.change(screen.getByLabelText('Follow-up question'), { target: { value: 'Which finish do you prefer?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Track follow-up' }));
    expect(controls.current().questionFollowUps?.[0].prompt).toBe('Which finish do you prefer?');
    fireEvent.click(screen.getByRole('button', { name: 'Mark context received' }));
    expect(controls.current().questionFollowUps?.[0].status).toBe('Context received');
    expect(controls.current().questions).toBe(original.questions);
    expect(controls.current().drafts).toBe(original.drafts);
    expect(controls.clarify).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Update question context' }));
    expect(controls.clarify).toHaveBeenCalledWith(question.id);
    fireEvent.click(screen.getByRole('button', { name: 'Show question' }));
    expect(controls.focus).toHaveBeenCalledWith([card.id]);
    fireEvent.change(screen.getByLabelText('Follow-up question'), { target: { value: 'Which existing product works for you?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save question' }));
    expect(controls.current().questionFollowUps?.[0].status).toBe('Waiting for reply');
    expect(controls.current().questionFollowUps).toHaveLength(1);
  });

  it('reports copy success only after the clipboard promise succeeds and reports failures honestly', async () => {
    const workspace = createWorkspace();
    const card = workspace.cards.find(item => item.kind === 'question')!;
    const writeText = vi.fn<(_: string) => Promise<void>>();
    let succeed!: () => void;
    writeText.mockImplementationOnce(() => new Promise(resolve => { succeed = resolve; }));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    harness(workspace, [card.id]);
    fireEvent.change(screen.getByLabelText('Follow-up question'), { target: { value: 'What finish do you prefer?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Copy question' }));
    expect(screen.queryByText(/Copied\./)).toBeNull();
    expect(screen.getByRole('button', { name: 'Copying…' })).toBeTruthy();
    succeed();
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/^Copied\./));
    expect(writeText).toHaveBeenCalledWith('What finish do you prefer?');
    writeText.mockRejectedValueOnce(new Error('Clipboard blocked'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy question' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/^Could not copy\./));
    expect(screen.queryByText(/^Copied\./)).toBeNull();
  });

  it('makes, renames, focuses and removes sections without deleting cards or adding links', () => {
    const original = createWorkspace();
    const ids = original.cards.slice(0, 2).map(card => card.id);
    original.reviewNotes = [{ id: 'review-private', text: 'Private', x: 0, y: 0, createdAt: '2026-09-20T12:00:00Z', updatedAt: '2026-09-20T12:00:00Z' }];
    const controls = harness(original, [...ids, 'review-private']);
    fireEvent.change(screen.getByLabelText('New section name'), { target: { value: 'Worth the cost?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create section from selection' }));
    expect(controls.current().decisionSections?.[0].cardIds).toEqual(ids);
    let section = screen.getByRole('article', { name: 'Decision section: Worth the cost?' });
    fireEvent.change(within(section).getByLabelText('Section name'), { target: { value: 'Budget decision' } });
    fireEvent.click(within(section).getByRole('button', { name: 'Save name' }));
    section = screen.getByRole('article', { name: 'Decision section: Budget decision' });
    fireEvent.click(within(section).getByRole('button', { name: 'Show section' }));
    expect(controls.focus).toHaveBeenCalledWith(ids);
    fireEvent.click(within(section).getByRole('button', { name: 'Remove section' }));
    expect(controls.current().decisionSections).toEqual([]);
    expect(controls.current().cards).toBe(original.cards);
    expect(controls.current().links).toBe(original.links);
    expect(controls.current().reviewNotes).toBe(original.reviewNotes);
  });

  it('replaces section membership with the current evidence-card selection', () => {
    const original = createWorkspace();
    const grouped = createDecisionSection(original, 'Decision', [original.cards[0].id]);
    const selectedId = original.cards[2].id;
    const controls = harness(grouped, [selectedId]);
    fireEvent.click(screen.getByRole('button', { name: 'Use current selection' }));
    expect(controls.current().decisionSections?.[0].cardIds).toEqual([selectedId]);
    expect(controls.current().cards).toBe(original.cards);
  });

  it('keeps saved follow-ups visible when another type of card is selected', () => {
    const original = createWorkspace();
    const questionId = original.questions[3].id;
    const tracked = setQuestionFollowUp(original, questionId, 'Which finish do you like?');
    harness(tracked, [original.cards.find(card => card.kind === 'product')!.id]);
    expect(screen.getByRole('article', { name: 'Follow-up for @sarah' })).toBeTruthy();
    expect(screen.getByText('1 waiting · 0 received')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Track follow-up' })).toBeNull();
  });
});
