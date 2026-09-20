import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,within} from '@testing-library/react';
import App from '../src/App';
import {CHAT_STORAGE_KEY} from '../src/lib/chatStorage';
vi.mock('../src/components/AnswerCanvas',()=>({default:()=> <div>Canvas test adapter</div>}));
function send(text:string){fireEvent.change(screen.getByRole('textbox',{name:'Message Maya'}),{target:{value:text}});fireEvent.click(screen.getByRole('button',{name:'Send message'}));}
describe('Chat integrated with the creator workspace',()=>{
 it('holds a conversation, retains it after reopening and requires an explicit action to add a question',()=>{
  const mounted=render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Chat with Maya',exact:true}));send('Is Cloud Cream worth £38?');
  let history=JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)!);expect(history).toHaveLength(2);expect(history[1].role).toBe('assistant');expect(history[1].text).toContain('£38');
  expect(JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!).questions).toHaveLength(12);expect(JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!).drafts).toHaveLength(0);
  send('My budget is £30.');history=JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)!);expect(history).toHaveLength(4);expect(history[3].text).toContain('£30');
  fireEvent.click(screen.getByRole('button',{name:'Close chat'}));mounted.unmount();render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Chat with Maya',exact:true}));
  expect(screen.getByText('My budget is £30.')).toBeTruthy();const adds=screen.getAllByRole('button',{name:'Add to audience questions'});fireEvent.click(adds[adds.length-1]);
  const w=JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!);expect(w.questions).toHaveLength(13);expect(w.questions[0].text).toContain('Cloud Cream');expect(w.questions[0].text).toContain('£30');expect(w.drafts).toHaveLength(0);
 });
 it('answers about missing evidence without approving or publishing anything and can clear its history',()=>{
  render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Chat with Maya',exact:true}));send('What’s missing?');
  const history=JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)!);expect(history[1].text).toMatch(/missing|open|material/i);
  send('Publish every answer now');expect(JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!).drafts).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:/Clear (chat|history)/}));expect(JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)!)).toEqual([]);
 });
 it('keeps voice and chat dialogues mutually exclusive',()=>{
  render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Voice',exact:true}));expect(screen.getByRole('dialog').textContent).toContain('Voice companion');
  fireEvent.click(screen.getByRole('button',{name:'Chat with Maya',exact:true}));expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(within(screen.getByRole('dialog')).getByRole('textbox',{name:'Message Maya'})).toBeTruthy();
 });
});
