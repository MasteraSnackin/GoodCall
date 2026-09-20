import {beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {FEEDBACK_STORAGE_KEY,feedbackAdviceVersion,feedbackFollowupQuestion,readFeedback,saveFollowerFeedback,setFeedbackHandoff,validFeedback} from '../src/lib/feedback';
import type {PublishedAdvice} from '../src/lib/types';
import {createWorkspace} from '../src/lib/seed';
import {draftAnswer,groupQuestion,detectQuestionProducts} from '../src/lib/engine';
const values=new Map<string,string>();
let failWrite=false;
beforeEach(()=>{values.clear();failWrite=false;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(failWrite)throw new Error('quota');values.set(key,value);}}});});
const advice=():PublishedAdvice=>({version:1,demo:true,id:'answer-cloud',title:'A rich cream for dry skin',text:'Cloud Cream costs £38.',products:[{name:'Cloud Cream',price:38,note:'Rich moisturiser for dry skin'}],sourceRefs:[{page:4,label:'Catalogue',excerpt:'Cloud Cream £38'}],publishedAt:'2026-09-20T10:00:00.000Z'});

test('feedback survives reload with advice snapshot identity and no raw answer or source copy',()=>{
 const card=advice(),before=JSON.stringify(card);const saved=saveFollowerFeedback(card,'too-expensive','My budget is £25.');assert.equal(saved.ok,true);
 const stored=readFeedback().items;assert.equal(stored.length,1);assert.equal(stored[0].adviceVersion,feedbackAdviceVersion(card));assert.deepEqual(stored[0].products,[{name:'Cloud Cream',price:38}]);assert.equal(stored[0].clarification,'My budget is £25.');assert.equal(validFeedback(stored[0]),true);
 assert.equal('sourceRefs' in stored[0],false);assert.equal('text' in stored[0],false);assert.equal(JSON.stringify(card),before);
});
test('one response per snapshot is idempotent; changed advice has a separate version',()=>{
 const card=advice();const first=saveFollowerFeedback(card,'helped','');assert.ok(first.ok);const repeated=saveFollowerFeedback(card,'still-unsure','What about finish?');assert.ok(repeated.ok);assert.equal(repeated.alreadySaved,true);assert.equal(repeated.item.id,first.item.id);
 const revised=saveFollowerFeedback({...card,text:'Cloud Cream costs £38. It has a rich texture.'},'still-unsure','What about finish?');assert.ok(revised.ok);assert.notEqual(revised.item.adviceVersion,first.item.adviceVersion);assert.equal(readFeedback().items.length,2);
});
test('incomplete and oversized clarification cannot be stored',()=>{
 assert.equal(saveFollowerFeedback(advice(),'too-expensive',' ').ok,false);assert.equal(saveFollowerFeedback(advice(),'still-unsure','x'.repeat(1001)).ok,false);assert.equal(saveFollowerFeedback(advice(),'unknown' as never,'hello').ok,false);assert.equal(values.has(FEEDBACK_STORAGE_KEY),false);
});
test('storage failures and malformed prior data are reported without replacing the stored copy',()=>{
 failWrite=true;assert.equal(saveFollowerFeedback(advice(),'helped','').ok,false);assert.equal(readFeedback().items.length,0);
 failWrite=false;values.set(FEEDBACK_STORAGE_KEY,'{broken');assert.ok(readFeedback().error);assert.equal(saveFollowerFeedback(advice(),'helped','').ok,false);assert.equal(values.get(FEEDBACK_STORAGE_KEY),'{broken');
});
test('explicit handoff preserves reason, product and clarification; repeat claim cannot duplicate',()=>{
 const saved=saveFollowerFeedback(advice(),'already-own','I already use Glass Drop.');assert.ok(saved.ok);
 const text=feedbackFollowupQuestion(saved.item);assert.match(text,/already own something similar/);assert.match(text,/Products discussed: Cloud Cream/);assert.equal(text.includes('£38'),false);assert.match(text,/I already use Glass Drop/);
 assert.equal(setFeedbackHandoff(saved.item.id,'handoff-pending').ok,true);const repeat=setFeedbackHandoff(saved.item.id,'handoff-pending');assert.ok(repeat.ok);assert.equal(repeat.alreadySaved,true);
 const done=setFeedbackHandoff(saved.item.id,'question-added');assert.ok(done.ok);assert.ok(done.item.questionAddedAt);const repeated=setFeedbackHandoff(saved.item.id,'new');assert.ok(repeated.ok);assert.equal(repeated.item.handoff,'question-added');
});
test('failed handoff can be reset without losing feedback',()=>{
 const saved=saveFollowerFeedback(advice(),'still-unsure','Which finish does it have?');assert.ok(saved.ok);setFeedbackHandoff(saved.item.id,'handoff-pending');setFeedbackHandoff(saved.item.id,'new');assert.equal(readFeedback().items[0].handoff,'new');assert.equal(readFeedback().items[0].clarification,'Which finish does it have?');
});
test('budget follow-ups keep follower limits distinct from catalogue prices and hold unknown amounts',()=>{
 const workspace=createWorkspace();
 for(const clarification of ['£25','25 pounds','My budget is £25.','thirty pounds','I am not sure']){
  values.clear();const saved=saveFollowerFeedback(advice(),'too-expensive',clarification);assert.ok(saved.ok);const text=feedbackFollowupQuestion(saved.item);assert.ok(text.includes(clarification));
  const question={...workspace.questions[3],text,intent:groupQuestion(text),productIds:detectQuestionProducts(text,workspace.products)};const draft=draftAnswer(question,workspace.products);assert.equal(draft.decision?.verdict,'Need more context');
  if(['£25','25 pounds','My budget is £25.'].includes(clarification)){assert.match(text,/My budget is £25/);assert.match(draft.text,/above the £25 budget/);}else{assert.match(text,/My budget is not yet confirmed/);assert.match(draft.text,/spending limit is not clear/);}
 }
});
