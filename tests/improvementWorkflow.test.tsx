import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,within,waitFor} from '@testing-library/react';
import App from '../src/App';
import {createWorkspace} from '../src/lib/seed';
import {draftAnswer,toPublishedAdvice} from '../src/lib/engine';
import {publicationContactDetails} from '../src/lib/publicationPreview';
import {saveFollowerFeedback,readFeedback} from '../src/lib/feedback';
import type {Workspace} from '../src/lib/types';

vi.mock('../src/components/AnswerCanvas',()=>({default:({workspace,onSelect,onDraft}:{workspace:Workspace;onSelect:(id:string)=>void;onDraft:(id:string)=>void})=><div>{workspace.cards.map(c=><button key={c.id} onClick={()=>onSelect(c.id)}>Inspect {c.kind} {c.entityId}</button>)}<button onClick={()=>onDraft('q-04')}>Prepare answer</button></div>}));
const read=()=>JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!) as Workspace;

describe('GoodCall recovery and publication journey',()=>{
 it('compares without changing the answer, preserves edited wording and restores an earlier version for review',()=>{
  render(<App/>);fireEvent.click(screen.getByText('Prepare answer'));
  const original=read().drafts[0].text;
  fireEvent.change(screen.getByLabelText('Your answer'),{target:{value:'Cloud Cream costs £38. Keep your current moisturiser if it already does the job.'}});
  const edited=read().drafts[0].text;
  fireEvent.click(screen.getByRole('button',{name:'Regenerate from evidence'}));
  const compare=screen.getByRole('dialog',{name:'Compare before replacing'});
  expect(within(compare).getByRole('heading',{name:'Your wording'})).toBeTruthy();
  expect(within(compare).getByRole('heading',{name:'Updated suggestion'})).toBeTruthy();
  expect(read().drafts[0].text).toBe(edited);
  fireEvent.click(screen.getByRole('button',{name:'Cancel refresh'}));expect(read().drafts[0].text).toBe(edited);
  fireEvent.click(screen.getByRole('button',{name:'Regenerate from evidence'}));
  fireEvent.click(screen.getByRole('button',{name:'Use updated suggestion'}));
  expect(read().drafts[0].text).toBe(original);
  const historyIds=read().drafts[0].history!.map(r=>r.id);
  fireEvent.click(screen.getByRole('button',{name:'Regenerate from evidence'}));
  fireEvent.click(screen.getByRole('button',{name:'Keep my wording and refresh evidence'}));
  expect(read().drafts[0].history!.map(r=>r.id)).toEqual(historyIds);
  const version=read().drafts[0].history!.findIndex(r=>r.snapshot.text===edited)+1;
  const restore=screen.getByRole('button',{name:`Restore wording from version ${version}`,hidden:true});
  fireEvent.click(restore.closest('details')!.querySelector('summary')!);fireEvent.click(restore);
  expect(read().drafts[0].text).toBe(edited);expect(read().drafts[0].status).toBe('draft');
  expect(read().drafts[0].approvedAt).toBeUndefined();
 });
 it('refreshes corrected evidence while keeping custom wording and still checks stale prices',()=>{
  render(<App/>);fireEvent.click(screen.getByText('Prepare answer'));
  fireEvent.change(screen.getByLabelText('Your answer'),{target:{value:'Cloud Cream costs £38. Keep your current moisturiser if it already does the job.'}});
  const id=read().drafts[0].id;
  fireEvent.click(screen.getByRole('button',{name:'Inspect product cloud-cream'}));
  fireEvent.click(screen.getByRole('button',{name:'Correct product evidence'}));
  fireEvent.change(screen.getByLabelText('Price (£)'),{target:{value:'39.50'}});
  fireEvent.change(screen.getByLabelText('Source for this correction'),{target:{value:'Test-only current catalogue price reference'}});
  fireEvent.click(screen.getByRole('button',{name:'Save revised evidence'}));
  fireEvent.click(screen.getByRole('button',{name:`Inspect draft ${id}`}));
  fireEvent.click(screen.getByRole('button',{name:'Regenerate from evidence'}));
  fireEvent.click(screen.getByRole('button',{name:'Keep my wording and refresh evidence'}));
  expect(read().drafts[0].text).toContain('£38');expect(read().drafts[0].productRevisions['cloud-cream']).toBe(2);
  expect((screen.getByRole('button',{name:'Approve answer'}) as HTMLButtonElement).disabled).toBe(true);
 });
 it('previews exactly the public content without publishing and publishes only the confirmed version',()=>{
  render(<App/>);fireEvent.click(screen.getByText('Prepare answer'));fireEvent.click(screen.getByRole('button',{name:'Approve answer'}));
  fireEvent.click(screen.getByRole('button',{name:'Publish advice card'}));
  const preview=screen.getByRole('dialog',{name:'Preview your follower card'});
  expect(preview.querySelector('.advice-copy')?.textContent).toBe(read().drafts[0].text);
  expect(within(preview).queryByRole('button',{name:'Save for later'})).toBeNull();
  expect(read().drafts[0].status).toBe('approved');expect(localStorage.getItem('maya-saved-advice-v1')).toBeNull();
  fireEvent.click(within(preview).getByRole('button',{name:'Back to editing'}));expect(read().drafts[0].status).toBe('approved');
  fireEvent.click(screen.getByRole('button',{name:'Publish advice card'}));fireEvent.click(screen.getByRole('button',{name:'Publish this version'}));
  expect(read().drafts[0].status).toBe('published');expect(screen.getByRole('button',{name:'Share approved answer'})).toBeTruthy();
 });
 it('offers backup controls from the normal workspace navigation',()=>{
  render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Backup & restore',exact:true}));
  expect(screen.getByRole('dialog',{name:'Backup & restore'})).toBeTruthy();
 });
 it('carries follower feedback into a new question without changing the published decision',async()=>{
  const w=createWorkspace();const draft={...draftAnswer(w.questions[3],w.products),status:'published' as const};
  w.drafts=[draft];localStorage.setItem('maya-answer-canvas-v1',JSON.stringify(w));
  const advice=toPublishedAdvice(draft,w);expect(saveFollowerFeedback(advice,'too-expensive','£25').ok).toBe(true);
  render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Follower feedback',exact:true}));
  fireEvent.click(screen.getByRole('button',{name:'Add follow-up question'}));
  await waitFor(()=>expect(readFeedback().items[0].handoff).toBe('question-added'));
  expect(read().questions).toHaveLength(w.questions.length+1);
  expect(read().questions[0].text).toContain('£25');
  expect(read().questions[0].source.label).toContain('Follower feedback');
  expect(read().drafts[0]).toEqual(draft);
  fireEvent.click(screen.getByRole('button',{name:'Follower feedback',exact:true}));
  expect(screen.queryByRole('button',{name:'Add follow-up question'})).toBeNull();
 });
 it('keeps feedback available for retry if the audience question cannot be persisted',async()=>{
  const w=createWorkspace();localStorage.setItem('maya-answer-canvas-v1',JSON.stringify(w));
  const advice=toPublishedAdvice({...draftAnswer(w.questions[3],w.products),status:'approved'},w);
  saveFollowerFeedback(advice,'too-expensive','£25');render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:'Follower feedback',exact:true}));
  const original=Storage.prototype.setItem;
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(key,value){if(key==='maya-answer-canvas-v1')throw new Error('Workspace quota');original.call(this,key,value);});
  fireEvent.click(screen.getByRole('button',{name:'Add follow-up question'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('could not be added'));
  expect(readFeedback().items[0].handoff).toBe('new');expect(read().questions).toHaveLength(w.questions.length);
  expect((screen.getByRole('button',{name:'Add follow-up question'}) as HTMLButtonElement).disabled).toBe(false);
 });
 it('removes obsolete issue cards and their connections so refreshed reports still save',()=>{
  const w=createWorkspace();w.cards.push({id:'alice-test-card',kind:'issue',entityId:'issue-alice',x:800,y:800});
  w.links.push({id:'alice-test-link',source:'card-cloud-cream',target:'alice-test-card'});
  localStorage.setItem('maya-answer-canvas-v1',JSON.stringify(w));render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:'Inspect product cloud-cream'}));fireEvent.click(screen.getByRole('button',{name:'Correct product evidence'}));
  fireEvent.change(screen.getByLabelText('Price (£)'),{target:{value:'68'}});
  fireEvent.change(screen.getByLabelText('Source for this correction'),{target:{value:'Test-only organiser product price correction'}});
  fireEvent.click(screen.getByRole('button',{name:'Save revised evidence'}));
  fireEvent.click(screen.getByRole('button',{name:'Evidence & issues',exact:true}));
  fireEvent.click(screen.getByRole('button',{name:'Run checks'}));
  expect(read().issues.some(i=>i.id==='issue-alice')).toBe(false);
  expect(read().cards.some(c=>c.id==='alice-test-card')).toBe(false);
  expect(read().links.some(l=>l.id==='alice-test-link')).toBe(false);
  expect(screen.getByText('Saved on this device')).toBeTruthy();
 });
 it('highlights likely public contact details without mistaking product prices for phone numbers',()=>{
  const w=createWorkspace();const advice=toPublishedAdvice({...draftAnswer(w.questions[3],w.products),status:'approved'},w);
  expect(publicationContactDetails(advice)).toEqual([]);
  expect(publicationContactDetails({...advice,text:'Reply to example@example.invalid or 07123 456789.'})).toEqual(['example@example.invalid','07123 456789']);
 });
});
