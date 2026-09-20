import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  Handle, Position, MarkerType, useNodesState, useEdgesState,
  useReactFlow, useViewport, MiniMap, SelectionMode,
} from '@xyflow/react';
import type { Node, NodeProps, NodeChange, Edge, Connection } from '@xyflow/react';
import type { ReactNode } from 'react';
import {
  ArrowUpRight, Check, FileText, Link2, Maximize2, MessageCircle,
  Minus, Move, Plus, ShoppingBag, Sparkles, TriangleAlert,
  Focus, Map as MapIcon, Search, X, MousePointer2, Hand, LockKeyhole, UnlockKeyhole,
  StickyNote, Trash2, Undo2, Redo2, AlignStartVertical, AlignStartHorizontal,
  Columns3, Rows3, ChevronDown,
} from 'lucide-react';
import type { CanvasCard, CardKind, Draft, Workspace } from '../lib/types';
import { EvidenceReadinessBadge, EvidenceReadinessPanel } from './EvidenceReadiness';
import { ProductComparison } from './ProductComparison';
import { CanvasWorkflowPanel } from './CanvasWorkflow';
import { deriveEvidenceReadiness } from '../lib/evidenceReadiness';
import './CanvasDecisionTools.css';
import { mayaNotes } from '../lib/seed';
import { alignCanvasItems } from '../lib/canvasLayout';
import { findCaseEvidence } from '../lib/caseEvidence';
import { canvasCardLabel, canvasCardKindLabel, searchCanvasCards, relatedCanvasCardIds } from '../lib/canvasNavigation';
import type {DecisionProfile} from '../lib/decisionTypes';
import {DecisionSummary} from './DecisionProfile';
import '@xyflow/react/dist/style.css';
import './Canvas.css';

interface AnswerCanvasProps {
  workspace: Workspace;
  selectedId: string | null;
  onSelect: (cardId: string | null) => void;
  onMove: (cardId: string, x: number, y: number) => void;
  onConnect: (source: string, target: string) => void;
  onRemoveLink: (linkId: string) => void;
  onDraft: (questionId: string) => void;
  focusCardId?: string | null;
  focusKey?: number;
  arrangeKey?: number;
  onMoveMany?: (positions: { id: string; x: number; y: number }[]) => void;
  onLock?: (ids: string[], locked: boolean) => void;
  onAddReviewNote?: (position: { x: number; y: number }) => void;
  onEditReviewNote?: (id: string, text: string) => void;
  onDeleteReviewNote?: (id: string) => void;
  onUndoLayout?: () => void;
  onRedoLayout?: () => void;
  canUndoLayout?: boolean;
  canRedoLayout?: boolean;
  onWorkflowChange?: (update: (workspace: Workspace) => Workspace) => void;
  onClarifyQuestion?: (questionId: string) => void;
}

type CardData = {
  kind: CardKind;
  entityId: string;
  title: string;
  text: string;
  eyebrow: string;
  footer: string;
  page: string;
  price?: number;
  badge?: string;
  status?: string;
  draftAction?: (id: string) => void;
  hasDraft?: boolean;
  decision?: DecisionProfile;
  locked?: boolean;
  readiness?: { draft: Draft; workspace: Workspace; onOpen: () => void };
  followUp?: { prompt: string; status: string; onOpen: () => void };
};
type EvidenceNode = Node<CardData, 'evidence'>;
type ReviewData = { text: string; locked?: boolean; focusText?: boolean; onTextFocused?: (id: string) => void; onEdit?: (id: string, text: string) => void; onDelete?: (id: string) => void };
type ReviewNode = Node<ReviewData, 'review'>;
type CanvasNode = EvidenceNode | ReviewNode;
type SectionNode = Node<{ title: string; summary: string; locked: boolean }, 'section'>;


const kindIcons = {
  question: MessageCircle,
  product: ShoppingBag,
  note: FileText,
  evidence: FileText,
  draft: Sparkles,
  issue: TriangleAlert,
};

const pageLabel = (page: number) => page > 0 ? `p. ${page}` : 'Workspace note';
const motionDuration = (duration: number) => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : duration;

const EvidenceCard = memo(function EvidenceCard({ data, selected }: NodeProps<EvidenceNode>) {
  const Icon = kindIcons[data.kind];
  return (
    <article className={`evidence-card evidence-card--${data.kind}${selected ? ' is-selected' : ''}`} aria-label={`${data.eyebrow}: ${data.title}`}>
      <Handle type="target" position={Position.Left} aria-label={`Connect to ${data.title}`} />
      <div className="evidence-card__eyebrow">
        <span className="evidence-card__type"><Icon size={13} strokeWidth={1.8} />{data.eyebrow}</span>
        {data.locked && <span className="canvas-lock-badge" title="Position locked" aria-label="Position locked"><LockKeyhole size={12} /></span>}
        {data.badge && <span className={`evidence-card__badge ${data.status || ''}`}>{data.badge}</span>}
      </div>
      <div className="evidence-card__title-row">
        <h3>{data.title}</h3>
        {data.price !== undefined && <span className="evidence-card__price">£{data.price}</span>}
      </div>
      <>{data.decision?<DecisionSummary value={data.decision} compact/>:<p className="evidence-card__body">{data.text}</p>}</>
      <div className="evidence-card__meta">
        <span>{data.footer}</span>
        <span className="evidence-card__page">{data.page}</span>
      </div>
      {data.readiness && <div className="canvas-card-readiness"><EvidenceReadinessBadge {...data.readiness} /></div>}
      {data.followUp && <button type="button" className="canvas-card-followup nodrag nopan" onClick={event => { event.stopPropagation(); data.followUp?.onOpen(); }}><strong>{data.followUp.status}</strong><span>{data.followUp.prompt}</span></button>}
      {data.kind === 'question' && (
        <button className="evidence-card__draft nodrag nopan" onClick={event => {
          event.stopPropagation();
          data.draftAction?.(data.entityId);
        }}>
          <span><Sparkles size={13} />{data.hasDraft ? 'Review answer' : 'Draft answer'}</span><ArrowUpRight size={14} />
        </button>
      )}
      {data.kind === 'draft' && <div className="evidence-card__draft-footer">
        {data.status === 'draft' ? <><span className="evidence-card__status-dot" />Review before publishing</> : <><Check size={13} />{data.status === 'published' ? 'Published advice' : 'Approved locally'}</>}
      </div>}
      <Handle type="source" position={Position.Right} aria-label={`Connect from ${data.title}`} />
    </article>
  );
});

const ReviewNoteCard = memo(function ReviewNoteCard({ id, data, selected, width, height }: NodeProps<ReviewNode>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    // React Flow mounts unmeasured nodes with visibility:hidden. Wait for its
    // measured dimensions before focusing, and only acknowledge a real focus.
    if (!data.focusText || !width || !height || !textareaRef.current) return;
    textareaRef.current.focus({ preventScroll: true });
    if (document.activeElement === textareaRef.current) data.onTextFocused?.(id);
  }, [data.focusText, data.onTextFocused, id, width, height]);
  return <article className={`review-note${selected ? ' is-selected' : ''}`} aria-label="Private review note">
    <div className="review-note__heading"><span><StickyNote size={14} />Review note</span>{data.locked && <span className="canvas-lock-badge" title="Position locked" aria-label="Position locked"><LockKeyhole size={12} /></span>}
      <button type="button" className="nodrag nopan" aria-label="Remove review note" title="Remove review note" disabled={!data.onDelete} onClick={event => { event.stopPropagation(); data.onDelete?.(id); }}><Trash2 size={14} /></button>
    </div>
    <p className="review-note__scope">Private · Not evidence</p>
    <textarea ref={textareaRef} className="nodrag nopan nowheel" aria-label="Review note text" placeholder="Leave a thought for your review…" value={data.text} maxLength={4000} readOnly={!data.onEdit} onChange={event => data.onEdit?.(id, event.target.value.slice(0, 4000))} />
    <div className="review-note__footer"><span>Saved in this workspace</span><span>{data.text.length.toLocaleString('en-GB')}/4,000</span></div>
  </article>;
});

const DecisionSectionCard = memo(function DecisionSectionCard({ data }: NodeProps<SectionNode>) {
  return <div className="canvas-decision-section"><div className="canvas-decision-section__label"><strong>{data.title}</strong><span>{data.summary}</span></div></div>;
});

const nodeTypes = { evidence: EvidenceCard, review: ReviewNoteCard, section: DecisionSectionCard };

function CanvasToolDialog({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const origin = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (origin instanceof HTMLElement && origin.isConnected) origin.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className={`canvas-tool-dialog${label === 'Follow-ups and decision sections' ? ' canvas-tool-dialog--workflow' : ''}`} aria-label={label} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()}>{children}</dialog>;
}

function presentCard(card: CanvasCard, workspace: Workspace, onDraft: AnswerCanvasProps['onDraft']): CardData {
  if (card.kind === 'question') {
    const question = workspace.questions.find(item => item.id === card.entityId);
    return {
      kind: card.kind, entityId: card.entityId,
      eyebrow: 'Audience question', title: question?.handle || 'Follower question',
      text: question?.text || 'Question details unavailable.',
      footer: question?.intent || 'Needs review', page: question ? pageLabel(question.source.page) : '',
      draftAction: onDraft,
      hasDraft: workspace.drafts.some(draft => draft.questionId === card.entityId),
    };
  }
  if (card.kind === 'product') {
    const product = workspace.products.find(item => item.id === card.entityId);
    return {
      kind: card.kind, entityId: card.entityId,
      eyebrow: 'Product evidence', title: product?.name || 'Unknown product',
      text: product?.note || 'Product details are missing from the source catalogue.',
      footer: product ? `${product.type} · ${product.skin}` : 'Missing catalogue record',
      page: product ? pageLabel(product.source.page) : '', price: product?.price,
      badge: product ? `${product.score}/10` : undefined,
    };
  }
  if (card.kind === 'evidence') {
    const evidence = findCaseEvidence(card.entityId);
    return { kind: card.kind, entityId: card.entityId, eyebrow: 'Case-file evidence', title: evidence?.title || 'Case-file evidence', text: evidence?.summary || 'Source details unavailable.', footer: evidence?.category || 'Source record', badge: evidence?.table ? `${evidence.table.rows.length} records` : undefined, page: evidence ? [...new Set(evidence.sourceRefs.map(ref => ref.page))].map(pageLabel).join(', ') : '' };
  }
  if (card.kind === 'note') {
    const note = mayaNotes.find(item => item.id === card.entityId);
    return {
      kind: card.kind, entityId: card.entityId,
      eyebrow: 'Maya’s notebook', title: note?.title || 'Notebook evidence',
      text: note?.text || 'Notebook entry unavailable.', footer: 'Original source',
      page: note ? pageLabel(note.source.page) : '',
    };
  }
  if (card.kind === 'issue') {
    const issue = workspace.issues.find(item => item.id === card.entityId);
    return {
      kind: card.kind, entityId: card.entityId,
      eyebrow: 'Evidence issue', title: issue?.title || 'Evidence needs review',
      text: issue?.description || 'Review the source material before using this evidence.',
      footer: issue?.kind || 'Needs clarification',
      page: issue ? [...new Set(issue.sourceRefs.map(source => source.page))].map(pageLabel).join(', ') : '',
      badge: issue?.status || 'Open', status: issue?.status === 'Resolved' ? 'resolved' : 'open',
    };
  }
  const draft = workspace.drafts.find(item => item.id === card.entityId);
  return {
    kind: card.kind, entityId: card.entityId,
    eyebrow: draft?.decision?'Decision card':'Answer draft', decision:draft?.decision, title: draft?.title || 'An answer in progress',
    text: draft?.text || 'Connect the evidence and start drafting.',
    footer: draft?.mode || 'Evidence template',
    page: draft ? `${draft.sourceRefs.length} source${draft.sourceRefs.length === 1 ? '' : 's'}` : '',
    badge: draft?.status === 'published' ? 'Published' : draft?.status === 'approved' ? 'Approved' : 'Draft',
    status: draft?.status || 'draft',
  };
}

function CanvasControls({ selectedId, showMap, onToggleMap, onFitAll }: { selectedId: string | null; showMap: boolean; onToggleMap: () => void; onFitAll: () => void }) {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();
  return (
    <div className="canvas-bottom-bar">
      <div className="canvas-controls" aria-label="Canvas view controls">
        <button title="Zoom out" aria-label="Zoom out" onClick={() => zoomOut({ duration: motionDuration(180) })}><Minus size={16} /></button>
        <span className="canvas-controls__zoom" aria-live="off">{Math.round(zoom * 100)}%</span>
        <button title="Zoom in" aria-label="Zoom in" onClick={() => zoomIn({ duration: motionDuration(180) })}><Plus size={16} /></button>
        <span className="canvas-controls__divider" />
        <button className="canvas-controls__reset" title="Reset zoom to 100%" aria-label="Reset zoom to 100%" onClick={() => zoomTo(1, { duration: motionDuration(180) })}>100%</button>
        <button className="canvas-controls__fit" title="Fit all cards" aria-label="Fit all cards" onClick={onFitAll}><Maximize2 size={14} /><span>Fit</span></button>
        <button title="Focus selected card" aria-label="Focus selected card" disabled={!selectedId} onClick={() => selectedId && fitView({ nodes: [{ id: selectedId }], duration: motionDuration(350), padding: .65, maxZoom: 1.05 })}><Focus size={16} /></button>
        <span className="canvas-controls__divider" />
        <button title={showMap ? 'Hide minimap' : 'Show minimap'} aria-label="Show minimap" aria-pressed={showMap} onClick={onToggleMap}><MapIcon size={16} /></button>
      </div>
      <span className="canvas-bottom-hint"><Link2 size={12} />Select a connection + Delete to remove</span>
    </div>
  );
}

function CanvasInner({ workspace, selectedId, onSelect, onMove, onMoveMany, onLock, onAddReviewNote, onEditReviewNote, onDeleteReviewNote, onUndoLayout, onRedoLayout, canUndoLayout = false, canRedoLayout = false, onConnect, onRemoveLink, onDraft, focusCardId, focusKey, arrangeKey, onWorkflowChange, onClarifyQuestion }: AnswerCanvasProps) {
  const [toolPanel, setToolPanel] = useState<'comparison' | 'readiness' | 'workflow' | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [readinessId, setReadinessId] = useState<string | null>(null);
  const openReadiness = useCallback((draftId: string) => { setReadinessId(draftId); setToolPanel('readiness'); }, []);
  const openWorkflow = useCallback(() => setToolPanel('workflow'), []);
  const [query, setQuery] = useState('');
  const [focusConnections, setFocusConnections] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');
  const [showAlign, setShowAlign] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(selectedId ? [selectedId] : []));
  const selectionRef = useRef(selectedIds);
  const boxSelecting = useRef(false);
  const additiveSelecting = useRef(false);
  const lastCompletedDrag = useRef<unknown>(null);
  const keyboardMoveIds = useRef<Set<string> | null>(null);
  const [noteTextFocusId, setNoteTextFocusId] = useState<string | null>(null);
  const finishNoteTextFocus = useCallback((id: string) => setNoteTextFocusId(current => current === id ? null : current), []);
  const pendingReviewNoteIds = useRef<Set<string> | null>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const [searchFocus, setSearchFocus] = useState<{ id: string; key: number } | null>(null);
  const requestedSelection = useRef(selectedId);
  const selectionExists = selectedId !== null && workspace.cards.some(card => card.id === selectedId);
  const isFocused = focusConnections && selectionExists;
  const contextIds = useMemo(() => relatedCanvasCardIds(workspace, selectedId), [workspace, selectedId]);
  const searchResults = useMemo(() => searchCanvasCards(workspace, query), [workspace, query]);
  const hasQuery = query.trim().length > 0;
  const shownCount = isFocused ? workspace.cards.filter(card => contextIds.has(card.id)).length : workspace.cards.length;

  const updateSelection = useCallback((next: Set<string>) => {
    if (next.size === selectionRef.current.size && [...next].every(id => selectionRef.current.has(id))) return;
    selectionRef.current = next;
    setSelectedIds(next);
  }, []);

  useEffect(() => {
    if (!selectionExists) setFocusConnections(false);
  }, [selectionExists]);

  // An inspector request originating outside the canvas selects one card. Changes
  // originating here already updated this ref and must not collapse a group.
  useEffect(() => {
    if (requestedSelection.current === selectedId) return;
    requestedSelection.current = selectedId;
    updateSelection(new Set(selectedId ? [selectedId] : []));
  }, [selectedId, updateSelection]);

  const selectCard = useCallback((id: string | null, openDetails = false) => {
    if (requestedSelection.current === id && !openDetails) return;
    requestedSelection.current = id;
    onSelect(id);
  }, [onSelect]);

  const clearSelection = useCallback(() => {
    updateSelection(new Set());
    selectCard(null);
    setShowAlign(false);
  }, [selectCard, updateSelection]);

  const nodeModels = useMemo<CanvasNode[]>(() => [
    ...workspace.cards.map(card => ({
      id: card.id, type: 'evidence' as const, position: { x: card.x, y: card.y }, zIndex: 1,
      data: { ...presentCard(card, workspace, onDraft), locked: card.locked,
        ...(card.kind === 'draft' && workspace.drafts.find(draft => draft.id === card.entityId) ? { readiness: { draft: workspace.drafts.find(draft => draft.id === card.entityId)!, workspace, onOpen: () => openReadiness(card.entityId) } } : {}),
        ...(card.kind === 'question' && workspace.questionFollowUps?.find(item => item.questionId === card.entityId) ? { followUp: { ...workspace.questionFollowUps.find(item => item.questionId === card.entityId)!, onOpen: openWorkflow } } : {}),
      },
      hidden: isFocused && !contextIds.has(card.id),
      deletable: false, draggable: !card.locked, ariaLabel: `${canvasCardKindLabel(card.kind)}: ${canvasCardLabel(card, workspace)}${card.locked ? ', position locked' : ''}`,
    })),
    ...(workspace.reviewNotes || []).map(note => ({
      id: note.id, type: 'review' as const, position: { x: note.x, y: note.y }, zIndex: 1,
      data: { text: note.text, locked: note.locked, onEdit: onEditReviewNote, onDelete: onDeleteReviewNote, focusText: note.id === noteTextFocusId, onTextFocused: finishNoteTextFocus },
      hidden: isFocused, deletable: false, connectable: false, draggable: !note.locked,
      ariaLabel: `Private review note${note.locked ? ', position locked' : ''}`,
    })),
  ], [workspace, onDraft, isFocused, contextIds, onEditReviewNote, onDeleteReviewNote, noteTextFocusId, finishNoteTextFocus, openReadiness, openWorkflow]);
  const edgeModels = useMemo<Edge[]>(() => workspace.links.map(link => ({
    id: link.id, source: link.source, target: link.target, type: 'smoothstep',
    animated: false,
    hidden: isFocused && (!contextIds.has(link.source) || !contextIds.has(link.target)),
    style: { stroke: '#b6b1a6', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#b6b1a6' },
    interactionWidth: 20,
  })), [workspace.links, isFocused, contextIds]);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(nodeModels);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(edgeModels);
  const { fitView, getNode, screenToFlowPosition } = useReactFlow<CanvasNode>();

  const sectionNodes = useMemo<SectionNode[]>(() => (workspace.decisionSections || []).flatMap(section => {
    const members = nodes.filter(node => node.type === 'evidence' && section.cardIds.includes(node.id) && !node.hidden);
    if (!members.length) return [];
    const left = Math.min(...members.map(node => node.position.x)) - 22;
    const top = Math.min(...members.map(node => node.position.y)) - 58;
    const right = Math.max(...members.map(node => node.position.x + (node.measured?.width || 274))) + 22;
    const bottom = Math.max(...members.map(node => node.position.y + (node.measured?.height || 300))) + 22;
    const drafts = workspace.drafts.filter(draft => members.some(node => node.type === 'evidence' && node.data.kind === 'draft' && node.data.entityId === draft.id));
    const blocked = drafts.filter(draft => deriveEvidenceReadiness(draft, workspace).blockers.length).length;
    const waiting = (workspace.questionFollowUps || []).filter(item => item.status === 'Waiting for reply' && members.some(node => node.type === 'evidence' && node.data.kind === 'question' && node.data.entityId === item.questionId)).length;
    let frameId = `decision-frame:${section.id}`;
    while (nodes.some(node => node.id === frameId)) frameId = `frame:${frameId}`;
    return [{ id: frameId, type: 'section' as const, position: { x: left, y: top }, width: right - left, height: bottom - top, data: { title: section.title, summary: `${members.length} ${members.length === 1 ? 'card' : 'cards'}${blocked ? ` · ${blocked} ${blocked === 1 ? 'answer needs' : 'answers need'} checks` : ''}${waiting ? ` · ${waiting} waiting for reply` : ''}`, locked: true }, style: { width: right - left, height: bottom - top, pointerEvents: 'none' as const }, zIndex: 0, selectable: false, draggable: false, connectable: false, deletable: false, focusable: false }];
  }), [workspace, nodes]);

  const persistPositions = useCallback((moved: { id: string; x: number; y: number }[]) => {
    const items = [...workspace.cards, ...(workspace.reviewNotes || [])];
    const changed = moved.filter(position => {
      const current = items.find(item => item.id === position.id);
      return current && !current.locked && (current.x !== position.x || current.y !== position.y);
    }).map(({ id, x, y }) => ({ id, x, y }));
    if (!changed.length) return;
    if (onMoveMany) onMoveMany(changed);
    else changed.forEach(position => onMove(position.id, position.x, position.y));
  }, [workspace.cards, workspace.reviewNotes, onMoveMany, onMove]);

  const handleNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    onNodesChange(changes);
    // React Flow's arrow-key handler emits one non-dragging position batch and
    // no drag-stop event. Commit that batch without treating measurements or a
    // pointer gesture's final position update as additional history entries.
    if (keyboardMoveIds.current) {
      const positions = changes.flatMap(change => change.type === 'position' && keyboardMoveIds.current?.has(change.id) && change.position && !change.dragging
        ? [{ id: change.id, x: change.position.x, y: change.position.y }] : []);
      if (positions.length) {
        keyboardMoveIds.current = null;
        persistPositions(positions);
      }
    }
    const selectionChanges = changes.filter(change => change.type === 'select');
    if (!selectionChanges.length) return;
    const next = new Set(selectionRef.current);
    let nextPrimary = requestedSelection.current;
    for (const change of selectionChanges) {
      if (change.selected) {
        next.add(change.id);
        if (workspace.cards.some(card => card.id === change.id)) nextPrimary = change.id;
      } else next.delete(change.id);
    }
    if (!nextPrimary || !next.has(nextPrimary)) nextPrimary = [...next].find(id => workspace.cards.some(card => card.id === id)) || null;
    updateSelection(next);
    if (next.size <= 1 && !boxSelecting.current && !additiveSelecting.current) selectCard(nextPrimary);
  }, [onNodesChange, workspace.cards, selectCard, updateSelection, persistPositions]);

  useEffect(() => {
    const visibleIds = new Set(nodeModels.filter(node => !node.hidden).map(node => node.id));
    updateSelection(new Set([...selectionRef.current].filter(id => visibleIds.has(id))));
    setNodes(previous => nodeModels.map(node => {
      const existing = previous.find(item => item.id === node.id);
      return { ...existing, ...node, selected: selectionRef.current.has(node.id), position: existing?.dragging ? existing.position : node.position };
    }));
  }, [nodeModels, setNodes, updateSelection]);
  useEffect(() => {
    setNodes(previous => previous.map(node => ({ ...node, selected: selectedIds.has(node.id) })));
  }, [selectedIds, setNodes]);

  useEffect(() => {
    const previousIds = pendingReviewNoteIds.current;
    if (!previousIds) return;
    const note = workspace.reviewNotes?.find(item => !previousIds.has(item.id));
    if (!note) return;
    pendingReviewNoteIds.current = null;
    updateSelection(new Set([note.id]));
    selectCard(null);
    setNoteTextFocusId(note.id);
  }, [workspace.reviewNotes, selectCard, updateSelection]);

  const selectedNodes = nodes.filter(node => selectedIds.has(node.id) && !node.hidden);
  const allLocked = selectedNodes.length > 0 && selectedNodes.every(node => node.data.locked);
  const movableSelectionCount = selectedNodes.filter(node => !node.data.locked).length;
  const selectedEvidenceIds = selectedNodes.filter(node => node.type === 'evidence').map(node => node.id);
  const selectedProductIds = [...new Set(selectedNodes.flatMap(node => node.type === 'evidence' && node.data.kind === 'product' ? [node.data.entityId] : []))];
  const readinessDraft = workspace.drafts.find(draft => draft.id === readinessId);

  const focusSection = (ids: string[]) => {
    setToolPanel(null);
    setFocusConnections(false);
    updateSelection(new Set(ids));
    requestAnimationFrame(() => fitView({ nodes: ids.map(id => ({ id })), padding: .2, duration: motionDuration(350), maxZoom: 1 }));
  };

  // React Flow emits both callbacks for a selection-box drag. Treat that one
  // pointer-up as one history entry while supporting either callback path.
  const persistDrag = (event: unknown, movedNodes: CanvasNode[]) => {
    if (event && lastCompletedDrag.current === event) return;
    lastCompletedDrag.current = event;
    persistPositions(movedNodes.map(node => ({ id: node.id, x: node.position.x, y: node.position.y })));
  };

  const alignSelection = (mode: 'left' | 'top' | 'horizontal' | 'vertical') => {
    const positions = alignCanvasItems(selectedNodes.map(node => {
      const measured = getNode(node.id) || node;
      return { id: node.id, x: measured.position.x, y: measured.position.y, locked: node.data.locked, width: measured.measured?.width || measured.width || 274, height: measured.measured?.height || measured.height || 220 };
    }), mode);
    const positionById = new Map(positions.map(position => [position.id, position]));
    setNodes(previous => previous.map(node => {
      const position = positionById.get(node.id);
      return position && !node.data.locked ? { ...node, position: { x: position.x, y: position.y } } : node;
    }));
    persistPositions(positions);
    setShowAlign(false);
  };

  const addReviewNote = () => {
    const viewport = canvasRef.current?.querySelector('.react-flow')?.getBoundingClientRect() || canvasRef.current?.getBoundingClientRect();
    if (!viewport || !onAddReviewNote) return;
    const centre = screenToFlowPosition({ x: viewport.left + viewport.width / 2, y: viewport.top + viewport.height / 2 });
    pendingReviewNoteIds.current = new Set((workspace.reviewNotes || []).map(note => note.id));
    setFocusConnections(false);
    onAddReviewNote({ x: centre.x - 137, y: centre.y - 110 });
  };
  useEffect(() => {
    setEdges(previous => edgeModels.map(edge => ({ ...edge, selected: !edge.hidden && (previous.find(item => item.id === edge.id)?.selected || false) })));
  }, [edgeModels, setEdges]);

  useEffect(() => {
    if (!focusCardId && !focusKey) return;
    const frame = requestAnimationFrame(() => {
      if (!focusCardId) {
        fitView({ duration: motionDuration(400), padding: .12, maxZoom: .95 });
      } else if (getNode(focusCardId)) {
        fitView({ nodes: [{ id: focusCardId }], duration: motionDuration(400), padding: .65, maxZoom: 1.05 });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [focusCardId, focusKey, fitView, getNode]);

  useEffect(() => {
    if (!arrangeKey) return;
    const frame = requestAnimationFrame(() => fitView({ padding: .16, duration: motionDuration(400), maxZoom: 1 }));
    return () => cancelAnimationFrame(frame);
  }, [arrangeKey, fitView]);

  useEffect(() => {
    if (!searchFocus) return;
    const frame = requestAnimationFrame(() => {
      if (getNode(searchFocus.id)) fitView({ nodes: [{ id: searchFocus.id }], duration: motionDuration(350), padding: .65, maxZoom: 1.05 });
    });
    return () => cancelAnimationFrame(frame);
  }, [searchFocus, fitView, getNode]);

  const toggleConnectionFocus = () => {
    setFocusConnections(value => !value);
    requestAnimationFrame(() => fitView({ padding: .2, duration: motionDuration(350), maxZoom: 1 }));
  };

  const showAllCards = () => {
    setFocusConnections(false);
    requestAnimationFrame(() => fitView({ padding: .16, duration: motionDuration(350), maxZoom: 1 }));
  };

  const selectSearchResult = (id: string) => {
    updateSelection(new Set([id]));
    selectCard(id, true);
    setQuery('');
    setSearchFocus(previous => ({ id, key: (previous?.key || 0) + 1 }));
  };

  const connect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) onConnect(connection.source, connection.target);
  }, [onConnect]);

  return (
    <section ref={canvasRef} className="answer-canvas" aria-label="Maya’s movable evidence canvas" tabIndex={0} onPointerDownCapture={event => { keyboardMoveIds.current = null; additiveSelecting.current = event.shiftKey || event.metaKey || event.ctrlKey; }} onKeyDownCapture={event => {
      additiveSelecting.current = event.shiftKey || event.metaKey || event.ctrlKey;
      keyboardMoveIds.current = null;
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.isContentEditable || target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"]')) return;
      if (!target.closest('.react-flow__node, .react-flow__nodesselection-rect') || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      // React Flow may deliver the change after the browser dispatch finishes.
      // Retain only the intended unlocked IDs until their position batch arrives;
      // the next pointer action or non-arrow key invalidates a stale request.
      keyboardMoveIds.current = new Set([...selectionRef.current].filter(id => !getNode(id)?.data.locked));
    }} onKeyDown={event => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.isContentEditable || target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"]')) return;
      if (event.key === 'Escape') { clearSelection(); return; }
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'z') return;
      const action = event.shiftKey ? (canRedoLayout ? onRedoLayout : undefined) : (canUndoLayout ? onUndoLayout : undefined);
      if (action) { event.preventDefault(); event.stopPropagation(); action(); }
    }}>
      <div className="canvas-navigation">
        <div className="canvas-search">
          <label htmlFor="canvas-card-search"><Search size={15} /><span>Find a card</span></label>
          <div className="canvas-search__input-row">
            <input id="canvas-card-search" type="search" value={query} placeholder="Question, product or evidence…" autoComplete="off" onChange={event => setQuery(event.target.value)} onKeyDown={event => {
              if (event.key === 'Escape') setQuery('');
              if (event.key === 'Enter' && searchResults.length) { event.preventDefault(); selectSearchResult(searchResults[0].id); }
            }} aria-describedby={hasQuery ? 'canvas-search-count' : undefined} />
            {query && <button type="button" aria-label="Clear card search" onClick={() => setQuery('')}><X size={15}/></button>}
          </div>
          {hasQuery && <div className="canvas-search__results">
            <p id="canvas-search-count" role="status">{searchResults.length} matching {searchResults.length === 1 ? 'card' : 'cards'}</p>
            {searchResults.length ? <ul>{searchResults.map(card => <li key={card.id}><button type="button" aria-label={`Go to ${canvasCardLabel(card, workspace)} · ${canvasCardKindLabel(card.kind)}`} onClick={() => selectSearchResult(card.id)}><span>{canvasCardLabel(card, workspace)}</span><small>{canvasCardKindLabel(card.kind)}</small><ArrowUpRight size={15}/></button></li>)}</ul> : <div className="canvas-search__empty"><p>No cards match “{query.trim()}”.</p><span>Try a follower’s name, a product or a topic already on the canvas.</span><button type="button" onClick={() => setQuery('')}>Clear search</button></div>}
          </div>}
        </div>
        <div className="canvas-navigation__focus">
          <button type="button" className="canvas-focus-toggle" aria-pressed={isFocused} disabled={!selectionExists} onClick={toggleConnectionFocus}><Link2 size={15}/><span>Focus connections</span></button>
          {isFocused ? <button type="button" className="canvas-show-all" onClick={showAllCards}>Show all cards</button> : <span className="canvas-navigation__count">{shownCount} {shownCount === 1 ? 'card' : 'cards'}</span>}
          {isFocused && <span className="canvas-navigation__count" role="status">{shownCount} of {workspace.cards.length} cards</span>}
        </div>
      </div>
      <div className="canvas-editing-tools">
        <div className="canvas-editing-toolbar" role="group" aria-label="Canvas editing controls">
          <span className="canvas-selection-count" role="status">{selectedNodes.length} selected</span>
          <span className="canvas-toolbar-divider" />
          <button type="button" aria-label="Select mode" title="Select mode: drag a box, or Shift/Cmd/Ctrl-click cards" aria-pressed={interactionMode === 'select'} onClick={() => setInteractionMode('select')}><MousePointer2 size={14} /><span>Select</span></button>
          <button type="button" aria-label="Pan mode" title="Pan mode: drag the background to move around" aria-pressed={interactionMode === 'pan'} onClick={() => setInteractionMode('pan')}><Hand size={14} /><span>Pan</span></button>
          <span className="canvas-toolbar-divider" />
          <button type="button" aria-label="Add review note" title="Add a private review note at the centre of this view" disabled={!onAddReviewNote} onClick={addReviewNote}><StickyNote size={14} /><span>Note</span></button>
          <button type="button" aria-label="Align selected items" aria-expanded={showAlign} aria-controls="canvas-align-actions" title="Align or space selected items" disabled={movableSelectionCount < 2} onClick={() => setShowAlign(value => !value)}><AlignStartVertical size={14} /><span>Align</span><ChevronDown size={11} /></button>
          <button type="button" aria-label={allLocked ? 'Unlock selected positions' : 'Lock selected positions'} title={allLocked ? 'Unlock the selected positions' : 'Lock the selected positions'} disabled={!selectedNodes.length || !onLock} onClick={() => onLock?.(selectedNodes.map(node => node.id), !allLocked)}>{allLocked ? <UnlockKeyhole size={14} /> : <LockKeyhole size={14} />}<span>{allLocked ? 'Unlock' : 'Lock'}</span></button>
          <span className="canvas-toolbar-divider" />
          <button type="button" className="canvas-toolbar-icon" aria-label="Undo layout change" title="Undo layout change (Cmd/Ctrl+Z)" aria-keyshortcuts="Meta+Z Control+Z" disabled={!canUndoLayout || !onUndoLayout} onClick={onUndoLayout}><Undo2 size={15} /></button>
          <button type="button" className="canvas-toolbar-icon" aria-label="Redo layout change" title="Redo layout change (Cmd/Ctrl+Shift+Z)" aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z" disabled={!canRedoLayout || !onRedoLayout} onClick={onRedoLayout}><Redo2 size={15} /></button>
          {onWorkflowChange && <><span className="canvas-toolbar-divider" /><button type="button" aria-label="Follow-ups and decision sections" onClick={openWorkflow}><MessageCircle size={14} /><span>Follow-ups & sections</span></button></>}
          {selectedProductIds.length > 0 && <button type="button" aria-label="Compare selected products" disabled={selectedProductIds.length < 2 || selectedProductIds.length > 3} title="Select two or three product cards to compare" onClick={() => { setComparisonIds(selectedProductIds); setToolPanel('comparison'); }}><ShoppingBag size={14} /><span>Compare ({selectedProductIds.length})</span></button>}
        </div>
        {showAlign && <div className="canvas-align-actions" id="canvas-align-actions" role="group" aria-label="Alignment actions">
          <button type="button" disabled={movableSelectionCount < 2} onClick={() => alignSelection('left')}><AlignStartVertical size={15} />Align left</button>
          <button type="button" disabled={movableSelectionCount < 2} onClick={() => alignSelection('top')}><AlignStartHorizontal size={15} />Align top</button>
          <button type="button" disabled={movableSelectionCount < 3} title="Select at least three items" onClick={() => alignSelection('horizontal')}><Columns3 size={15} />Space horizontally</button>
          <button type="button" disabled={movableSelectionCount < 3} title="Select at least three items" onClick={() => alignSelection('vertical')}><Rows3 size={15} />Space vertically</button>
          <p>Locked positions stay fixed.</p>
        </div>}
      </div>
      <div className="canvas-tip"><Move size={13} /><span>{interactionMode === 'select' ? 'Drag a box to select · Shift/Cmd-click to add · Drag cards to arrange' : 'Drag the background to pan · Select cards to edit'}</span></div>
      <ReactFlow<CanvasNode | SectionNode>
        nodes={[...sectionNodes, ...nodes]}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={changes => handleNodesChange(changes.filter(change => !('id' in change) || !sectionNodes.some(node => node.id === change.id)) as NodeChange<CanvasNode>[])}
        onEdgesChange={onEdgesChange}
        onNodeClick={(event, node) => {
          const additive = event?.shiftKey || event?.metaKey || event?.ctrlKey;
          additiveSelecting.current = false;
          if (!additive) node.type === 'evidence' ? selectCard(node.id, true) : selectCard(null);
        }}
        onSelectionStart={() => { boxSelecting.current = true; }}
        onSelectionEnd={() => { boxSelecting.current = false; }}
        onSelectionDragStop={(event, moved) => persistDrag(event, moved.filter((node): node is CanvasNode => node.type !== 'section'))}
        onPaneClick={clearSelection}
        onNodeDragStop={(event, node, movedNodes) => persistDrag(event, (movedNodes?.length ? movedNodes : [node]).filter((item): item is CanvasNode => item.type !== 'section'))}
        onConnect={connect}
        onEdgesDelete={deleted => deleted.forEach(edge => onRemoveLink(edge.id))}
        isValidConnection={connection => workspace.cards.some(card => card.id === connection.source) && workspace.cards.some(card => card.id === connection.target) && connection.source !== connection.target && !workspace.links.some(link => link.source === connection.source && link.target === connection.target)}
        fitView
        fitViewOptions={{ padding: .12, maxZoom: .86 }}
        minZoom={.3}
        maxZoom={1.5}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        deleteKeyCode={['Backspace', 'Delete']}
        panOnScroll
        zoomOnDoubleClick={false}
        selectionOnDrag={interactionMode === 'select'}
        selectionKeyCode={null}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        selectionMode={SelectionMode.Partial}
        panOnDrag={interactionMode === 'pan' ? true : [1, 2]}
        nodesConnectable
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.1} color="#cecac0" />
        {showMap && <MiniMap ariaLabel="Canvas overview" pannable zoomable nodeColor={node => node.selected ? '#9b3d2d' : '#c3bdaf'} maskColor="#f6f4efbb" />}
      </ReactFlow>
      <CanvasControls selectedId={selectionExists ? selectedId : null} showMap={showMap} onToggleMap={() => setShowMap(value => !value)} onFitAll={showAllCards} />
      {toolPanel === 'comparison' && <CanvasToolDialog label="Compare products" onClose={() => setToolPanel(null)}><ProductComparison workspace={workspace} productIds={comparisonIds} onClose={() => setToolPanel(null)} /></CanvasToolDialog>}
      {toolPanel === 'readiness' && <CanvasToolDialog label="Review answer evidence" onClose={() => setToolPanel(null)}>{readinessDraft ? <EvidenceReadinessPanel draft={readinessDraft} workspace={workspace} onClose={() => setToolPanel(null)} /> : <div className="canvas-tool-unavailable"><p>This answer is no longer in the workspace.</p><button type="button" onClick={() => setToolPanel(null)}>Close evidence review</button></div>}</CanvasToolDialog>}
      {toolPanel === 'workflow' && onWorkflowChange && <CanvasToolDialog label="Follow-ups and decision sections" onClose={() => setToolPanel(null)}><CanvasWorkflowPanel workspace={workspace} selectedCardIds={selectedEvidenceIds} onChange={onWorkflowChange} onClose={() => setToolPanel(null)} onFocusCards={focusSection} onClarifyQuestion={id => { setToolPanel(null); onClarifyQuestion?.(id); }} /></CanvasToolDialog>}
      {!workspace.cards.length && !workspace.reviewNotes?.length && <div className="canvas-empty"><FileText size={27} /><h3>A clear space to think</h3><p>Add a question or a source from the library to start connecting Maya’s knowledge.</p></div>}
    </section>
  );
}

export default function AnswerCanvas(props: AnswerCanvasProps) {
  return <ReactFlowProvider><CanvasInner {...props} /></ReactFlowProvider>;
}
