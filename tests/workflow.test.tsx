import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import AdvicePage from '../src/components/AdvicePage';
import {createWorkspace,mayaNotes} from '../src/lib/seed';
import {draftAnswer,toPublishedAdvice} from '../src/lib/engine';
import {decodeAdvice,encodeAdvice} from '../src/lib/share';
import type {Workspace} from '../src/lib/types';
// Test the app's workflow contracts without launching a browser. Canvas rendering/dragging requires visual browser acceptance.
vi.mock('../src/components/AnswerCanvas',()=>({default:({workspace,onSelect,onDraft,onRemoveLink,onConnect}: {workspace:Workspace;onSelect:(id:string)=>void;onDraft:(id:string)=>void;onRemoveLink:(id:string)=>void;onConnect:(source:string,target:string)=>void})=><div data-testid="canvas-test-adapter">{workspace.cards.map(c=><button key={c.id} onClick={()=>onSelect(c.id)}>Select {c.kind} {c.entityId}</button>)}{workspace.links.filter(l=>['product','note'].includes(workspace.cards.find(c=>c.id===l.source)?.kind||'')).map(l=><button key={l.id} onClick={()=>onRemoveLink(l.id)}>Disconnect {workspace.cards.find(c=>c.id===l.source)?.entityId} evidence</button>)}{workspace.cards.filter(c=>c.kind==='note').flatMap(note=>workspace.cards.filter(c=>c.kind==='draft').map(draft=><button key={`${note.id}-${draft.id}`} onClick={()=>onConnect(note.id,draft.id)}>Connect {note.entityId} evidence</button>))}<button onClick={()=>onDraft('q-04')}>Create Cloud answer</button><button onClick={()=>onDraft('q-05')}>Create Barrier answer</button></div>}));
function getAdvice(){const w=createWorkspace();const d=draftAnswer(w.questions.find(q=>q.id==='q-04')!,w.products);return toPublishedAdvice({...d,status:'published'},w);}
describe('Creator workflow (DOM unit integration, not a browser)',()=>{
 it('places new products and notebook cards in free space without moving existing cards',()=>{
  const initial=createWorkspace();render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:/Maya’s knowledge/}));fireEvent.click(screen.getByRole('button',{name:/Night Serum/}));
  fireEvent.click(screen.getByRole('button',{name:/Maya’s knowledge/}));fireEvent.click(screen.getByRole('button',{name:/Keep the relationship/}));
  const w=JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!) as Workspace;
  for(const card of initial.cards)expect(w.cards.find(c=>c.id===card.id)).toEqual(card);
  for(const entityId of ['night-serum','maya-voice']){const added=w.cards.find(c=>c.entityId===entityId)!;expect(added).toBeTruthy();expect(w.cards.filter(c=>c.id!==added.id&&Math.abs(c.x-added.x)<274&&Math.abs(c.y-added.y)<280)).toEqual([]);}
 });
 it('attaches notebook evidence, preserves it on regeneration, and removes it with its approval',()=>{
  const initial=createWorkspace();initial.cards.push({id:'test-voice-note',kind:'note',entityId:'maya-voice',x:420,y:700});localStorage.setItem('maya-answer-canvas-v1',JSON.stringify(initial));
  render(<App/>);fireEvent.click(screen.getByText('Create Cloud answer'));fireEvent.click(screen.getByRole('button',{name:'Approve answer'}));
  fireEvent.click(screen.getByRole('button',{name:'Connect maya-voice evidence'}));
  const read=()=>JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!) as Workspace;const note=mayaNotes.find(n=>n.id==='maya-voice')!;
  let w=read();expect(w.drafts[0].sourceRefs).toContainEqual(note.source);expect(w.drafts[0].status).toBe('draft');expect(w.drafts[0].approvedAt).toBeUndefined();
  fireEvent.click(screen.getByRole('button',{name:'Regenerate from evidence'}));fireEvent.click(screen.getByRole('button',{name:'Use updated suggestion'}));w=read();expect(w.drafts[0].sourceRefs).toContainEqual(note.source);expect(screen.getByRole('button',{name:'Disconnect maya-voice evidence'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Approve answer'}));fireEvent.click(screen.getByRole('button',{name:'Disconnect maya-voice evidence'}));
  w=read();expect(w.drafts[0].sourceRefs).not.toContainEqual(note.source);expect(w.drafts[0].status).toBe('draft');expect(w.drafts[0].approvedAt).toBeUndefined();expect(screen.queryByRole('button',{name:'Disconnect maya-voice evidence'})).toBeNull();
 });
 it('creates, approves and publishes an answer, shares only public evidence and returns edits to review',async()=>{
  render(<App/>);fireEvent.click(screen.getByText('Create Cloud answer'));
  const editor=screen.getByRole('textbox',{name:'Your answer'});expect((editor as HTMLTextAreaElement).value).toContain('£38');
  const approve=screen.getByRole('button',{name:'Approve answer'});expect((approve as HTMLButtonElement).disabled).toBe(false);fireEvent.click(approve);
  fireEvent.click(screen.getByRole('button',{name:'Publish advice card'}));fireEvent.click(screen.getByRole('button',{name:'Publish this version'}));fireEvent.click(screen.getByRole('button',{name:'Share approved answer'}));
  const link=(screen.getByRole('textbox',{name:'Share link'}) as HTMLInputElement).value;const advice=decodeAdvice(link.split('#/advice/')[1]);expect(advice).not.toBeNull();expect(advice!.sourceRefs.every(s=>s.page>0&&s.page!==5)).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Close dialog'}));fireEvent.change(editor,{target:{value:'Cloud Cream costs £12.'}});
  expect((screen.getByRole('button',{name:'Approve answer'}) as HTMLButtonElement).disabled).toBe(true);
  await waitFor(()=>{const w=JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!);expect(w.drafts[0].status).toBe('draft');});
 });
 it('removes product evidence and approval together, then regenerates the correct graph links',()=>{
  render(<App/>);fireEvent.click(screen.getByText('Create Cloud answer'));fireEvent.click(screen.getByRole('button',{name:'Approve answer'}));
  fireEvent.click(screen.getByRole('button',{name:'Disconnect cloud-cream evidence'}));
  expect((screen.getByRole('button',{name:'Approve answer'}) as HTMLButtonElement).disabled).toBe(true);
  let w=JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!);expect(w.drafts[0].productIds).toEqual([]);expect(w.drafts[0].approvedAt).toBeUndefined();
  fireEvent.click(screen.getByRole('button',{name:'Regenerate from evidence'}));fireEvent.click(screen.getByRole('button',{name:'Use updated suggestion'}));
  expect((screen.getByRole('button',{name:'Approve answer'}) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole('button',{name:'Disconnect cloud-cream evidence'})).toBeTruthy();
 });
 it('clarifies a question while retaining its original source and regenerating draft evidence and connections',()=>{
  render(<App/>);fireEvent.click(screen.getByText('Create Cloud answer'));fireEvent.click(screen.getByRole('button',{name:'Approve answer'}));
  fireEvent.click(screen.getByRole('button',{name:'Select question q-04'}));fireEvent.click(screen.getByRole('button',{name:'Add or correct context'}));
  fireEvent.change(screen.getByRole('textbox',{name:'Clarified question'}),{target:{value:'Is Glass Drop worth the price?'}});
  fireEvent.click(screen.getByRole('button',{name:'Save context and regenerate'}));
  const w=JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!);const question=w.questions.find((q:any)=>q.id==='q-04');const draft=w.drafts[0];
  expect(question.originalSource.page).toBeGreaterThan(0);expect(question.source.page).toBe(0);expect(draft.status).toBe('draft');expect(draft.approvedAt).toBeUndefined();expect(draft.productIds).toEqual(['glass-drop']);
  expect(screen.queryByRole('button',{name:'Disconnect cloud-cream evidence'})).toBeNull();expect(screen.getByRole('button',{name:'Disconnect glass-drop evidence'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:`Select draft ${draft.id}`}));expect((screen.getByRole('textbox',{name:'Your answer'}) as HTMLTextAreaElement).value).toContain('Glass Drop');
 });
 it('holds a missing-product answer even when an unrelated answer can proceed',()=>{render(<App/>);fireEvent.click(screen.getByText('Create Barrier answer'));expect((screen.getByRole('button',{name:'Approve answer'}) as HTMLButtonElement).disabled).toBe(true);expect(screen.getByText('Needs more evidence')).toBeTruthy();});
 it('adds a question and keeps user context in the question list',async()=>{const user=userEvent.setup();render(<App/>);await user.click(screen.getByRole('button',{name:'Add question',exact:true}));await user.type(screen.getByLabelText(/Follower name/),'@test');await user.type(screen.getByLabelText('Their question'),'Is Cloud Cream worth £38 for dry skin?');const dialog=screen.getByRole('dialog');await user.click(within(dialog).getByRole('button',{name:'Add question'}));expect(screen.getByText('@test')).toBeTruthy();expect(screen.getByText('Is Cloud Cream worth £38 for dry skin?')).toBeTruthy();});
 it('requires a resolution and source reference before recording a resolved issue',()=>{render(<App/>);fireEvent.click(screen.getByRole('button',{name:/Evidence & issues/}));fireEvent.click(screen.getByRole('button',{name:/Barrier Cream has no product record/}));const resolve=screen.getByRole('button',{name:'Record resolution'});expect((resolve as HTMLButtonElement).disabled).toBe(true);fireEvent.change(screen.getByLabelText('Resolution or clarification'),{target:{value:'Reviewed; the organiser confirmed this is a missing source.'}});fireEvent.change(screen.getByLabelText('Supporting reference'),{target:{value:'Test-only organiser clarification'}});fireEvent.click(resolve);expect(screen.getByText('Resolution recorded')).toBeTruthy();});
 it('offers visual choices inside the app and persists a selected theme',()=>{render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Workspace preferences'}));expect(screen.getByText('Warm studio')).toBeTruthy();expect(screen.getByText('Beauty editorial')).toBeTruthy();expect(screen.getByText('Case-file desk')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:/Beauty editorial/}));expect(document.documentElement.dataset.theme).toBe('beauty');expect(localStorage.getItem('maya-theme')).toBe('beauty');});
 it('replaces a shared answer when the hash changes in the same app instance',async()=>{const a=getAdvice();const b={...a,id:'different-answer',title:'A different approved answer'};window.location.hash=`/advice/${encodeAdvice(a)}`;render(<App/>);expect(screen.getByRole('heading',{name:a.title})).toBeTruthy();window.location.hash=`/advice/${encodeAdvice(b)}`;fireEvent(window,new HashChangeEvent('hashchange'));await waitFor(()=>expect(screen.getByRole('heading',{name:b.title})).toBeTruthy());expect(screen.queryByRole('heading',{name:a.title})).toBeNull();});
});
describe('Follower page',()=>{
 it('saves advice persistently and can reopen it',()=>{const a=getAdvice();const result=render(<AdvicePage advice={a} onBack={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Save for later'}));expect(screen.getByRole('button',{name:'Saved for later'})).toBeTruthy();expect(JSON.parse(localStorage.getItem('maya-saved-advice-v1')!).length).toBe(1);result.unmount();render(<AdvicePage advice={a} onBack={()=>{}}/>);expect(screen.getByRole('button',{name:'Saved for later'})).toBeTruthy();});
 it('shows a recovery state for an invalid link',()=>{render(<AdvicePage advice={null} onBack={()=>{}}/>);expect(screen.getByRole('heading',{name:'We couldn’t open this answer.'})).toBeTruthy();});
});
