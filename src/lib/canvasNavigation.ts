import type { CanvasCard, CardKind, Workspace } from './types';
import { mayaNotes } from './seed';
export const canvasCardKindLabel = (kind: CardKind): string => ({question:'Question',product:'Product',note:'Maya’s note',draft:'Answer',issue:'Evidence issue'})[kind];
export function canvasCardLabel(card: CanvasCard, workspace: Workspace): string {
 switch(card.kind){
  case 'question':return workspace.questions.find(q=>q.id===card.entityId)?.handle||'Audience question';
  case 'product':return workspace.products.find(p=>p.id===card.entityId)?.name||'Product evidence';
  case 'note':return mayaNotes.find(n=>n.id===card.entityId)?.title||'Maya’s note';
  case 'draft':return workspace.drafts.find(d=>d.id===card.entityId)?.title||'Answer draft';
  case 'issue':return workspace.issues.find(i=>i.id===card.entityId)?.title||'Evidence issue';
 }
}
/** Search only cards already placed on this board, without changing its contents. */
export function searchCanvasCards(workspace: Workspace, query: string): CanvasCard[] {
 const terms=query.toLocaleLowerCase('en-GB').trim().split(/\s+/).filter(Boolean);
 return workspace.cards.filter(card=>{
  const detail=card.kind==='question'?workspace.questions.find(q=>q.id===card.entityId)?.text
   :card.kind==='product'?workspace.products.find(p=>p.id===card.entityId)?.note
   :card.kind==='note'?mayaNotes.find(n=>n.id===card.entityId)?.text
   :card.kind==='issue'?workspace.issues.find(i=>i.id===card.entityId)?.description
   :(()=>{const d=workspace.drafts.find(d=>d.id===card.entityId);return [d?.text,d?.decision?.verdict,d?.decision?.suits,d?.decision?.skipIf,d?.decision?.unknowns].filter(Boolean).join(' ');})();
  const text=`${canvasCardLabel(card,workspace)} ${canvasCardKindLabel(card.kind)} ${detail||''}`.toLocaleLowerCase('en-GB');
  return terms.every(term=>text.includes(term));
 });
}
/** Include each directly related answer and its immediate evidence, never recurse through shared notebook cards. */
export function relatedCanvasCardIds(workspace: Workspace, selectedId: string|null): Set<string> {
 const selected=workspace.cards.find(c=>c.id===selectedId);if(!selected)return new Set();
 const result=new Set([selected.id]);
 const neighbours=workspace.links.flatMap(link=>link.source===selected.id?[link.target]:link.target===selected.id?[link.source]:[]);
 for(const id of neighbours)if(workspace.cards.some(c=>c.id===id))result.add(id);
 const answers=new Set(workspace.cards.filter(c=>c.kind==='draft'&&result.has(c.id)).map(c=>c.id));
 for(const link of workspace.links){if(answers.has(link.source))result.add(link.target);if(answers.has(link.target))result.add(link.source);}
 const existing=new Set(workspace.cards.map(c=>c.id));return new Set([...result].filter(id=>existing.has(id)));
}
