import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace} from '../src/lib/seed';
import {draftAnswer,validateDraft,toPublishedAdvice,detectQuestionProducts,groupQuestion} from '../src/lib/engine';
import {respondToChat} from '../src/lib/chat';
import {decodeAdvice,encodeAdvice} from '../src/lib/share';

// These exercise decision contracts inspired by page 4, not observed human usability.
function scenario(text:string){
 const w=createWorkspace();const q={...w.questions[3],text,intent:groupQuestion(text),productIds:detectQuestionProducts(text,w.products)};
 w.questions=w.questions.map(old=>old.id===q.id?q:old);
 return {w,draft:draftAnswer(q,w.products)};
}
test('Emily: a budget below the product price cannot become approved advice',()=>{
 const {w,draft}=scenario('Is Cloud Cream worth buying? My budget is £30.');
 assert.ok(validateDraft(draft,w).some(message=>/budget|limit/i.test(message)));
 assert.throws(()=>toPublishedAdvice({...draft,status:'approved'},w));
});
test('Priya: sensitive-skin reassurance does not invent fragrance evidence',()=>{
 const {w,draft}=scenario('Is Red Reset fragrance-free for my sensitive skin?');
 assert.ok(validateDraft(draft,w).length>0);
 assert.throws(()=>toPublishedAdvice({...draft,status:'approved'},w));
});
test('Sophie: the recorded Glass Drop value judgement survives publication and sharing',()=>{
 const {w,draft}=scenario('Is Glass Drop worth £62?');
 assert.equal(draft.decision?.verdict,'Skip for now');
 const card=toPublishedAdvice({...draft,status:'approved'},w);
 const decoded=decodeAdvice(encodeAdvice(card));
 assert.equal(decoded?.decision?.verdict,'Skip for now');
 assert.ok(decoded?.text.includes('Not £62 good.'));
});
test('Hannah: focused advice does not add the whole product catalogue',()=>{
 const {w,draft}=scenario('Tell me about Daily Gel. I prefer a light finish.');
 const card=toPublishedAdvice({...draft,status:'approved'},w);
 assert.deepEqual(card.products.map(p=>p.name),['Daily Gel']);
 assert.ok(card.decision?.skipIf);assert.ok(card.decision?.unknowns);
});
test('Grace: a two-product routine request with missing context asks for clarification',()=>{
 const w=createWorkspace();const before=JSON.stringify(w);
 const reply=respondToChat('Can you make me a routine but only 2 products because I will not do 8 steps?',w,[]);
 assert.equal(reply.kind,'clarification');
 assert.ok(reply.questionText?.includes('only 2 products'));
 assert.equal(JSON.stringify(w),before);
});
test('Alex: a saved share snapshot retains the original reviewed decision',()=>{
 const {w,draft}=scenario('Is Cloud Cream worth £38?');
 const card=toPublishedAdvice({...draft,status:'approved'},w);
 const saved=encodeAdvice(card);
 w.products[0].price=41;w.products[0].revision++;
 const returned=decodeAdvice(saved);
 assert.deepEqual(returned?.decision,card.decision);
 assert.equal(returned?.products[0].price,38);
 assert.equal(returned?.demo,true);
});
