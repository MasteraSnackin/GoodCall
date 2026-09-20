import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  Handle, Position, MarkerType, useNodesState, useEdgesState,
  useReactFlow, useViewport, MiniMap,
} from '@xyflow/react';
import type { Node, NodeProps, NodeChange, Edge, Connection } from '@xyflow/react';
import {
  ArrowUpRight, Check, FileText, Link2, Maximize2, MessageCircle,
  Minus, Move, Plus, ShoppingBag, Sparkles, TriangleAlert,
  Focus, Map, Search, X,
} from 'lucide-react';
import type { CanvasCard, CardKind, Workspace } from '../lib/types';
import { mayaNotes } from '../lib/seed';
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
};
type EvidenceNode = Node<CardData, 'evidence'>;

const kindIcons = {
  question: MessageCircle,
  product: ShoppingBag,
  note: FileText,
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

const nodeTypes = { evidence: EvidenceCard };

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
        <button title={showMap ? 'Hide minimap' : 'Show minimap'} aria-label="Show minimap" aria-pressed={showMap} onClick={onToggleMap}><Map size={16} /></button>
      </div>
      <span className="canvas-bottom-hint"><Link2 size={12} />Select a connection + Delete to remove</span>
    </div>
  );
}

function CanvasInner({ workspace, selectedId, onSelect, onMove, onConnect, onRemoveLink, onDraft, focusCardId, focusKey, arrangeKey }: AnswerCanvasProps) {
  const [query, setQuery] = useState('');
  const [focusConnections, setFocusConnections] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [searchFocus, setSearchFocus] = useState<{ id: string; key: number } | null>(null);
  const requestedSelection = useRef(selectedId);
  const selectionExists = selectedId !== null && workspace.cards.some(card => card.id === selectedId);
  const isFocused = focusConnections && selectionExists;
  const contextIds = useMemo(() => relatedCanvasCardIds(workspace, selectedId), [workspace, selectedId]);
  const searchResults = useMemo(() => searchCanvasCards(workspace, query), [workspace, query]);
  const hasQuery = query.trim().length > 0;
  const shownCount = isFocused ? workspace.cards.filter(card => contextIds.has(card.id)).length : workspace.cards.length;

  useEffect(() => {
    if (!selectionExists) setFocusConnections(false);
  }, [selectionExists]);

  useEffect(() => {
    requestedSelection.current = selectedId;
  }, [selectedId]);

  const selectCard = useCallback((id: string | null, openDetails = false) => {
    if (requestedSelection.current === id && !openDetails) return;
    requestedSelection.current = id;
    onSelect(id);
  }, [onSelect]);

  const nodeModels = useMemo<EvidenceNode[]>(() => workspace.cards.map(card => ({
    id: card.id, type: 'evidence', position: { x: card.x, y: card.y },
    data: presentCard(card, workspace, onDraft), selected: card.id === selectedId,
    hidden: isFocused && !contextIds.has(card.id),
    deletable: false, draggable: true, ariaLabel: `${canvasCardKindLabel(card.kind)}: ${canvasCardLabel(card, workspace)}`,
  })), [workspace, selectedId, onDraft, isFocused, contextIds]);
  const edgeModels = useMemo<Edge[]>(() => workspace.links.map(link => ({
    id: link.id, source: link.source, target: link.target, type: 'smoothstep',
    animated: false,
    hidden: isFocused && (!contextIds.has(link.source) || !contextIds.has(link.target)),
    style: { stroke: '#b6b1a6', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#b6b1a6' },
    interactionWidth: 20,
  })), [workspace.links, isFocused, contextIds]);
  const [nodes, setNodes, onNodesChange] = useNodesState<EvidenceNode>(nodeModels);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(edgeModels);
  const { fitView, getNode } = useReactFlow<EvidenceNode>();

  const handleNodesChange = useCallback((changes: NodeChange<EvidenceNode>[]) => {
    // React Flow keyboard selection emits changes without calling onNodeClick.
    // Keep its full position/dimension handling and mirror only selection to the inspector.
    onNodesChange(changes);
    let nextSelectedId = requestedSelection.current;
    for (const change of changes) {
      if (change.type !== 'select') continue;
      if (change.selected && workspace.cards.some(card => card.id === change.id)) nextSelectedId = change.id;
      else if (!change.selected && nextSelectedId === change.id) nextSelectedId = null;
    }
    selectCard(nextSelectedId);
  }, [onNodesChange, workspace.cards, selectCard]);

  useEffect(() => {
    setNodes(previous => nodeModels.map(node => {
      const existing = previous.find(item => item.id === node.id);
      return { ...existing, ...node, position: existing?.dragging ? existing.position : node.position };
    }));
  }, [nodeModels, setNodes]);
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
    selectCard(id, true);
    setQuery('');
    setSearchFocus(previous => ({ id, key: (previous?.key || 0) + 1 }));
  };

  const connect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) onConnect(connection.source, connection.target);
  }, [onConnect]);

  return (
    <section className="answer-canvas" aria-label="Maya’s movable evidence canvas">
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
      <div className="canvas-tip"><Move size={13} /><span>Drag to arrange · Link the side dots</span></div>
      <ReactFlow<EvidenceNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => selectCard(node.id, true)}
        onPaneClick={() => selectCard(null)}
        onNodeDragStop={(_, node) => onMove(node.id, node.position.x, node.position.y)}
        onConnect={connect}
        onEdgesDelete={deleted => deleted.forEach(edge => onRemoveLink(edge.id))}
        isValidConnection={connection => connection.source !== connection.target && !workspace.links.some(link => link.source === connection.source && link.target === connection.target)}
        fitView
        fitViewOptions={{ padding: .12, maxZoom: .86 }}
        minZoom={.3}
        maxZoom={1.5}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        deleteKeyCode={['Backspace', 'Delete']}
        panOnScroll
        zoomOnDoubleClick={false}
        selectionOnDrag={false}
        nodesConnectable
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.1} color="#cecac0" />
        {showMap && <MiniMap ariaLabel="Canvas overview" pannable zoomable nodeColor={node => node.selected ? '#9b3d2d' : '#c3bdaf'} maskColor="#f6f4efbb" />}
      </ReactFlow>
      <CanvasControls selectedId={selectionExists ? selectedId : null} showMap={showMap} onToggleMap={() => setShowMap(value => !value)} onFitAll={showAllCards} />
      {!workspace.cards.length && <div className="canvas-empty"><FileText size={27} /><h3>A clear space to think</h3><p>Add a question or a source from the library to start connecting Maya’s knowledge.</p></div>}
    </section>
  );
}

export default function AnswerCanvas(props: AnswerCanvasProps) {
  return <ReactFlowProvider><CanvasInner {...props} /></ReactFlowProvider>;
}
