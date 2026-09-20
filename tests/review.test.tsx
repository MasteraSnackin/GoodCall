import React from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import App from '../src/App';
import AdvicePage from '../src/components/AdvicePage';
import {createWorkspace} from '../src/lib/seed';
import {draftAnswer,toPublishedAdvice} from '../src/lib/engine';
import {decodeAdvice} from '../src/lib/share';
import type {Workspace} from '../src/lib/types';

// These simulate controls and application state; they do not exercise browser layout or real graph dragging.
vi.mock('../src/components/AnswerCanvas',()=>({default:({workspace,onSelect,onDraft}:{workspace:Workspace;onSelect:(id:string)=>void;onDraft:(id:string)=>void})=><div>{workspace.cards.map(c=><button key={c.id} onClick={()=>onSelect(c.id)}>Inspect {c.kind} {c.entityId}</button>)}<button onClick={()=>onDraft('q-04')}>Draft sample</button></div>}));
afterEach(()=>vi.unstubAllGlobals());
function advice(){const w=createWorkspace();return toPublishedAdvice({...draftAnswer(w.questions[3],w.products),status:'published'},w);}

describe('Additional review scenarios',()=>{
 it('requires re-review after correcting a product and publishes the precise updated price without private provenance',()=>{
  render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Draft sample'}));fireEvent.click(screen.getByRole('button',{name:'Approve answer'}));
  fireEvent.click(screen.getByRole('button',{name:'Inspect product cloud-cream'}));fireEvent.click(screen.getByRole('button',{name:'Correct product evidence'}));
  fireEvent.change(screen.getByLabelText('Price (£)'),{target:{value:'39.50'}});
  fireEvent.change(screen.getByLabelText('Source for this correction'),{target:{value:'Private-reference-only-908: organiser price clarification'}});
  fireEvent.click(screen.getByRole('button',{name:'Save revised evidence'}));
  let w=JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!);const id=w.drafts[0].id;expect(w.drafts[0].status).toBe('draft');
  fireEvent.click(screen.getByRole('button',{name:`Inspect draft ${id}`}));expect((screen.getByRole('button',{name:'Approve answer'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Regenerate from evidence'}));fireEvent.click(screen.getByRole('button',{name:'Use updated suggestion'}));expect((screen.getByRole('textbox',{name:'Your answer'}) as HTMLTextAreaElement).value).toContain('£39.50');
  fireEvent.click(screen.getByRole('button',{name:'Approve answer'}));fireEvent.click(screen.getByRole('button',{name:'Publish advice card'}));fireEvent.click(screen.getByRole('button',{name:'Publish this version'}));fireEvent.click(screen.getByRole('button',{name:'Share approved answer'}));
  const link=(screen.getByRole('textbox',{name:'Share link'}) as HTMLInputElement).value;const payload=decodeAdvice(link.split('#/advice/')[1]);expect(payload!.products[0].price).toBe(39.5);expect(JSON.stringify(payload)).not.toContain('Private-reference-only-908');
 });
 it('keeps revised publications distinct from the saved older copy and replaces that copy when saved',()=>{
  const first=advice();let view=render(<AdvicePage advice={first} onBack={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Save for later'}));view.unmount();
  const revised={...first,title:'Updated advice',text:'A revised answer.',publishedAt:'2030-01-01T12:00:00Z'};view=render(<AdvicePage advice={revised} onBack={()=>{}}/>);
  expect(screen.getByRole('button',{name:'Save for later'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Save for later'}));
  const saved=JSON.parse(localStorage.getItem('maya-saved-advice-v1')!);expect(saved).toHaveLength(1);expect(saved[0].text).toBe(revised.text);expect(screen.getByRole('button',{name:'Saved for later'})).toBeTruthy();
 });
 it('displays pence without rounding the follower price',()=>{
  const a=advice();a.products[0].price=39.5;render(<AdvicePage advice={a} onBack={()=>{}}/>);expect(screen.getByText('£39.50')).toBeTruthy();
 });
 it('reports failed storage without falsely claiming the advice was saved',()=>{
  render(<AdvicePage advice={advice()} onBack={()=>{}}/>);vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Storage full','QuotaExceededError');});
  fireEvent.click(screen.getByRole('button',{name:'Save for later'}));expect(screen.getByRole('alert').textContent).toContain('could not save');expect(screen.getByRole('button',{name:'Save for later'})).toBeTruthy();
 });
 it('offers a selectable link when clipboard permission is unavailable',async()=>{
  vi.stubGlobal('navigator',{clipboard:{writeText:vi.fn().mockRejectedValue(new Error('Permission unavailable'))}});render(<AdvicePage advice={advice()} onBack={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Share this answer'}));await waitFor(()=>expect(screen.getByRole('textbox',{name:'Copy this link'})).toBeTruthy());
  const link=(screen.getByRole('textbox',{name:'Copy this link'}) as HTMLInputElement).value;expect(decodeAdvice(link.split('#/advice/')[1])).not.toBeNull();expect(screen.queryByText('Link copied')).toBeNull();
 });
});
