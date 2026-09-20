import { useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CardKind, Workspace } from './types';
import { applyCanvasLayout, applyLayoutChange, createLayoutChange, readCanvasLayout } from './canvasLayout';
import type { LayoutChange, LayoutPosition } from './canvasLayout';
import { uid } from './storage';

/** History deliberately contains only positions and locks, never answer or source snapshots. */
export function useCanvasEditing(workspace: Workspace, setWorkspace: Dispatch<SetStateAction<Workspace>>, notify: (text: string) => void) {
  const current = useRef(workspace);
  current.current = workspace;
  const history = useRef<{ past: LayoutChange[]; future: LayoutChange[] }>({ past: [], future: [] });
  const [, updateHistory] = useState(0);
  const refreshHistory = () => updateHistory(version => version + 1);

  function commit(positions: LayoutPosition[]) {
    const command = createLayoutChange(current.current, positions);
    if (!command) return;
    current.current = applyCanvasLayout(current.current, command.after);
    setWorkspace(latest => applyCanvasLayout(latest, command.after));
    history.current = { past: [...history.current.past, command].slice(-50), future: [] };
    refreshHistory();
  }

  function move(positions: { id: string; x: number; y: number }[]) {
    const movable = new Set(readCanvasLayout(current.current).filter(item => !item.locked).map(item => item.id));
    commit(positions.filter(item => movable.has(item.id)));
  }

  function lock(ids: string[], locked: boolean) {
    const chosen = new Set(ids);
    commit(readCanvasLayout(current.current).filter(item => chosen.has(item.id)).map(item => ({ ...item, locked })));
  }

  function travel(direction: 'undo' | 'redo') {
    const { past, future } = history.current;
    const stack = direction === 'undo' ? past : future;
    const command = stack.at(-1);
    if (!command) return;
    current.current = applyLayoutChange(current.current, command, direction);
    setWorkspace(latest => applyLayoutChange(latest, command, direction));
    history.current = direction === 'undo'
      ? { past: past.slice(0, -1), future: [...future, command] }
      : { past: [...past, command], future: future.slice(0, -1) };
    refreshHistory();
  }

  function arrange() {
    const cols: Record<CardKind, number> = { question: 35, product: 405, note: 405, draft: 785, issue: 785, evidence: 1165 };
    const occupied = current.current.cards.filter(card => card.locked);
    const placed: { x: number; y: number; height: number }[] = [
      ...occupied.map(card => ({ x: card.x, y: card.y, height: card.kind === 'draft' ? 470 : 310 })),
      // Reserve the maximum textarea height plus note chrome; resizing is local
      // presentation state, so Arrange must also be safe after a page reload.
      ...(current.current.reviewNotes || []).map(note => ({ x: note.x, y: note.y, height: 480 })),
    ];
    const positions = current.current.cards.filter(card => !card.locked).map(card => {
      const x = cols[card.kind];
      const height = card.kind === 'draft' ? 470 : 310;
      let y = 35;
      let collision = placed.find(item => Math.abs(item.x - x) < 310 && y < item.y + item.height && y + height > item.y);
      while (collision) {
        y = collision.y + collision.height;
        collision = placed.find(item => Math.abs(item.x - x) < 310 && y < item.y + item.height && y + height > item.y);
      }
      placed.push({ x, y, height });
      return { id: card.id, x, y };
    });
    commit(positions);
    notify('Cards arranged. Locked positions and review notes stayed in place.');
  }

  function addNote(position: { x: number; y: number }) {
    if ((current.current.reviewNotes?.length || 0) >= 500) { notify('The board has reached its limit of 500 review notes.'); return; }
    if (![position.x, position.y].every(value => Number.isFinite(value) && Math.abs(value) <= 10_000_000)) return;
    const now = new Date().toISOString();
    const note = { id: uid('review-note'), text: '', ...position, createdAt: now, updatedAt: now };
    setWorkspace(latest => ({ ...latest, reviewNotes: [...(latest.reviewNotes || []), note] }));
  }

  function editNote(id: string, text: string) {
    const now = new Date().toISOString();
    setWorkspace(latest => ({ ...latest, reviewNotes: (latest.reviewNotes || []).map(note => note.id === id ? { ...note, text: text.slice(0, 4000), updatedAt: now } : note) }));
  }

  function deleteNote(id: string) {
    setWorkspace(latest => ({ ...latest, reviewNotes: (latest.reviewNotes || []).filter(note => note.id !== id) }));
  }

  function resetHistory() { history.current = { past: [], future: [] }; refreshHistory(); }

  return {
    move, lock, arrange, addNote, editNote, deleteNote, resetHistory,
    undo: () => travel('undo'), redo: () => travel('redo'),
    canUndo: history.current.past.length > 0, canRedo: history.current.future.length > 0,
  };
}
