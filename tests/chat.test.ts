import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../src/lib/seed';
import { respondToChat, type ChatMessage } from '../src/lib/chat';
import { draftAnswer } from '../src/lib/engine';
import { validChatMessage } from '../src/lib/chatStorage';

const assistant=(reply:ReturnType<typeof respondToChat>):ChatMessage=>({id:'reply',role:'assistant',createdAt:'2026-09-20T12:00:00Z',...reply});

test('chat explains its local scope and has no hidden external actions',()=>{
  const w=createWorkspace(),before=JSON.stringify(w);
  assert.match(respondToChat('Hello',w,[]).text,/local rules/);
  const r=respondToChat('Can you publish this answer?',w,[]);
  assert.equal(r.kind,'help');assert.match(r.text,/does not change/);assert.equal(JSON.stringify(w),before);
});
test('known product replies use current prices, Maya notes and source evidence',()=>{
  const r=respondToChat('Is Cloud Cream worth £38?',createWorkspace(),[]);
  assert.equal(r.kind,'answer');assert.match(r.text,/£38/);assert.match(r.text,/winter skin saviour/);assert.match(r.text,/Maya still reviews/);
  assert.ok(r.sourceRefs?.some(s=>s.page===8));assert.ok(r.sourceRefs?.every(s=>s.page>0&&!s.label.startsWith('E-01.')));
});
test('a follow-up budget preserves the product and previously stated constraints',()=>{
  const w=createWorkspace(),first=respondToChat('I have dry skin. Is Cloud Cream worth £38?',w,[]);
  const next=respondToChat('My budget is £30',w,[assistant(first)]);
  assert.equal(next.kind,'clarification');assert.match(next.questionText!,/Cloud Cream/);assert.match(next.questionText!,/dry skin/);assert.match(next.text,/above.*(?:budget|limit)|£30 budget/);
});
test('a context-free follow-up asks for the product rather than guessing',()=>{
  const r=respondToChat('My budget is £30',createWorkspace(),[]);
  assert.equal(r.kind,'clarification');assert.match(r.text,/Which product/);assert.equal(r.questionText,undefined);
});
test('changed budgets and conflicting skin preferences need a fresh explicit question',()=>{
  const w=createWorkspace(),first=respondToChat('I have dry skin. Cloud Cream, my budget is £30.',w,[]);
  for(const update of ['Actually my budget is £60','My skin is oily']) {
    const next=respondToChat(update,w,[assistant(first)]);
    assert.equal(next.kind,'clarification');assert.match(next.text,/restate the product/);assert.equal(next.questionText,undefined);
  }
  const clarified=respondToChat('Cloud Cream, my budget is £60.',w,[]);
  assert.equal(clarified.kind,'answer');
});
test('a standalone new product question cannot copy old private context',()=>{
  const w=createWorkspace(),first=respondToChat('Is Cloud Cream worth £38? Private reference SECRET-CASE-123.',w,[]);
  const next=respondToChat('Tell me about Glass Drop.',w,[assistant(first)]);
  assert.equal(next.kind,'answer');assert.match(next.text,/Glass Drop/);assert.doesNotMatch(JSON.stringify(next),/SECRET-CASE-123|Cloud Cream/);
});
test('a simple alternative-product follow-up carries explicit constraints but not the old narrative',()=>{
  const w=createWorkspace(),first=respondToChat('Cloud Cream: my budget is £30. Private reference SECRET-CASE-123.',w,[]);
  const next=respondToChat('What about Daily Gel?',w,[assistant(first)]);
  assert.match(next.questionText!,/Daily Gel/);assert.match(next.questionText!,/budget is £30/);assert.doesNotMatch(JSON.stringify(next),/Cloud Cream|SECRET-CASE-123/);
  assert.equal(next.kind,'answer');assert.match(next.text,/£24/);
});
test('unknown questions do not inherit old question context',()=>{
  const w=createWorkspace(),first=respondToChat('Is Cloud Cream worth £38? SECRET-CASE-123.',w,[]);
  const unknown=respondToChat('What is the weather in Tokyo?',w,[assistant(first)]);
  assert.equal(unknown.kind,'help');assert.doesNotMatch(JSON.stringify(unknown),/SECRET-CASE-123|Cloud Cream/);
  assert.equal(respondToChat('My budget is £30',w,[assistant(first),assistant(unknown)]).questionText,undefined);
});
test('missing evidence summary is sourced and reports existing findings',()=>{
  const w=createWorkspace(),before=JSON.stringify(w),r=respondToChat('What is missing?',w,[]);
  assert.equal(r.kind,'answer');assert.match(r.text,/10 open or checking/);assert.match(r.text,/Barrier Cream/);assert.match(r.text,/not a general document audit/);assert.ok(r.sourceRefs?.length);assert.equal(r.questionText,undefined);assert.equal(JSON.stringify(w),before);
});
test('missing products and compatibility stay in clarification, never approved',()=>{
  for(const input of ['Do I need Barrier Cream?','Can I use Cloud Cream with tretinoin?']) {
    const r=respondToChat(input,createWorkspace(),[]);assert.equal(r.kind,'clarification');assert.match(r.text,/no answer has been approved/);
  }
});
test('selected issue and note explain the selected evidence only',()=>{
  const w=createWorkspace(),issue=w.cards.find(c=>c.kind==='issue')!,note=w.cards.find(c=>c.kind==='note')!;
  assert.match(respondToChat('Explain the selected card',w,[],issue).text,/Barrier Cream/);
  assert.match(respondToChat('Explain this card',w,[],note).text,/recommendation notes/);
  assert.equal(respondToChat('Explain the selected card',w,[]).kind,'clarification');
});
test('a resolved selected issue explains the recorded resolution as well as the historical finding',()=>{
  const w=createWorkspace(),card=w.cards.find(c=>c.kind==='issue')!,issue=w.issues.find(i=>i.id===card.entityId)!;
  issue.status='Resolved';issue.resolution='The organiser clarified which missing record was intended.';
  const r=respondToChat('Explain the selected issue',w,[],card);
  assert.match(r.text,/Historical finding/);assert.match(r.text,/Resolution recorded: The organiser clarified/);assert.doesNotMatch(r.text,/Next step:/);
});
test('combined follow-up context is bounded without truncating or making an answer',()=>{
  const w=createWorkspace(),previous=assistant({kind:'answer',text:'Prior reply.',questionText:`Cloud Cream. ${'context '.repeat(245)}`});
  const r=respondToChat('My budget is £60 and I prefer a rich finish.',w,[previous]);
  assert.equal(r.kind,'clarification');assert.match(r.text,/combined question/);assert.equal(r.questionText,undefined);
});
test('approach replies are linked to the documented persona evidence',()=>{
  const r=respondToChat('What is your approach?',createWorkspace(),[]);
  assert.equal(r.kind,'answer');assert.match(r.text,/what you already use/);assert.ok(r.sourceRefs?.some(s=>s.page===6));
});
test('chat reads revised product evidence without changing workspace or leaking private references',()=>{
  const w=createWorkspace();w.products[0]={...w.products[0],price:39.5,note:'Current note.',revision:2,source:{page:0,label:'Private correction',excerpt:'SECRET-SOURCE-123'}};
  const before=JSON.stringify(w),r=respondToChat('Tell me about Cloud Cream.',w,[]);
  assert.match(r.text,/£39.50/);assert.match(r.text,/Current note/);assert.doesNotMatch(JSON.stringify(r),/SECRET-SOURCE-123/);assert.equal(JSON.stringify(w),before);
});
test('a conflicting current selection needs clarification before using old chat context',()=>{
  const w=createWorkspace(),first=respondToChat('Is Cloud Cream worth £38?',w,[]);
  const r=respondToChat('My budget is £30',w,[assistant(first)],{id:'daily-card',kind:'product',entityId:'daily-gel',x:0,y:0});
  assert.equal(r.kind,'clarification');assert.match(r.text,/different products/);assert.equal(r.questionText,undefined);
  const selected=respondToChat('Daily Gel with my budget of £30.',w,[assistant(first)],{id:'daily-card',kind:'product',entityId:'daily-gel',x:0,y:0});
  assert.equal(selected.kind,'answer');assert.match(selected.text,/£24/);
});
test('a valid-size draft with many errors yields a bounded, persistable summary',()=>{
  const w=createWorkspace(),d=draftAnswer(w.questions[3],w.products);
  d.text='Cloud Cream costs '+Array.from({length:250},(_,i)=>`£${i+100}`).join(' ');assert.ok(d.text.length<5500);w.drafts=[d];
  const r=respondToChat('Explain selected card',w,[],{id:'draft-card',kind:'draft',entityId:d.id,x:0,y:0});
  assert.equal(r.kind,'clarification');assert.match(r.text,/further findings require review/);assert.match(r.text,/full validation list/);assert.ok(r.text.length<=8000);assert.ok(validChatMessage(assistant(r)));
});
test('large selected details and source lists stay within the chat storage contract',()=>{
  const w=createWorkspace(),issue=w.issues[0];issue.description='Long recorded finding. '.repeat(450);issue.sourceRefs=Array.from({length:25},(_,i)=>({page:1,label:`Extra source ${i}`,excerpt:'Source detail.'}));
  const r=respondToChat('Explain selected issue',w,[],{id:'issue-card',kind:'issue',entityId:issue.id,x:0,y:0});
  assert.ok(r.text.length<=8000);assert.ok((r.sourceRefs?.length??0)<=20);assert.match(r.text,/more detail than the chat/);assert.match(r.text,/Additional supporting references/);assert.ok(validChatMessage(assistant(r)));
});
