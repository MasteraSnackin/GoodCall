import React, {useState} from 'react';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {act,render,screen,fireEvent,waitFor} from '@testing-library/react';
import AnswerCanvas from '../src/components/AnswerCanvas';
import {createWorkspace} from '../src/lib/seed';
import type {Workspace} from '../src/lib/types';
const graph=vi.hoisted(()=>({nodes:[] as any[],fitView:vi.fn(),zoomTo:vi.fn(),zoomIn:vi.fn(),zoomOut:vi.fn(),forwardedChanges:vi.fn(),changeNodes:(_changes:any[])=>{},dragStop:(_event:unknown,_node:any,_nodes?:any[])=>{},props:{} as any,deferKeyboard:false,queuedKeyboardChanges:[] as any[],screenToFlowPosition:vi.fn((position:any)=>position),clickNode:(_event:unknown,_node:any)=>{},getNode:(id:string)=>graph.nodes.find(n=>n.id===id)}));
// The renderer adapter exposes graph state; it does not claim browser dragging or geometry acceptance.
vi.mock('@xyflow/react',async()=>{
 const {applyNodeChanges}=await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
 return {ReactFlowProvider:({children}:any)=>children,ReactFlow:(props:any)=>{const {nodes,children,onPaneClick,onNodesChange,onNodeDragStop,onNodeClick,nodeTypes}=props;graph.props=props;graph.nodes=nodes;graph.changeNodes=onNodesChange;graph.dragStop=onNodeDragStop;graph.clickNode=onNodeClick;return <div><div className="react-flow__nodesselection-rect" data-testid="keyboard-selection" tabIndex={0} onKeyDown={event=>{const directions:Record<string,{x:number;y:number}>={ArrowLeft:{x:-5,y:0},ArrowRight:{x:5,y:0},ArrowUp:{x:0,y:-5},ArrowDown:{x:0,y:5}};const direction=directions[event.key];if(direction){const changes=graph.nodes.filter(node=>node.selected&&node.draggable).map(node=>({type:'position',id:node.id,position:{x:node.position.x+direction.x,y:node.position.y+direction.y},dragging:false}));if(graph.deferKeyboard)graph.queuedKeyboardChanges=changes;else onNodesChange(changes);}}}/><button onClick={onPaneClick}>Deselect canvas card</button><output data-testid="visible-card-ids">{nodes.filter((n:any)=>!n.hidden).map((n:any)=>n.id).join(',')}</output>{nodes.filter((n:any)=>n.type==='review'&&!n.hidden).map((node:any)=>{const Component=nodeTypes.review;return <div className="react-flow__node" data-id={node.id} key={node.id}><Component id={node.id} data={node.data} selected={node.selected} width={node.measured?.width} height={node.measured?.height}/></div>;})}{children}</div>;},Handle:()=>null,Background:()=>null,MiniMap:()=> <div aria-label="Canvas overview">Overview</div>,BackgroundVariant:{Dots:'dots'},SelectionMode:{Partial:'partial'},Position:{Left:'left',Right:'right'},MarkerType:{ArrowClosed:'arrow'},useNodesState:(initial:any)=>{const [value,setValue]=React.useState(initial);const handleChange=React.useCallback((changes:any[])=>{graph.forwardedChanges(changes);setValue((previous:any[])=>applyNodeChanges(changes,previous));},[]);return[value,setValue,handleChange];},useEdgesState:(initial:any)=>{const [value,setValue]=React.useState(initial);return[value,setValue,()=>{}];},useReactFlow:()=>graph,useViewport:()=>({zoom:1})};
});
beforeEach(()=>{graph.nodes=[];graph.props={};graph.deferKeyboard=false;graph.queuedKeyboardChanges=[];vi.clearAllMocks();vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>setTimeout(()=>cb(0),0));vi.stubGlobal('cancelAnimationFrame',clearTimeout);});afterEach(()=>vi.unstubAllGlobals());
function makeHarness(w:Workspace){const move=vi.fn(),connect=vi.fn(),remove=vi.fn(),draft=vi.fn(),select=vi.fn();function Harness(){const [selected,setSelected]=useState<string|null>(null);return <AnswerCanvas workspace={w} selectedId={selected} onSelect={id=>{select(id);setSelected(id);}} onMove={move} onConnect={connect} onRemoveLink={remove} onDraft={draft}/>;}return{Harness,move,connect,remove,select};}
describe('Canvas navigation controls',()=>{
 it('finds a card by its contents, selects it and clears the search without changing workspace data',async()=>{const w=createWorkspace(),before=JSON.stringify(w);const h=makeHarness(w);render(<h.Harness/>);fireEvent.change(screen.getByRole('searchbox',{name:'Find a card'}),{target:{value:'sarah'}});expect(screen.getByText('1 matching card')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Go to @sarah · Question'}));const id=w.cards.find(c=>c.entityId==='q-04')!.id;expect(h.select).toHaveBeenCalledWith(id);expect((screen.getByRole('searchbox',{name:'Find a card'}) as HTMLInputElement).value).toBe('');await waitFor(()=>expect(graph.fitView).toHaveBeenCalledWith(expect.objectContaining({nodes:[{id}]})));expect(JSON.stringify(w)).toBe(before);expect(h.move).not.toHaveBeenCalled();});
 it('filters to a selected context, restores all cards on deselection and never deletes records',async()=>{const w=createWorkspace();w.links=[];const before=JSON.stringify(w);const h=makeHarness(w);render(<h.Harness/>);expect((screen.getByRole('button',{name:'Focus connections'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.change(screen.getByRole('searchbox',{name:'Find a card'}),{target:{value:'sarah'}});fireEvent.keyDown(screen.getByRole('searchbox',{name:'Find a card'}),{key:'Enter'});fireEvent.click(screen.getByRole('button',{name:'Focus connections'}));await waitFor(()=>expect(screen.getByTestId('visible-card-ids').textContent).toBe(w.cards.find(c=>c.entityId==='q-04')!.id));expect(screen.getByRole('button',{name:'Show all cards'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Deselect canvas card'}));await waitFor(()=>expect(screen.getByTestId('visible-card-ids').textContent?.split(',')).toHaveLength(w.cards.length));expect(h.remove).not.toHaveBeenCalled();expect(h.move).not.toHaveBeenCalled();expect(JSON.stringify(w)).toBe(before);});
 it('offers clear recovery from an empty search and explicit zoom/minimap controls',()=>{const h=makeHarness(createWorkspace());render(<h.Harness/>);fireEvent.change(screen.getByRole('searchbox',{name:'Find a card'}),{target:{value:'nonexistent-zebra'}});expect(screen.getByText('0 matching cards')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Clear search',exact:true}));expect((screen.getByRole('searchbox',{name:'Find a card'}) as HTMLInputElement).value).toBe('');fireEvent.click(screen.getByRole('button',{name:'Reset zoom to 100%'}));expect(graph.zoomTo).toHaveBeenCalledWith(1,expect.anything());fireEvent.click(screen.getByRole('button',{name:'Show minimap'}));expect(screen.getByLabelText('Canvas overview')).toBeTruthy();expect(screen.getByRole('button',{name:'Show minimap'}).getAttribute('aria-pressed')).toBe('true');});
 it('syncs keyboard selection, replacement and Escape deselection without a click or callback loop',async()=>{
  const w=createWorkspace();w.links=[];const h=makeHarness(w);render(<h.Harness/>);const [first,second]=w.cards;
  act(()=>graph.changeNodes([{type:'select',id:first.id,selected:true}]));
  expect(h.select).toHaveBeenCalledExactlyOnceWith(first.id);
  expect((screen.getByRole('button',{name:'Focus connections'}) as HTMLButtonElement).disabled).toBe(false);
  act(()=>graph.changeNodes([{type:'select',id:first.id,selected:false},{type:'select',id:second.id,selected:true}]));
  expect(h.select.mock.calls).toEqual([[first.id],[second.id]]);
  fireEvent.click(screen.getByRole('button',{name:'Focus connections'}));
  await waitFor(()=>expect(screen.getByTestId('visible-card-ids').textContent).toBe(second.id));
  act(()=>graph.changeNodes([{type:'select',id:first.id,selected:false}]));
  expect(h.select).toHaveBeenCalledTimes(2);
  act(()=>graph.changeNodes([{type:'select',id:second.id,selected:false}]));
  expect(h.select.mock.calls).toEqual([[first.id],[second.id],[null]]);
  await waitFor(()=>expect(screen.getByTestId('visible-card-ids').textContent?.split(',')).toHaveLength(w.cards.length));
  expect((screen.getByRole('button',{name:'Focus selected card'}) as HTMLButtonElement).disabled).toBe(true);
  act(()=>graph.changeNodes([{type:'select',id:second.id,selected:false}]));
  expect(h.select).toHaveBeenCalledTimes(3);expect(h.move).not.toHaveBeenCalled();expect(h.remove).not.toHaveBeenCalled();
 });
 it('forwards an explicit click or search on the selected card so hidden details can reopen',()=>{
  const w=createWorkspace(),h=makeHarness(w);render(<h.Harness/>);const card=w.cards.find(c=>c.entityId==='q-04')!;
  act(()=>graph.changeNodes([{type:'select',id:card.id,selected:true}]));expect(h.select).toHaveBeenCalledTimes(1);
  act(()=>graph.clickNode(null,graph.getNode(card.id)));expect(h.select).toHaveBeenCalledTimes(2);
  fireEvent.change(screen.getByRole('searchbox',{name:'Find a card'}),{target:{value:'sarah'}});
  fireEvent.click(screen.getByRole('button',{name:'Go to @sarah · Question'}));
  expect(h.select.mock.calls).toEqual([[card.id],[card.id],[card.id]]);
 });
 it('preserves node position changes and the drag-stop persistence callback when selection changes',()=>{
  const w=createWorkspace(),h=makeHarness(w);render(<h.Harness/>);const id=w.cards[0].id,position={x:512,y:348};
  const changes=[{type:'select',id,selected:true},{type:'position',id,position,dragging:true}];
  act(()=>graph.changeNodes(changes));
  expect(graph.forwardedChanges).toHaveBeenCalledWith(changes);expect(graph.getNode(id).position).toEqual(position);
  act(()=>graph.changeNodes([{type:'position',id,position:{x:530,y:370},dragging:false}]));
  expect(h.select).toHaveBeenCalledExactlyOnceWith(id);expect(graph.getNode(id).position).toEqual({x:530,y:370});
  act(()=>graph.dragStop(null,graph.getNode(id)));expect(h.move).toHaveBeenCalledExactlyOnceWith(id,530,370);
 });
});


describe('Canvas editing controls', () => {
 const reviewNote = { id: 'review-test', text: 'Check this before publishing.', x: 80, y: 120, createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z' };
 function editingHarness(w: Workspace) {
  const move = vi.fn(), moveMany = vi.fn(), lock = vi.fn(), addNote = vi.fn(), editNote = vi.fn(), deleteNote = vi.fn(), undo = vi.fn(), redo = vi.fn(), select = vi.fn();
  function Harness({ canUndo = false, canRedo = false }: { canUndo?: boolean; canRedo?: boolean }) {
   const [selected, setSelected] = useState<string | null>(null);
   return <AnswerCanvas workspace={w} selectedId={selected} onSelect={id => { select(id); setSelected(id); }} onMove={move} onMoveMany={moveMany} onLock={lock} onAddReviewNote={addNote} onEditReviewNote={editNote} onDeleteReviewNote={deleteNote} onUndoLayout={undo} onRedoLayout={redo} canUndoLayout={canUndo} canRedoLayout={canRedo} onConnect={() => {}} onRemoveLink={() => {}} onDraft={() => {}} />;
  }
  return { Harness, move, moveMany, lock, addNote, editNote, deleteNote, undo, redo, select };
 }
 function selectIds(ids: string[]) { act(() => graph.changeNodes(ids.map(id => ({ type: 'select', id, selected: true })))); }
 it('keeps multiple selection through inspector updates and persists a group drag in one batch', () => {
  const w = createWorkspace(), h = editingHarness(w); const view = render(<h.Harness />); const [first, second] = w.cards;
  selectIds([first.id, second.id]);
  expect(screen.getByText('2 selected')).toBeTruthy();
  expect(graph.getNode(first.id).selected).toBe(true); expect(graph.getNode(second.id).selected).toBe(true);
  expect(h.select).not.toHaveBeenCalled();
  view.rerender(<h.Harness canUndo />);
  expect(graph.getNode(first.id).selected).toBe(true); expect(graph.getNode(second.id).selected).toBe(true);
  const moved = [first, second].map((card, index) => ({ ...graph.getNode(card.id), position: { x: card.x + 30, y: card.y + 60 + index } }));
  const pointerUp = new MouseEvent('mouseup');
  act(() => { graph.dragStop(pointerUp, moved[0], moved); graph.props.onSelectionDragStop(pointerUp, moved); });
  expect(h.moveMany).toHaveBeenCalledExactlyOnceWith(moved.map(node => ({ id: node.id, ...node.position })));
  expect(h.move).not.toHaveBeenCalled();
  h.moveMany.mockClear();
  act(() => graph.props.onSelectionDragStop(null, moved));
  expect(h.moveMany).toHaveBeenCalledExactlyOnceWith(moved.map(node => ({ id: node.id, ...node.position })));
 });
 it('does not open details while a box or modifier gesture builds a group', () => {
  const w = createWorkspace(), h = editingHarness(w); render(<h.Harness />); const [first, second] = w.cards;
  act(() => graph.props.onSelectionStart());
  selectIds([first.id]); selectIds([second.id]);
  act(() => graph.props.onSelectionEnd());
  expect(h.select).not.toHaveBeenCalled();
  act(() => graph.clickNode({ shiftKey: true }, graph.getNode(first.id)));
  expect(h.select).not.toHaveBeenCalled();
  expect(screen.getByText('2 selected')).toBeTruthy();
  act(() => graph.clickNode({}, graph.getNode(first.id)));
  expect(h.select).toHaveBeenCalledExactlyOnceWith(first.id);
  expect(screen.getByText('2 selected')).toBeTruthy();
 });
 it('commits a keyboard group nudge once, without persisting unrelated dimensions or pointer updates', () => {
  const w = createWorkspace(), h = editingHarness(w); render(<h.Harness />); const [first, second] = w.cards;
  selectIds([first.id, second.id]);
  fireEvent.keyDown(screen.getByTestId('keyboard-selection'), { key: 'ArrowRight' });
  expect(h.moveMany).toHaveBeenCalledExactlyOnceWith([first, second].map(card => ({ id: card.id, x: card.x + 5, y: card.y })));
  expect(h.move).not.toHaveBeenCalled();
  h.moveMany.mockClear();
  act(() => graph.changeNodes([{ type: 'dimensions', id: first.id, dimensions: { width: 290, height: 200 }, setAttributes: true }]));
  act(() => graph.changeNodes([{ type: 'position', id: first.id, position: { x: first.x + 20, y: first.y }, dragging: false }]));
  expect(h.moveMany).not.toHaveBeenCalled();
 });
 it('persists a keyboard position batch delivered after the key event, and drops stale requests before pointer gestures', async () => {
  const w = createWorkspace(), h = editingHarness(w); render(<h.Harness />); const [first, second] = w.cards;
  selectIds([first.id, second.id]); graph.deferKeyboard = true;
  fireEvent.keyDown(screen.getByTestId('keyboard-selection'), { key: 'ArrowRight' });
  await act(async () => { await Promise.resolve(); });
  act(() => graph.changeNodes(graph.queuedKeyboardChanges));
  expect(h.moveMany).toHaveBeenCalledExactlyOnceWith([first, second].map(card => ({ id: card.id, x: card.x + 5, y: card.y })));
  h.moveMany.mockClear();
  fireEvent.keyDown(screen.getByTestId('keyboard-selection'), { key: 'ArrowRight' });
  fireEvent.pointerDown(screen.getByTestId('keyboard-selection'));
  act(() => graph.changeNodes(graph.queuedKeyboardChanges));
  expect(h.moveMany).not.toHaveBeenCalled();
 });
 it('selects a newly added note above the previous group and focuses its text', async () => {
  const w = createWorkspace(), h = editingHarness(w); const view = render(<h.Harness />);
  selectIds(w.cards.slice(0, 2).map(card => card.id));
  fireEvent.click(screen.getByRole('button', { name: 'Add review note' }));
  w.reviewNotes = [{ ...reviewNote }];
  view.rerender(<h.Harness />);
  expect(graph.getNode(reviewNote.id).selected).toBe(true);
  expect(graph.nodes.filter(node => node.selected).map(node => node.id)).toEqual([reviewNote.id]);
  expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Review note text' }));
  act(() => graph.changeNodes([{ type: 'dimensions', id: reviewNote.id, dimensions: { width: 274, height: 230 }, setAttributes: true }]));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Review note text' })));
 });
 it('offers Select and Pan modes, with box selection and additive modifier keys', () => {
  const h = editingHarness(createWorkspace()); render(<h.Harness />);
  expect(graph.props.selectionOnDrag).toBe(true); expect(graph.props.panOnDrag).toEqual([1, 2]);
  expect(graph.props.multiSelectionKeyCode).toEqual(['Shift', 'Meta', 'Control']);
  fireEvent.click(screen.getByRole('button', { name: 'Pan mode' }));
  expect(graph.props.selectionOnDrag).toBe(false); expect(graph.props.panOnDrag).toBe(true);
  expect(screen.getByRole('button', { name: 'Pan mode' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Select mode' })); expect(graph.props.selectionOnDrag).toBe(true);
 });
 it('disables empty-selection actions and uses measured sizes for a single alignment batch', () => {
  const w = createWorkspace(), h = editingHarness(w); render(<h.Harness />);
  expect((screen.getByRole('button', { name: 'Align selected items' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Lock selected positions' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Undo layout change' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Redo layout change' }) as HTMLButtonElement).disabled).toBe(true);
  const [first, second, third] = w.cards; selectIds([first.id, second.id]);
  fireEvent.click(screen.getByRole('button', { name: 'Align selected items' }));
  expect((screen.getByRole('button', { name: 'Space horizontally' }) as HTMLButtonElement).disabled).toBe(true);
  selectIds([third.id]);
  act(() => graph.changeNodes([
   { type: 'position', id: first.id, position: { x: 0, y: first.y }, dragging: true },
   { type: 'position', id: second.id, position: { x: 200, y: second.y }, dragging: true },
   { type: 'position', id: third.id, position: { x: 800, y: third.y }, dragging: true },
   ...[first, second, third].map((card, index) => ({ type: 'dimensions', id: card.id, dimensions: { width: index === 0 ? 100 : 200, height: 100 }, setAttributes: true })),
  ]));
  fireEvent.click(screen.getByRole('button', { name: 'Space horizontally' }));
  expect(h.moveMany).toHaveBeenCalledTimes(1);
  expect(h.moveMany.mock.calls[0][0]).toEqual(expect.arrayContaining([{ id: second.id, x: 350, y: second.y }]));
 });
 it('keeps locked nodes selectable, excludes them from drag persistence and supports lock/unlock', () => {
  const w = createWorkspace(); w.cards[0].locked = true; const h = editingHarness(w); render(<h.Harness />); const [first, second] = w.cards;
  expect(graph.getNode(first.id).draggable).toBe(false);
  selectIds([first.id]); fireEvent.click(screen.getByRole('button', { name: 'Unlock selected positions' })); expect(h.lock).toHaveBeenLastCalledWith([first.id], false);
  expect((screen.getByRole('button', { name: 'Align selected items' }) as HTMLButtonElement).disabled).toBe(true);
  selectIds([second.id]); expect((screen.getByRole('button', { name: 'Align selected items' }) as HTMLButtonElement).disabled).toBe(true); fireEvent.click(screen.getByRole('button', { name: 'Lock selected positions' })); expect(h.lock).toHaveBeenLastCalledWith([first.id, second.id], true);
  const moved = [first, second].map(card => ({ ...graph.getNode(card.id), position: { x: card.x + 25, y: card.y + 25 } }));
  act(() => graph.dragStop(null, moved[1], moved));
  expect(h.moveMany).toHaveBeenCalledExactlyOnceWith([{ id: second.id, ...moved[1].position }]);
 });
 it('adds notes in the current viewport and keeps their editable text separate from evidence connections', () => {
  const w = createWorkspace(); w.reviewNotes = [reviewNote]; const h = editingHarness(w); render(<h.Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Add review note' })); expect(graph.screenToFlowPosition).toHaveBeenCalledOnce(); expect(h.addNote).toHaveBeenCalledExactlyOnceWith({ x: -137, y: -110 });
  expect(screen.getByText('Private · Not evidence')).toBeTruthy();
  const textarea = screen.getByRole('textbox', { name: 'Review note text' }); expect(textarea.getAttribute('maxlength')).toBe('4000');
  fireEvent.change(textarea, { target: { value: 'Confirm the source.' } }); expect(h.editNote).toHaveBeenCalledExactlyOnceWith(reviewNote.id, 'Confirm the source.');
  expect(graph.getNode(reviewNote.id).connectable).toBe(false); expect(graph.getNode(reviewNote.id).deletable).toBe(false);
  expect(graph.props.isValidConnection({ source: reviewNote.id, target: w.cards[0].id })).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Remove review note' })); expect(h.deleteNote).toHaveBeenCalledExactlyOnceWith(reviewNote.id);
 });
 it('scopes layout shortcuts to the canvas, leaves text editing alone and clears selection with Escape', () => {
  const w = createWorkspace(); w.reviewNotes = [reviewNote]; const h = editingHarness(w); render(<h.Harness canUndo canRedo />);
  const canvas = screen.getByRole('region', { name: 'Maya’s movable evidence canvas' });
  fireEvent.keyDown(canvas, { key: 'z', metaKey: true }); expect(h.undo).toHaveBeenCalledOnce();
  fireEvent.keyDown(canvas, { key: 'z', ctrlKey: true, shiftKey: true }); expect(h.redo).toHaveBeenCalledOnce();
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Review note text' }), { key: 'z', metaKey: true });
  fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Find a card' }), { key: 'z', ctrlKey: true });
  fireEvent.keyDown(document.body, { key: 'z', metaKey: true }); expect(h.undo).toHaveBeenCalledOnce();
  selectIds(w.cards.slice(0, 2).map(card => card.id)); fireEvent.keyDown(canvas, { key: 'Escape' }); expect(screen.getByText('0 selected')).toBeTruthy();
  expect(graph.nodes.some(node => node.selected)).toBe(false);
 });
});
