import type { AiDraftMetadata } from './aiTypes';
import type { DecisionProfile, ReuseReference } from './decisionTypes';
import type { QuestionFollowUp, DecisionSection } from './canvasWorkflow';
export type Intent = 'Product value' | 'Personal recommendation' | 'Routine & budget' | 'Missing context' | 'Relationship & trust';
export type SourceRef = { page: number; label: string; excerpt: string };
export interface Question { id: string; handle: string; text: string; intent: Intent; source: SourceRef; productIds: string[]; originalSource?: SourceRef; addedAt?: string }
export interface Product { id: string; name: string; price: number; type: string; skin: string; finish: string; score: number; note: string; source: SourceRef; revision: number }
export interface Issue { id: string; title: string; kind: 'Missing material' | 'Conflicting information' | 'Needs clarification'; area: 'Audience advice' | 'Case-file report'; severity: 'Blocks affected answer' | 'Needs review' | 'Admin only'; description: string; sourceRefs: SourceRef[]; nextAction: string; questionIds: string[]; productIds: string[]; status: 'Open' | 'Checking' | 'Resolved'; resolution?: string; resolutionSource?: string; resolvedAt?: string }
export interface Draft { ai?: AiDraftMetadata; history?: DraftRevision[]; decision?: DecisionProfile; reusedFrom?: ReuseReference; id: string; questionId: string; title: string; text: string; productIds: string[]; sourceRefs: SourceRef[]; productRevisions: Record<string,number>; status: 'draft' | 'approved' | 'published'; mode: 'Evidence template' | 'Written by Maya' | 'AI suggestion'; createdAt: string; updatedAt: string; approvedAt?: string; publishedAt?: string; cardId?: string; persona?: { id: string; version: number } }
export interface DraftRevision { id: string; savedAt: string; reason: string; snapshot: Omit<Draft,'history'> }
export type CardKind = 'question' | 'product' | 'note' | 'draft' | 'issue' | 'evidence';
export interface CanvasCard { id: string; kind: CardKind; entityId: string; x: number; y: number; locked?: boolean }
export interface ReviewNote { id: string; text: string; x: number; y: number; locked?: boolean; createdAt: string; updatedAt: string }
export interface CanvasLink { evidenceOrigin?: 'generated' | 'manual'; id: string; source: string; target: string }
export interface Activity { id: string; text: string; at: string }
export interface Workspace { version: 1; questions: Question[]; products: Product[]; issues: Issue[]; drafts: Draft[]; cards: CanvasCard[]; links: CanvasLink[]; activity: Activity[]; reviewNotes?: ReviewNote[]; questionFollowUps?: QuestionFollowUp[]; decisionSections?: DecisionSection[] }
export interface PublishedAdvice { decision?: DecisionProfile; version: 1; id: string; title: string; text: string; products: {name:string;price:number;note:string}[]; sourceRefs: SourceRef[]; publishedAt: string; demo: true }
export const INTENTS: Intent[] = ['Product value','Personal recommendation','Routine & budget','Missing context','Relationship & trust'];
