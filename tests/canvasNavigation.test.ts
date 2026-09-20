import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace} from '../src/lib/seed';
import {draftAnswer} from '../src/lib/engine';
import {canvasCardLabel,searchCanvasCards,relatedCanvasCardIds} from '../src/lib/canvasNavigation';
test('board search finds question content, product names and decision details without changing the workspace',()=>{
 const w=createWorkspace();const q=w.questions.find(q=>q.id==='q-04')!;const d=draftAnswer(q,w.products);w.drafts.push(d);w.cards.push({id:'answer-one',kind:'draft',entityId:d.id,x:800,y:0});const before=JSON.stringify(w);
 assert.ok(searchCanvasCards(w,'SARAH').some(c=>c.entityId===q.id));assert.ok(searchCanvasCards(w,'cloud cream').some(c=>c.entityId==='cloud-cream'));assert.ok(searchCanvasCards(w,'current moisturiser').some(c=>c.id==='answer-one'));assert.deepEqual(searchCanvasCards(w,'unfindable zebra'),[]);assert.equal(JSON.stringify(w),before);
});
test('related view follows a question to its answer and evidence without spilling into another answer through a shared note',()=>{
 const w=createWorkspace();w.cards=[{id:'q1',kind:'question',entityId:'q-04',x:0,y:0},{id:'q2',kind:'question',entityId:'q-05',x:0,y:1},{id:'d1',kind:'draft',entityId:'d1',x:1,y:0},{id:'d2',kind:'draft',entityId:'d2',x:1,y:1},{id:'note',kind:'note',entityId:'maya-judgement',x:2,y:0},{id:'product',kind:'product',entityId:'cloud-cream',x:3,y:0}];w.links=[{id:'1',source:'q1',target:'d1'},{id:'2',source:'q2',target:'d2'},{id:'3',source:'note',target:'d1'},{id:'4',source:'note',target:'d2'},{id:'5',source:'product',target:'d1'}];
 const before=JSON.stringify(w);assert.deepEqual([...relatedCanvasCardIds(w,'q1')].sort(),['d1','note','product','q1']);assert.deepEqual([...relatedCanvasCardIds(w,'d1')].sort(),['d1','note','product','q1']);assert.equal(JSON.stringify(w),before);assert.equal(relatedCanvasCardIds(w,null).size,0);assert.equal(relatedCanvasCardIds(w,'removed').size,0);
});
test('an unconnected issue stays visible on its own and search ignores unplaced records',()=>{const w=createWorkspace();const issue=w.cards.find(c=>c.kind==='issue')!;w.links=[];assert.deepEqual([...relatedCanvasCardIds(w,issue.id)],[issue.id]);assert.ok(canvasCardLabel(issue,w));w.cards=w.cards.filter(c=>c.entityId!=='night-serum');assert.equal(searchCanvasCards(w,'Night Serum').some(c=>c.kind==='product'&&c.entityId==='night-serum'),false);});
