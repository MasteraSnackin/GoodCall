import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import App from '../src/App';
import AdvicePage from '../src/components/AdvicePage';
import {createWorkspace} from '../src/lib/seed';
import {draftAnswer,toPublishedAdvice} from '../src/lib/engine';
import {decodeAdvice,encodeAdvice} from '../src/lib/share';
import {readSavedAdvice,readDecisionContext,saveAdvice,saveDecisionContext,SAVED_ADVICE_KEY,DECISION_CONTEXT_KEY} from '../src/lib/savedAdvice';
import {affectedAnswers,updateIssueWithReview} from '../src/lib/issueImpact';
import {feedbackAdviceVersion} from '../src/lib/feedback';
vi.mock('../src/components/AnswerCanvas',()=>({default:()=> <div>Canvas</div>}));
function fixture(){const workspace=createWorkspace();const draft={...draftAnswer(workspace.questions.find(q=>q.id==='q-04')!,workspace.products),status:'published' as const,approvedAt:'2026-09-20T12:00:00Z',publishedAt:'2026-09-20T12:00:00Z'};workspace.drafts=[draft];return {workspace,draft,advice:toPublishedAdvice(draft,workspace)};}

describe('complete follower journey',()=>{
 it('routes from creator through finder, saving context, returning and private sharing',async()=>{
  const {workspace,advice}=fixture();localStorage.setItem('maya-answer-canvas-v1',JSON.stringify(workspace));const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
  render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Maya’s advice'}));await screen.findByRole('heading',{name:'Maya’s advice.'});
  fireEvent.change(screen.getByLabelText(/What would you like to achieve/),{target:{value:'Cloud Cream'}});fireEvent.change(screen.getByLabelText(/Your spending limit/),{target:{value:'30'}});fireEvent.change(screen.getByLabelText(/What do you already own/),{target:{value:'Cloud Cream'}});fireEvent.click(screen.getByRole('button',{name:'Find published answers'}));
  expect(screen.getByText(/Above your £30 limit/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:`Read ${advice.title}`}));await screen.findByRole('button',{name:'Save for later'});
  expect((screen.getByLabelText('My budget') as HTMLInputElement).value).toBe('30');fireEvent.change(screen.getByLabelText('Why I’m saving this'),{target:{value:'PRIVATE reminder about my own shelf'}});fireEvent.click(screen.getByRole('button',{name:'Save for later'}));
  expect(readSavedAdvice().items).toHaveLength(1);expect(readDecisionContext(advice).context?.budget).toBe('30');
  fireEvent.click(screen.getByRole('button',{name:'Share this answer'}));await waitFor(()=>expect(writeText).toHaveBeenCalledTimes(1));const token=writeText.mock.calls[0][0].split('#/advice/')[1];expect(JSON.stringify(decodeAdvice(token))).not.toContain('PRIVATE');
  fireEvent.click(screen.getByRole('button',{name:'Maya’s advice'}));await screen.findByRole('heading',{name:'Maya’s advice.'});expect(screen.getByText('PRIVATE reminder about my own shelf')).toBeTruthy();
 });
 it('consumes finder context once so browser-history returns use newer saved notes',async()=>{
  const {workspace,advice}=fixture();localStorage.setItem('maya-answer-canvas-v1',JSON.stringify(workspace));location.hash='/discover';render(<App/>);
  fireEvent.change(screen.getByLabelText(/What would you like to achieve/),{target:{value:'Cloud Cream'}});fireEvent.change(screen.getByLabelText(/Your spending limit/),{target:{value:'30'}});fireEvent.click(screen.getByRole('button',{name:'Find published answers'}));fireEvent.click(screen.getByRole('button',{name:`Read ${advice.title}`}));await screen.findByLabelText('My budget');const previousHash=location.hash;
  fireEvent.change(screen.getByLabelText('My budget'),{target:{value:'20'}});fireEvent.click(screen.getByRole('button',{name:'Save decision notes'}));fireEvent.click(screen.getByRole('button',{name:'Maya’s advice'}));await screen.findByRole('heading',{name:'Maya’s advice.'});location.hash=previousHash;fireEvent(window,new Event('hashchange'));await screen.findByLabelText('My budget');expect((screen.getByLabelText('My budget') as HTMLInputElement).value).toBe('20');
 });
 it('does not expose oversized imported published cards and reports damaged saved context',()=>{
  const {workspace,advice}=fixture();workspace.drafts[0].text='雲'.repeat(5500);localStorage.setItem('maya-answer-canvas-v1',JSON.stringify(workspace));saveAdvice(advice);localStorage.setItem(DECISION_CONTEXT_KEY,'broken');location.hash='/discover';render(<App/>);expect(screen.getByRole('button',{name:'Find published answers'}).hasAttribute('disabled')).toBe(true);expect(screen.getByRole('alert').textContent).toContain('decision notes could not be read');
 });
 it('never exposes unapproved or stale advice in discovery',async()=>{
  const {workspace}=fixture();workspace.products.find(p=>p.id==='cloud-cream')!.revision++;localStorage.setItem('maya-answer-canvas-v1',JSON.stringify(workspace));location.hash='/discover';render(<App/>);expect(screen.getByRole('button',{name:'Find published answers'}).hasAttribute('disabled')).toBe(true);
 });
 it('a copied answer keeps original wording, warns about updates and provides own-context route',()=>{
  const {advice}=fixture();const latest={...advice,text:'Revised reviewed wording.',publishedAt:'2026-09-20T13:00:00Z'};const onOpen=vi.fn(),check=vi.fn();render(<AdvicePage advice={advice} catalogue={[latest]} onBack={()=>{}} onOpenAdvice={onOpen} onCheckSituation={check}/>);
  expect(screen.getByText('A newer reviewed version is available on this device.')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Read the latest version'}));expect(onOpen).toHaveBeenCalledWith(latest);fireEvent.click(screen.getByRole('button',{name:'Check for my situation'}));expect(check).toHaveBeenCalledOnce();
 });
});

describe('saved decisions and evidence impact boundaries',()=>{
 it('preserves malformed stores and reports quota failures',()=>{
  const {advice}=fixture();localStorage.setItem(SAVED_ADVICE_KEY,'broken');expect(saveAdvice(advice).ok).toBe(false);expect(localStorage.getItem(SAVED_ADVICE_KEY)).toBe('broken');localStorage.removeItem(SAVED_ADVICE_KEY);
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('full');});expect(saveAdvice(advice).ok).toBe(false);expect(saveDecisionContext(advice,{goal:'x',budget:'0',owned:'',note:''}).ok).toBe(false);
 });
 it('strips legacy private extras and separates context by version',()=>{
  const {advice}=fixture();localStorage.setItem(SAVED_ADVICE_KEY,JSON.stringify([{...advice,privateInbox:'hidden',sourceRefs:advice.sourceRefs.map(s=>({...s,secret:'hidden'}))}]));expect(JSON.stringify(readSavedAdvice().items)).not.toContain('hidden');
  expect(saveDecisionContext(advice,{goal:'Cloud Cream',budget:'0',owned:'',note:'Private'}).ok).toBe(true);expect(readDecisionContext({...advice,text:'Different'}).context).toBeUndefined();expect(encodeAdvice(advice)).not.toContain('Private');expect(localStorage.getItem(DECISION_CONTEXT_KEY)).toContain('Private');
 });
 it('rejects a collection write above the readable size without damaging existing copies',()=>{
  const {advice}=fixture();const large={...advice,text:'x'.repeat(6000),products:Array.from({length:15},(_,i)=>({name:'Product '+i,price:10,note:'x'.repeat(1000)})),sourceRefs:Array.from({length:20},(_,i)=>({page:1,label:'Source '+i,excerpt:'x'.repeat(2000)}))};const entries=[];while(JSON.stringify([...entries,{...large,id:'card-'+entries.length}]).length<=3_000_000)entries.push({...large,id:'card-'+entries.length});const raw=JSON.stringify(entries);localStorage.setItem(SAVED_ADVICE_KEY,raw);expect(readSavedAdvice().items.length).toBe(entries.length);expect(saveAdvice({...large,id:'extra'}).ok).toBe(false);expect(localStorage.getItem(SAVED_ADVICE_KEY)).toBe(raw);expect(readSavedAdvice().error).toBeUndefined();
 });
 it('preserves all existing private notes when the context store is full',()=>{
  const {advice}=fixture();const context={goal:'Cloud Cream',budget:'0',owned:'',note:'Keep'};for(let i=0;i<100;i++)expect(saveDecisionContext({...advice,id:'context-'+i},context).ok).toBe(true);expect(saveDecisionContext({...advice,id:'context-100'},context).ok).toBe(false);expect(readDecisionContext({...advice,id:'context-0'}).context?.note).toBe('Keep');expect(saveDecisionContext({...advice,id:'context-0'},{...context,note:'Updated'}).ok).toBe(true);
 });
 it('returns only affected answers to review on resolution, keeping text and saved copies',()=>{
  const {workspace,draft,advice}=fixture();const other={...draft,id:'other',questionId:'q-05',productIds:['night-serum'],sourceRefs:[]};workspace.drafts.push(other);const issue=workspace.issues.find(i=>i.id==='issue-alice')!;saveAdvice(advice);
  expect(affectedAnswers(issue,workspace).map(d=>d.id)).toEqual([draft.id]);const next=updateIssueWithReview(workspace,issue.id,{status:'Resolved',resolution:'Confirmed order identity',resolutionSource:'Case organiser'},'2026-09-20T14:00:00Z');expect(next.drafts[0].status).toBe('draft');expect(next.drafts[0].publishedAt).toBeUndefined();expect(next.drafts[0].text).toBe(draft.text);expect(next.drafts[1].status).toBe('published');expect(feedbackAdviceVersion(readSavedAdvice().items[0])).toBe(feedbackAdviceVersion(advice));
  expect(updateIssueWithReview(workspace,issue.id,{status:'Checking'}).drafts[0].status).toBe('published');expect(affectedAnswers(workspace.issues.find(i=>i.id==='issue-pitch')!,workspace)).toEqual([]);
 });
});
