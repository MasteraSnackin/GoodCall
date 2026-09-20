import React, { useState } from 'react';
import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest';
import { act, render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import AnswerCanvas from '../src/components/AnswerCanvas';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer } from '../src/lib/engine';
import type { Workspace } from '../src/lib/types';

const graph = vi.hoisted(() => ({ nodes: [] as any[], props: {} as any, fitView: vi.fn(), getNode: (id: string) => graph.nodes.find(node => node.id === id), screenToFlowPosition: (value: unknown) => value, zoomIn: vi.fn(), zoomOut: vi.fn(), zoomTo: vi.fn() }));
// Graph geometry is inspected here; pointer gestures and rendered layout require browser acceptance.
vi.mock('@xyflow/react', async () => {
  const { applyNodeChanges } = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ReactFlowProvider: ({ children }: any) => children,
    ReactFlow: (props: any) => { graph.props = props; graph.nodes = props.nodes; return <div>{props.nodes.filter((node: any) => !node.hidden).map((node: any) => { const Component = props.nodeTypes[node.type]; return <Component key={node.id} id={node.id} data={node.data} selected={node.selected} />; })}{props.children}</div>; },
    useNodesState: (initial: any[]) => { const [nodes, setNodes] = useState(initial); return [nodes, setNodes, (changes: any[]) => setNodes(previous => applyNodeChanges(changes, previous))]; },
    useEdgesState: (initial: any[]) => { const [edges, setEdges] = useState(initial); return [edges, setEdges, () => {}]; },
    useReactFlow: () => graph, useViewport: () => ({ zoom: 1 }), Handle: () => null, Background: () => null, MiniMap: () => null,
    BackgroundVariant: { Dots: 'dots' }, Position: { Left: 'left', Right: 'right' }, MarkerType: { ArrowClosed: 'arrow' }, SelectionMode: { Partial: 'partial' },
  };
});

beforeEach(() => { graph.nodes = []; graph.props = {}; vi.clearAllMocks(); vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0)); vi.stubGlobal('cancelAnimationFrame', clearTimeout); });
afterEach(() => vi.unstubAllGlobals());
const props = { selectedId: null, onSelect: vi.fn(), onMove: vi.fn(), onConnect: vi.fn(), onRemoveLink: vi.fn(), onDraft: vi.fn() };
function select(ids: string[]) { act(() => graph.props.onNodesChange(ids.map(id => ({ type: 'select', id, selected: true })))); }

describe('Integrated canvas decision tools', () => {
  it('opens comparison only for two or three selected products and preserves the canvas data', () => {
    const workspace = createWorkspace();
    const extra = workspace.products.find(product => !workspace.cards.some(card => card.kind === 'product' && card.entityId === product.id))!;
    workspace.cards.push({ id: 'extra-product', kind: 'product', entityId: extra.id, x: 430, y: 650 });
    const before = JSON.stringify(workspace);
    render(<AnswerCanvas {...props} workspace={workspace} />);
    expect(screen.queryByRole('button', { name: 'Compare selected products' })).toBeNull();
    const products = workspace.cards.filter(card => card.kind === 'product').slice(0, 2);
    select([products[0].id]);
    expect((screen.getByRole('button', { name: 'Compare selected products' }) as HTMLButtonElement).disabled).toBe(true);
    select([products[1].id]);
    const trigger = screen.getByRole('button', { name: 'Compare selected products' }); trigger.focus(); fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Compare products' });
    for (const card of products) expect(within(dialog).getByRole('heading', { name: workspace.products.find(product => product.id === card.entityId)!.name })).toBeTruthy();
    expect(within(dialog).getByText('Confirm the details before calculating.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close product comparison' }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
    expect(JSON.stringify(workspace)).toBe(before);
  });

  it('opens full evidence checks from the answer and refreshes an approved answer after its source changes', () => {
    const workspace = createWorkspace();
    const question = workspace.questions.find(item => item.id === 'q-04')!;
    const draft = { ...draftAnswer(question, workspace.products), status: 'approved' as const };
    workspace.drafts = [draft]; workspace.cards.push({ id: 'test-answer', kind: 'draft', entityId: draft.id, x: 900, y: 100 });
    const view = render(<AnswerCanvas {...props} workspace={workspace} />);
    const badge = screen.getByRole('button', { name: new RegExp(`for ${draft.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
    fireEvent.click(badge);
    expect(screen.getByRole('dialog', { name: 'Review answer evidence' })).toBeTruthy();
    const productId = draft.productIds[0];
    const changed = { ...workspace, products: workspace.products.map(product => product.id === productId ? { ...product, revision: product.revision + 1 } : product) };
    view.rerender(<AnswerCanvas {...props} workspace={changed} />);
    expect(within(screen.getByRole('dialog')).getByText('Evidence changed')).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByText('Approved', { exact: true })).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByText(/changed after this draft was created/)).toBeTruthy();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(draft.status).toBe('approved');
  });

  it('draws sections around current member bounds without making them evidence or movable nodes', async () => {
    const workspace = createWorkspace();
    const cards = workspace.cards.slice(0, 2);
    workspace.decisionSections = [{ id: 'section-test', title: 'Two-product routine', cardIds: cards.map(card => card.id), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
    const view = render(<AnswerCanvas {...props} workspace={workspace} />);
    const frame = graph.nodes.find(node => node.type === 'section');
    expect(frame.width).toBeGreaterThan(274); expect(frame.height).toBeGreaterThan(300);
    expect(frame.zIndex).toBe(0); expect(graph.nodes.find(node => node.id === cards[0].id).zIndex).toBeGreaterThan(frame.zIndex);
    expect(frame.selectable).toBe(false); expect(frame.connectable).toBe(false); expect(frame.draggable).toBe(false);
    expect(screen.getByText('Two-product routine')).toBeTruthy();
    const changed = { ...workspace, cards: workspace.cards.map(card => card.id === cards[0].id ? { ...card, x: -250 } : card) };
    view.rerender(<AnswerCanvas {...props} workspace={changed} />);
    await waitFor(() => expect(graph.nodes.find(node => node.type === 'section').position.x).toBe(-272));
    expect(graph.props.isValidConnection({ source: frame.id, target: cards[0].id })).toBe(false);
    expect(workspace.links).toEqual(changed.links);
  });

  it('shows the saved follow-up on its question without changing advice when tracking status changes', () => {
    const workspace = createWorkspace(), question = workspace.questions.find(item => workspace.cards.some(card => card.kind === 'question' && card.entityId === item.id))!;
    workspace.questionFollowUps = [{ id: 'followup-test', questionId: question.id, prompt: 'What do you already use?', status: 'Waiting for reply', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
    render(<AnswerCanvas {...props} workspace={workspace} onWorkflowChange={() => {}} />);
    const card = screen.getByRole('article', { name: `Audience question: ${question.handle}` });
    fireEvent.click(within(card).getByRole('button', { name: /Waiting for reply/ }));
    expect(screen.getByRole('dialog', { name: 'Follow-ups and decision sections' })).toBeTruthy();
    expect(workspace.questionFollowUps[0].status).toBe('Waiting for reply');
  });
});
