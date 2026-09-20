import React, {useState} from 'react';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {act,render,screen,fireEvent,waitFor} from '@testing-library/react';
import AnswerCanvas from '../src/components/AnswerCanvas';
import {createWorkspace} from '../src/lib/seed';
import type {Workspace} from '../src/lib/types';
const graph=vi.hoisted(()=>({nodes:[] as any[],fitView:vi.fn(),zoomTo:vi.fn(),zoomIn:vi.fn(),zoomOut:vi.fn(),forwardedChanges:vi.fn(),changeNodes:(_changes:any[])=>{},dragStop:(_event:unknown,_node:any)=>{},clickNode:(_event:unknown,_node:any)=>{},getNode:(id:string)=>graph.nodes.find(n=>n.id===id)}));
// The renderer adapter exposes graph state; it does not claim browser dragging or geometry acceptance.
vi.mock('@xyflow/react',async()=>{
 const {applyNodeChanges}=await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
 return {ReactFlowProvider:({children}:any)=>children,ReactFlow:({nodes,children,onPaneClick,onNodesChange,onNodeDragStop,onNodeClick}:any)=>{graph.nodes=nodes;graph.changeNodes=onNodesChange;graph.dragStop=onNodeDragStop;graph.clickNode=onNodeClick;return <div><button onClick={onPaneClick}>Deselect canvas card</button><output data-testid="visible-card-ids">{nodes.filter((n:any)=>!n.hidden).map((n:any)=>n.id).join(',')}</output>{children}</div>;},Handle:()=>null,Background:()=>null,MiniMap:()=> <div aria-label="Canvas overview">Overview</div>,BackgroundVariant:{Dots:'dots'},Position:{Left:'left',Right:'right'},MarkerType:{ArrowClosed:'arrow'},useNodesState:(initial:any)=>{const [value,setValue]=React.useState(initial);const handleChange=React.useCallback((changes:any[])=>{graph.forwardedChanges(changes);setValue((previous:any[])=>applyNodeChanges(changes,previous));},[]);return[value,setValue,handleChange];},useEdgesState:(initial:any)=>{const [value,setValue]=React.useState(initial);return[value,setValue,()=>{}];},useReactFlow:()=>graph,useViewport:()=>({zoom:1})};
});
beforeEach(()=>{graph.nodes=[];vi.clearAllMocks();vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>setTimeout(()=>cb(0),0));vi.stubGlobal('cancelAnimationFrame',clearTimeout);});afterEach(()=>vi.unstubAllGlobals());
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
