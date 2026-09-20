import React, { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer } from '../src/lib/engine';
import { useCanvasEditing } from '../src/lib/useCanvasEditing';
import type { Workspace } from '../src/lib/types';

function harness(initial: Workspace = createWorkspace()) {
  return renderHook(() => {
    const [workspace, setWorkspace] = useState(initial);
    return { workspace, setWorkspace, editing: useCanvasEditing(workspace, setWorkspace, vi.fn()) };
  }, { wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode> });
}

describe('Canvas editing transactions', () => {
  it('undoes a group as one action while preserving subsequent answer and evidence edits', () => {
    const initial = createWorkspace();
    initial.drafts = [draftAnswer(initial.questions[3], initial.products)];
    const { result } = harness(initial);
    const original = result.current.workspace;
    const group = original.cards.slice(0, 2);
    act(() => result.current.editing.move(group.map(card => ({ id: card.id, x: card.x + 160, y: card.y + 80 }))));
    expect(result.current.editing.canUndo).toBe(true);
    act(() => result.current.setWorkspace(workspace => ({
      ...workspace,
      products: workspace.products.map((product, index) => index === 0 ? { ...product, note: 'Evidence corrected after the move', revision: product.revision + 1 } : product),
      drafts: workspace.drafts.map(draft => ({ ...draft, text: 'Reviewed wording after the move', status: 'approved', approvedAt: '2026-09-20T12:00:00Z' })),
      links: workspace.links.slice(1),
    })));
    const revised = result.current.workspace;
    act(() => result.current.editing.undo());
    expect(result.current.workspace.cards.slice(0, 2).map(({ x, y }) => ({ x, y }))).toEqual(group.map(({ x, y }) => ({ x, y })));
    expect(result.current.workspace.drafts).toBe(revised.drafts);
    expect(result.current.workspace.products).toBe(revised.products);
    expect(result.current.workspace.links).toBe(revised.links);
    expect(result.current.editing.canUndo).toBe(false);
    act(() => result.current.editing.redo());
    expect(result.current.workspace.cards[0].x).toBe(group[0].x + 160);
    expect(result.current.workspace.cards[1].y).toBe(group[1].y + 80);
    expect(result.current.workspace.drafts).toBe(revised.drafts);
  });

  it('locks positions for drag and Arrange, and restores the lock through layout history', () => {
    const workspace = createWorkspace();
    workspace.cards[0] = { ...workspace.cards[0], x: 40, y: 123 };
    workspace.reviewNotes = [{ id: 'review-note-1', x: 400, y: 80, text: 'Review this later', createdAt: '2026-09-20T12:00:00Z', updatedAt: '2026-09-20T12:00:00Z' }];
    const { result } = harness(workspace);
    const id = workspace.cards[0].id;
    act(() => result.current.editing.lock([id], true));
    act(() => result.current.editing.move([{ id, x: 999, y: 999 }]));
    expect(result.current.workspace.cards[0]).toMatchObject({ x: 40, y: 123, locked: true });
    act(() => result.current.editing.arrange());
    expect(result.current.workspace.cards[0]).toMatchObject({ x: 40, y: 123, locked: true });
    expect(result.current.workspace.reviewNotes).toEqual(workspace.reviewNotes);
    for (const card of result.current.workspace.cards.filter(item => !item.locked && Math.abs(item.x - 400) < 310)) {
      expect(card.y).toBeGreaterThanOrEqual(560);
    }
    act(() => result.current.editing.undo());
    act(() => result.current.editing.undo());
    expect(result.current.workspace.cards[0].locked).toBeFalsy();
  });

  it('clears redo for a new move and clears all layout history when a workspace is restored', () => {
    const { result } = harness();
    const card = result.current.workspace.cards[0];
    act(() => result.current.editing.move([{ id: card.id, x: card.x + 20, y: card.y }]));
    act(() => result.current.editing.undo());
    expect(result.current.editing.canRedo).toBe(true);
    act(() => result.current.editing.move([{ id: card.id, x: card.x + 30, y: card.y }]));
    expect(result.current.editing.canRedo).toBe(false);
    act(() => { result.current.editing.resetHistory(); result.current.setWorkspace(createWorkspace()); });
    expect(result.current.editing.canUndo).toBe(false);
    act(() => result.current.editing.undo());
    expect(result.current.workspace.cards[0].x).toBe(card.x);
  });

  it('keeps note text edited after a move when undoing that move, and never restores a deleted note', () => {
    const { result } = harness();
    act(() => result.current.editing.addNote({ x: 40, y: 60 }));
    const note = result.current.workspace.reviewNotes![0];
    act(() => result.current.editing.move([{ id: note.id, x: 300, y: 200 }]));
    act(() => result.current.editing.editNote(note.id, 'Check the missing price source'));
    act(() => result.current.editing.undo());
    expect(result.current.workspace.reviewNotes![0]).toMatchObject({ x: 40, y: 60, text: 'Check the missing price source' });
    act(() => result.current.editing.deleteNote(note.id));
    act(() => result.current.editing.redo());
    expect(result.current.workspace.reviewNotes).toEqual([]);
  });
});
