import type { CanvasCard, Workspace } from './types';
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
    const overlaps = (card: CanvasCard) => Math.abs(card.x - x) < 310 && y < card.y + (card.kind === 'draft' ? 470 : 310) && y + 310 > card.y;
    let occupied = cards.filter(overlaps);
    while (occupied.length) {
      y = Math.max(...occupied.map(card => card.y + (card.kind === 'draft' ? 470 : 310)));
      occupied = cards.filter(overlaps);
    }
    let id = `card-${entityId}`;
    for (let suffix = 2; cards.some(card => card.id === id); suffix += 1) id = `card-${entityId}-${suffix}`;
    cards.push({ id, kind: 'evidence', entityId, x, y });
  }
  return { ...workspace, cards };
}
