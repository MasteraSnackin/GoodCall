import type { Workspace } from './types';

export interface LayoutPosition { id: string; x: number; y: number; locked?: boolean }
export interface LayoutChange { before: LayoutPosition[]; after: LayoutPosition[] }
export interface LayoutBox extends LayoutPosition { width: number; height: number }
export type CanvasAlignment = 'left' | 'top' | 'horizontal' | 'vertical';

const MAX_COORDINATE = 10_000_000;
const validCoordinate = (value: number): boolean => Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE;
const validPosition = (position: LayoutPosition): boolean => typeof position.id === 'string' && validCoordinate(position.x) && validCoordinate(position.y);
const samePosition = (first: LayoutPosition, second: LayoutPosition): boolean => first.x === second.x && first.y === second.y && Boolean(first.locked) === Boolean(second.locked);
const positionOf = (item: LayoutPosition): LayoutPosition => ({ id: item.id, x: item.x, y: item.y, locked: Boolean(item.locked) });

/** Capture layout alone, so history never stores answers, evidence or review-note text. */
export function readCanvasLayout(workspace: Workspace): LayoutPosition[] {
  return [...workspace.cards, ...(workspace.reviewNotes ?? [])].map(positionOf);
}

/** Apply one immutable layout update to existing items. Omitted locks retain their current value. */
export function applyCanvasLayout(workspace: Workspace, positions: LayoutPosition[]): Workspace {
  const updates = new Map(positions.filter(validPosition).map(position => [position.id, position]));
  if (updates.size === 0) return workspace;

  function update<T extends LayoutPosition>(item: T): T {
    const position = updates.get(item.id);
    if (!position) return item;
    const locked = typeof position.locked === 'boolean' ? position.locked : item.locked;
    if (samePosition(item, { ...position, locked })) return item;
    return { ...item, x: position.x, y: position.y, ...(typeof position.locked === 'boolean' ? { locked: position.locked } : {}) };
  }

  const cards = workspace.cards.map(update);
  const reviewNotes = workspace.reviewNotes?.map(update);
  const cardsChanged = cards.some((card, index) => card !== workspace.cards[index]);
  const notesChanged = reviewNotes?.some((note, index) => note !== workspace.reviewNotes?.[index]) ?? false;
  if (!cardsChanged && !notesChanged) return workspace;
  return { ...workspace, ...(cardsChanged ? { cards } : {}), ...(notesChanged ? { reviewNotes } : {}) };
}

/** A multi-item move is one change containing only the items whose effective layout changed. */
export function createLayoutChange(workspace: Workspace, positions: LayoutPosition[]): LayoutChange | null {
  const next = applyCanvasLayout(workspace, positions);
  if (next === workspace) return null;
  const before = readCanvasLayout(workspace);
  const after = new Map(readCanvasLayout(next).map(position => [position.id, position]));
  const changed = before.filter(position => {
    const updated = after.get(position.id);
    return updated !== undefined && !samePosition(position, updated);
  });
  return changed.length ? { before: changed, after: changed.map(position => after.get(position.id)!) } : null;
}

/** Replay only unchanged surviving items; deletion and later external moves take precedence. */
export function applyLayoutChange(workspace: Workspace, change: LayoutChange, direction: 'undo' | 'redo'): Workspace {
  const expected = new Map((direction === 'undo' ? change.after : change.before).map(position => [position.id, position]));
  const desired = direction === 'undo' ? change.before : change.after;
  const current = new Map(readCanvasLayout(workspace).map(position => [position.id, position]));
  const applicable = desired.filter(position => {
    const present = current.get(position.id);
    const previous = expected.get(position.id);
    return present !== undefined && previous !== undefined && samePosition(present, previous);
  });
  return applyCanvasLayout(workspace, applicable);
}

/** Align unlocked items, or distribute their measured bounds with equal non-negative gaps. */
export function alignCanvasItems(boxes: LayoutBox[], mode: CanvasAlignment): LayoutPosition[] {
  const available = boxes.filter(box => !box.locked && validPosition(box)
    && Number.isFinite(box.width) && box.width >= 0 && Number.isFinite(box.height) && box.height >= 0);
  const distributing = mode === 'horizontal' || mode === 'vertical';
  if (available.length < (distributing ? 3 : 2)) return [];

  if (!distributing) {
    const coordinate = mode === 'left' ? 'x' : 'y';
    const target = Math.min(...available.map(box => box[coordinate]));
    return available.map(box => ({ ...positionOf(box), [coordinate]: target }));
  }

  const coordinate = mode === 'horizontal' ? 'x' : 'y';
  const dimension = mode === 'horizontal' ? 'width' : 'height';
  const ordered = [...available].sort((first, second) => first[coordinate] - second[coordinate]);
  const start = ordered[0][coordinate];
  const end = Math.max(...ordered.map(box => box[coordinate] + box[dimension]));
  const totalSize = ordered.reduce((sum, box) => sum + box[dimension], 0);
  const gap = Math.max(0, (end - start - totalSize) / (ordered.length - 1));
  let cursor = start;
  const result = ordered.map(box => {
    const position = { ...positionOf(box), [coordinate]: cursor };
    cursor += box[dimension] + gap;
    return position;
  });
  // Refuse an impossible distribution rather than partially move the group outside the canvas bounds.
  return result.every(validPosition) ? result : [];
}
