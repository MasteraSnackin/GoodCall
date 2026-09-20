import {describe,it,expect,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import AdvicePage from '../src/components/AdvicePage';
import FollowerFeedback,{FollowerFeedbackInbox} from '../src/components/FollowerFeedback';
import {FEEDBACK_STORAGE_KEY,readFeedback,saveFollowerFeedback,setFeedbackHandoff} from '../src/lib/feedback';
import type {PublishedAdvice} from '../src/lib/types';
const advice=():PublishedAdvice=>({version:1,demo:true,id:'answer-cloud',title:'A rich cream for dry skin',text:'Cloud Cream costs £38.',products:[{name:'Cloud Cream',price:38,note:'Rich moisturiser for dry skin'}],sourceRefs:[{page:4,label:'Catalogue',excerpt:'Cloud Cream £38'}],publishedAt:'2026-09-20T10:00:00.000Z',decision:{verdict:'Consider',suits:'Dry skin and a rich finish preference.',skipIf:'You do not want a rich texture.',unknowns:'Your current routine.'}});

describe('local follower feedback',()=>{
 it('asks one tailored question, saves explicitly, and reloads the saved response',()=>{
  const card=advice();const view=render(<FollowerFeedback advice={card}/>);fireEvent.click(screen.getByRole('button',{name:'Too expensive'}));
  const input=screen.getByLabelText('What is your budget for this?');fireEvent.change(input,{target:{value:'My budget is £25.'}});expect(localStorage.getItem(FEEDBACK_STORAGE_KEY)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Save feedback'}));expect(readFeedback().items[0].clarification).toBe('My budget is £25.');
  view.unmount();render(<FollowerFeedback advice={card}/>);expect(screen.getByText('Feedback saved on this device')).toBeTruthy();expect(screen.queryByRole('button',{name:'Save feedback'})).toBeNull();
 });
 it('preserves wording and reports a save error honestly',()=>{
  render(<FollowerFeedback advice={advice()}/>);fireEvent.click(screen.getByRole('button',{name:'Still unsure'}));const input=screen.getByLabelText('What is the one thing you still need to decide?');fireEvent.change(input,{target:{value:'Can I use it under makeup?'}});
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});fireEvent.click(screen.getByRole('button',{name:'Save feedback'}));expect(screen.getByRole('alert').textContent).toContain('could not be saved');expect((input as HTMLTextAreaElement).value).toBe('Can I use it under makeup?');expect(screen.queryByText('Feedback saved on this device')).toBeNull();
 });
 it('hands edited context to the creator once and persists completion across reload',async()=>{
  saveFollowerFeedback(advice(),'already-own','I already use Glass Drop.');const add=vi.fn();const view=render(<FollowerFeedbackInbox onAddQuestion={add}/>);const input=screen.getByLabelText('Follow-up question');expect((input as HTMLTextAreaElement).value).toContain('Products discussed: Cloud Cream');expect(screen.getByText('Cloud Cream (£38)')).toBeTruthy();expect((input as HTMLTextAreaElement).value).toContain('I already own something similar');fireEvent.change(input,{target:{value:`${(input as HTMLTextAreaElement).value}\nPlease compare textures.`}});
  fireEvent.click(screen.getByRole('button',{name:'Add follow-up question'}));await waitFor(()=>expect(screen.getByText('Follow-up question added.')).toBeTruthy());expect(add).toHaveBeenCalledTimes(1);expect(add.mock.calls[0][0]).toContain('Please compare textures.');expect(readFeedback().items[0].handoff).toBe('question-added');view.unmount();render(<FollowerFeedbackInbox onAddQuestion={add}/>);expect(screen.queryByRole('button',{name:'Add follow-up question'})).toBeNull();expect(add).toHaveBeenCalledTimes(1);
 });
 it('allows retry after callback failure and never calls the callback when local claim fails',async()=>{
  saveFollowerFeedback(advice(),'too-expensive','My budget is £25.');const add=vi.fn().mockReturnValue(false);render(<FollowerFeedbackInbox onAddQuestion={add}/>);fireEvent.click(screen.getByRole('button',{name:'Add follow-up question'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('could not be added'));expect(readFeedback().items[0].handoff).toBe('new');
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});fireEvent.click(screen.getByRole('button',{name:'Add follow-up question'}));expect(add).toHaveBeenCalledTimes(1);expect(screen.getByRole('alert').textContent).toContain('No follow-up question was added');
 });
 it('shows an interrupted handoff without repeating it automatically',()=>{
  const saved=saveFollowerFeedback(advice(),'still-unsure','Is the finish rich?');if(!saved.ok)throw new Error('fixture');setFeedbackHandoff(saved.item.id,'handoff-pending');const add=vi.fn();render(<FollowerFeedbackInbox onAddQuestion={add}/>);expect(screen.getByText(/previous handoff could not be confirmed/)).toBeTruthy();expect(screen.queryByRole('button',{name:'Add follow-up question'})).toBeNull();expect(add).not.toHaveBeenCalled();
 });
 it('requires an explicit edit when valid saved context exceeds the audience input limit',()=>{
  const card={...advice(),title:'A'.repeat(300),products:Array.from({length:15},(_,i)=>({name:`Product ${i} ${'x'.repeat(180)}`,price:10,note:'note'}))};expect(saveFollowerFeedback(card,'still-unsure','What should I choose?').ok).toBe(true);render(<FollowerFeedbackInbox onAddQuestion={vi.fn()}/>);expect(screen.getByText(/Shorten this follow-up to 2,000/)).toBeTruthy();expect((screen.getByRole('button',{name:'Add follow-up question'}) as HTMLButtonElement).disabled).toBe(true);
 });
});

describe('publication preview',()=>{
 it('renders the same public content with no storage access or mutation controls',()=>{
  const card=advice();localStorage.setItem('maya-saved-advice-v1',JSON.stringify([card]));const get=vi.spyOn(Storage.prototype,'getItem'),set=vi.spyOn(Storage.prototype,'setItem');const view=render(<AdvicePage advice={card} onBack={vi.fn()} preview/>);const previewContent=screen.getByTestId('public-advice-content').innerHTML;
  expect(screen.getByText('Preview · not published')).toBeTruthy();expect(screen.getByText('What this answer is based on')).toBeTruthy();expect(screen.queryByRole('button',{name:/Workspace|Save for later|Share this answer|That helped/i})).toBeNull();expect(screen.queryByText(/YOUR SAVED ANSWERS/)).toBeNull();expect(get).not.toHaveBeenCalled();expect(set).not.toHaveBeenCalled();view.unmount();render(<AdvicePage advice={card} onBack={vi.fn()}/>);expect(screen.getByTestId('public-advice-content').innerHTML).toBe(previewContent);
 });
 it('updates preview content from props without retaining an old answer',()=>{
  const card=advice();const view=render(<AdvicePage advice={card} onBack={vi.fn()} preview/>);view.rerender(<AdvicePage advice={{...card,title:'A revised answer',text:'Revised wording.'}} onBack={vi.fn()} preview/>);expect(screen.getByRole('heading',{name:'A revised answer'})).toBeTruthy();expect(screen.getByText('Revised wording.')).toBeTruthy();expect(screen.queryByText(card.title)).toBeNull();
 });
 it('keeps existing saved cards unchanged when feedback is submitted',()=>{
  const old={...advice(),id:'old-card',title:'An older saved answer'};delete old.decision;const saved=JSON.stringify([old]);localStorage.setItem('maya-saved-advice-v1',saved);render(<AdvicePage advice={advice()} onBack={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'That helped'}));expect(localStorage.getItem('maya-saved-advice-v1')).toBe(saved);expect(readFeedback().items).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'An older saved answer'}));expect(screen.getByRole('heading',{name:'An older saved answer'})).toBeTruthy();
 });
});
