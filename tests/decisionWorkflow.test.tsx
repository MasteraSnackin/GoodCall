import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../src/App';
import AdvicePage from '../src/components/AdvicePage';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer, toPublishedAdvice } from '../src/lib/engine';
import { decodeAdvice } from '../src/lib/share';
import type { Workspace } from '../src/lib/types';
vi.mock('../src/components/AnswerCanvas',()=>({default:({workspace,onSelect,onDraft}:{workspace:Workspace;onSelect:(id:string)=>void;onDraft:(id:string)=>void})=><div>{workspace.cards.map(c=><button key={c.id} onClick={()=>onSelect(c.id)}>Choose {c.kind} {c.entityId}</button>)}<button onClick={()=>onDraft('q-04')}>Prepare Cloud decision</button></div>}));
const read=()=>JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!) as Workspace;
describe('Reusable decisions in the creator workflow',()=>{
 it('reviews decision fields with the answer and editing any field removes approval',()=>{
  render(<App/>);fireEvent.click(screen.getByText('Prepare Cloud decision'));
  expect((screen.getByRole('textbox',{name:'Who this is for'}) as HTMLTextAreaElement).value).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Approve answer'}));expect(read().drafts[0].status).toBe('approved');
  fireEvent.change(screen.getByRole('textbox',{name:'When to skip it'}),{target:{value:'Keep your existing moisturiser if it already does the job.'}});
  expect(read().drafts[0].status).toBe('draft');expect(read().drafts[0].approvedAt).toBeUndefined();
 });
 it('checks unsupported claims inside decision fields before approval',()=>{
  render(<App/>);fireEvent.click(screen.getByText('Prepare Cloud decision'));
  fireEvent.change(screen.getByRole('textbox',{name:'Who this is for'}),{target:{value:'Cloud Cream is fragrance-free and safe for everyone.'}});
  expect((screen.getByRole('button',{name:'Approve answer'}) as HTMLButtonElement).disabled).toBe(true);
 });
 it('shares decision details without publishing the original question',()=>{
  render(<App/>);fireEvent.click(screen.getByText('Prepare Cloud decision'));fireEvent.click(screen.getByRole('button',{name:'Approve answer'}));fireEvent.click(screen.getByRole('button',{name:'Publish advice card'}));fireEvent.click(screen.getByRole('button',{name:'Publish this version'}));fireEvent.click(screen.getByRole('button',{name:'Share approved answer'}));
  const link=(screen.getByRole('textbox',{name:'Share link'}) as HTMLInputElement).value;const payload=decodeAdvice(link.split('#/advice/')[1])!;
  expect(payload.decision?.suits).toBeTruthy();expect(JSON.stringify(payload)).not.toContain('@sarah');expect(JSON.stringify(payload)).not.toContain('reusedFrom');
 });
 it('offers an approved starting point but holds reuse for a lower-budget follower',()=>{
  render(<App/>);fireEvent.click(screen.getByText('Prepare Cloud decision'));fireEvent.click(screen.getByRole('button',{name:'Approve answer'}));
  const original=read().drafts[0];
  fireEvent.click(screen.getByRole('button',{name:'Add question',exact:true}));const dialog=screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(/Follower name/),{target:{value:'@second'}});fireEvent.change(within(dialog).getByLabelText('Their question'),{target:{value:'Is Cloud Cream worth the price? My budget is £30.'}});fireEvent.click(within(dialog).getByRole('button',{name:'Add question'}));
  fireEvent.click(screen.getByRole('button',{name:'Review reusable answer'}));fireEvent.click(screen.getByRole('button',{name:'Use as starting point'}));
  const w=read(),reused=w.drafts.find(d=>d.questionId!==original.questionId)!;
  expect(reused.status).toBe('draft');expect(reused.reusedFrom?.draftId).toBe(original.id);expect(reused.approvedAt).toBeUndefined();expect(w.drafts.find(d=>d.id===original.id)).toEqual(original);
  expect((screen.getByRole('button',{name:'Approve answer'}) as HTMLButtonElement).disabled).toBe(true);
 });
 it('keeps older approved answers intact until decision details are explicitly added',()=>{
  const w=createWorkspace();const draft=draftAnswer(w.questions.find(q=>q.id==='q-04')!,w.products);delete draft.decision;draft.status='approved';w.drafts=[draft];w.cards.push({id:'legacy-answer',kind:'draft',entityId:draft.id,x:800,y:35});localStorage.setItem('maya-answer-canvas-v1',JSON.stringify(w));
  render(<App/>);expect(read().drafts[0].decision).toBeUndefined();expect(read().drafts[0].status).toBe('approved');fireEvent.click(screen.getByText(`Choose draft ${draft.id}`));fireEvent.click(screen.getByRole('button',{name:'Add decision details'}));
  expect(read().drafts[0].decision).toBeTruthy();expect(read().drafts[0].status).toBe('draft');
 });
});
it('shows the approved scope and limits on the follower page',()=>{const w=createWorkspace();const draft=draftAnswer(w.questions.find(q=>q.id==='q-04')!,w.products);render(<AdvicePage advice={toPublishedAdvice({...draft,status:'published'},w)} onBack={()=>{}}/>);expect(screen.getByText('Who this is for')).toBeTruthy();expect(screen.getByText('When to skip it')).toBeTruthy();expect(screen.getByText('What still needs checking')).toBeTruthy();});
it('a revised decision can replace the saved snapshot without silently marking old guidance current',()=>{
 const w=createWorkspace();const d=draftAnswer(w.questions.find(q=>q.id==='q-04')!,w.products);const original=toPublishedAdvice({...d,status:'published'},w);
 localStorage.setItem('maya-saved-advice-v1',JSON.stringify([original]));
 const revised={...original,decision:{...original.decision!,skipIf:'Wait if you already have a moisturiser that works for you.'}};
 render(<AdvicePage advice={revised} onBack={()=>{}}/>);expect(screen.queryByRole('button',{name:'Saved for later'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Save for later'}));
 const stored=JSON.parse(localStorage.getItem('maya-saved-advice-v1')!);expect(stored).toHaveLength(1);expect(stored[0].decision.skipIf).toBe(revised.decision.skipIf);expect(original.decision?.skipIf).not.toBe(revised.decision.skipIf);
});
it('synchronises generated notebook evidence when question context adds and removes a hold',()=>{
 render(<App/>);fireEvent.click(screen.getByText('Prepare Cloud decision'));
 const changeQuestion=(text:string)=>{fireEvent.click(screen.getByText('Choose question q-04'));fireEvent.click(screen.getByRole('button',{name:'Add or correct context'}));fireEvent.change(screen.getByRole('textbox',{name:'Clarified question'}),{target:{value:text}});fireEvent.click(screen.getByRole('button',{name:'Save context and regenerate'}));};
 const routingAttached=()=>{const w=read();const note=w.cards.find(c=>c.kind==='note'&&c.entityId==='notebook-routing')!;const draft=w.cards.find(c=>c.kind==='draft'&&c.entityId===w.drafts[0].id)!;return w.links.some(l=>l.source===note.id&&l.target===draft.id);};
 expect(routingAttached()).toBe(false);changeQuestion('Is Cloud Cream worth £38 for my sensitive skin?');expect(routingAttached()).toBe(true);expect(read().drafts[0].status).toBe('draft');
 changeQuestion('Is Cloud Cream worth £38 for dry skin?');expect(routingAttached()).toBe(false);expect(read().drafts[0].sourceRefs.some(s=>s.label.includes('routing'))).toBe(false);
});
it('searches the verdict and remaining questions in the reviewed library',()=>{
 const w=createWorkspace();const q={...w.questions[3],id:'glass-value',text:'Is Glass Drop worth the price?',productIds:['glass-drop']};w.questions.push(q);const draft=draftAnswer(q,w.products);draft.status='approved';draft.decision!.unknowns='Confirm whether a lighter finish is preferred.';w.drafts=[draft];localStorage.setItem('maya-answer-canvas-v1',JSON.stringify(w));render(<App/>);
 fireEvent.click(screen.getByRole('button',{name:/Approved advice/}));const search=screen.getByRole('textbox',{name:'Search approved advice'});
 fireEvent.change(search,{target:{value:'Skip for now'}});expect(screen.getByRole('heading',{name:draft.title})).toBeTruthy();fireEvent.change(search,{target:{value:'lighter finish'}});expect(screen.getByRole('heading',{name:draft.title})).toBeTruthy();
});
