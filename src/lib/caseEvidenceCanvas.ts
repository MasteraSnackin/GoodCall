import type { Workspace } from './types';
import { findCaseEvidence } from './caseEvidence';

/** Add known source records without moving cards, rewriting answers or duplicating evidence. */
export function addCaseEvidenceCards(workspace: Workspace, evidenceIds: string[]): Workspace {
  const missing = [...new Set(evidenceIds)].filter(id => findCaseEvidence(id) && !workspace.cards.some(card => card.kind === 'evidence' && card.entityId === id));
  if (!missing.length) return workspace;
  const existingEvidence = workspace.cards.filter(card => card.kind === 'evidence');
  const otherCards = workspace.cards.filter(card => card.kind !== 'evidence');
  const baseX = existingEvidence.length ? Math.min(...existingEvidence.map(card => card.x)) : Math.max(800, ...otherCards.map(card => card.x)) + 360;
  const cards = [...workspace.cards];
  for (const [index, entityId] of missing.entries()) {
    const x = baseX + (index % 3) * 330;
    let y = 35;
    const obstacles = [...cards.map(card => ({ x: card.x, y: card.y, height: card.kind === 'draft' ? 470 : 310 })), ...(workspace.reviewNotes || []).map(note => ({ x: note.x, y: note.y, height: 480 }))];
    const overlaps = (item: { x: number; y: number; height: number }) => Math.abs(item.x - x) < 310 && y < item.y + item.height && y + 310 > item.y;
    let occupied = obstacles.filter(overlaps);
    while (occupied.length) {
      y = Math.max(...occupied.map(item => item.y + item.height));
      occupied = obstacles.filter(overlaps);
    }
    let id = `card-${entityId}`;
    for (let suffix = 2; cards.some(card => card.id === id) || workspace.reviewNotes?.some(note => note.id === id); suffix += 1) id = `card-${entityId}-${suffix}`;
    cards.push({ id, kind: 'evidence', entityId, x, y });
  }
  return { ...workspace, cards };
}
