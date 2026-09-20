import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../src/lib/seed';
import { buildReport, detectQuestionProducts, draftAnswer, groupQuestion, runEvidenceChecks, toPublishedAdvice, validateDraft } from '../src/lib/engine';
import type { Question } from '../src/lib/types';

test('the complete supplied questions and catalogue are loaded',()=>{
  const w=createWorkspace(); assert.equal(w.questions.length,12); assert.equal(w.products.length,10); assert.equal(w.issues.length,10);
  assert.equal(w.products.find(p=>p.id==='glass-drop')?.price,62);
});
test('Cloud Cream value answer can pass while unrelated report issues remain open',()=>{
  const w=createWorkspace(),d=draftAnswer(w.questions[3],w.products);
  assert.deepEqual(validateDraft(d,w),[]); assert.match(d.text,/£38/); assert.match(d.text,/winter skin saviour/);
  assert.throws(()=>toPublishedAdvice(d,w),/approve/); d.status='approved'; assert.equal(toPublishedAdvice(d,w).products[0].name,'Cloud Cream');
});
test('the dry-skin and redness basket cannot silently exceed a £60 budget',()=>{
  const w=createWorkspace(),d=draftAnswer(w.questions[1],w.products);
  assert.ok(validateDraft(d,w).some(e=>e.includes('£70') && e.includes('£60')));
});
test('a report resolution cannot authorise the absent Barrier Cream',()=>{
  const w=createWorkspace(); w.issues.find(i=>i.id==='issue-barrier-cream')!.status='Resolved';
  assert.ok(validateDraft(draftAnswer(w.questions[4],w.products),w).some(e=>e.includes('Barrier Cream')));
});
test('edited answers are checked for clinical claims and undeclared products',()=>{
  const w=createWorkspace(),d=draftAnswer(w.questions[3],w.products); d.text+=' It cures eczema and is safe for pregnancy. Try Night Serum too.';
  const e=validateDraft(d,w); assert.ok(e.some(s=>s.includes('clinical claim'))); assert.ok(e.some(s=>s.includes('Night Serum')));
});
test('changed product records invalidate prior review',()=>{
  const w=createWorkspace(),d=draftAnswer(w.questions[3],w.products); w.products[0].revision++; w.products[0].price=39;
  assert.ok(validateDraft(d,w).some(e=>e.includes('changed after')));
});
test('edited product prices and quotes must agree with the current evidence',()=>{
  const w=createWorkspace(),d=draftAnswer(w.questions[3],w.products);
  d.text='Cloud Cream costs £12.'; assert.ok(validateDraft(d,w).some(e=>e.includes('£38')));
  d.text='Cloud Cream costs £0.'; assert.ok(validateDraft(d,w).some(e=>e.includes('£38')));
  d.text='Cloud Cream is £38. My note: “The best cream for everyone.”'; assert.ok(validateDraft(d,w).some(e=>e.includes('quotation')));
});
test('explicit budget takes precedence over the product cost mentioned first',()=>{
  const w=createWorkspace(),q:Question={...w.questions[3],id:'q-budget-lower',text:'Cloud Cream costs £38, but my budget is £30.',productIds:['cloud-cream']};
  w.questions.push(q); assert.ok(validateDraft(draftAnswer(q,w.products),w).some(e=>e.includes('£30')&&e.includes('budget')));
});
test('a supported budget or remaining amount does not count as a changed product price',()=>{
  const w=createWorkspace(),q:Question={...w.questions[3],id:'q-budget',text:'Cloud Cream for dry skin, with a budget of £60?',productIds:['cloud-cream']};
  w.questions.push(q); const d=draftAnswer(q,w.products);d.text='Cloud Cream is £38. Your budget is £60. Leave £22 unspent.';
  assert.deepEqual(validateDraft(d,w),[]);
});
test('natural budget wording and numeric pounds still enforce the spending limit',()=>{
  for (const text of ['Cloud Cream costs £38, but I can only spend £30.','Cloud Cream costs 38 pounds, but I can only spend 30 pounds.','I have dry skin and 30 pounds to spend. What should I buy?']) {
    const w=createWorkspace(),q:Question={...w.questions[3],id:'q-spend',text,productIds:detectQuestionProducts(text,w.products)};
    w.questions.push(q); assert.ok(validateDraft(draftAnswer(q,w.products),w).some(e=>e.includes('£30')&&e.includes('budget')),text);
    assert.equal(groupQuestion(text),'Routine & budget');
  }
});
test('an unparsed spending limit is held for clarification, not ignored',()=>{
  for (const text of ['I have dry skin and thirty pounds to spend. What should I buy?','Cloud Cream costs £38, but my budget is thirty.']) {
    const w=createWorkspace(),q:Question={...w.questions[3],id:'q-word-budget',text,productIds:detectQuestionProducts(text,w.products)};
    w.questions.push(q);assert.ok(validateDraft(draftAnswer(q,w.products),w).some(e=>e.includes('supported numeric format')),text);
  }
});
test('numeric pound wording in edited prices must match the catalogue',()=>{
  const w=createWorkspace(),d=draftAnswer(w.questions[3],w.products);
  d.text='Cloud Cream costs 12 pounds.'; assert.ok(validateDraft(d,w).some(e=>e.includes('£38')));
  d.text='Cloud Cream costs 38 pounds.'; assert.deepEqual(validateDraft(d,w),[]);
});
test('medicine combinations, eye use and child suitability need evidence',()=>{
  for (const text of ['Can I use Cloud Cream with tretinoin?','Can I put Cloud Cream around my eyes?','Is Cloud Cream okay for my eight-year-old?']) {
    const w=createWorkspace(),q:Question={...w.questions[3],id:'q-usage',text,productIds:['cloud-cream']};
    w.questions.push(q);assert.ok(validateDraft(draftAnswer(q,w.products),w).length>0,text);
  }
});
test('explicit skin and finish conflicts with catalogue labels require clarification',()=>{
  const w=createWorkspace(),q:Question={...w.questions[3],id:'q-preference',text:'I have oily skin and hate rich creams. Is Cloud Cream worth £38?',productIds:['cloud-cream']};
  w.questions.push(q); const errors=validateDraft(draftAnswer(q,w.products),w);
  assert.ok(errors.some(e=>e.includes('preference mismatch')));
  assert.ok(errors.some(e=>e.includes('explicitly says they dislike')));
});
test('matching skin and finish preferences remain answerable',()=>{
  for (const [text,productId] of [['I have dry skin and prefer a rich finish. Is Cloud Cream worth £38?','cloud-cream'],['I have oily skin and prefer a light finish. Is Daily Gel worth £24?','daily-gel']]) {
    const w=createWorkspace(),q:Question={...w.questions[3],id:'q-matching',text,productIds:[productId]};
    w.questions.push(q);assert.deepEqual(validateDraft(draftAnswer(q,w.products),w),[],text);
  }
});
test('unsupported irritation, ingredients and clinical suitability claims are held',()=>{
  const w=createWorkspace(),d=draftAnswer(w.questions[3],w.products);
  for (const text of ['Cloud Cream will not irritate your skin.','Cloud Cream is great for eczema.','Cloud Cream contains ceramides.','Cloud Cream has no perfume.']) {
    d.text=text;assert.ok(validateDraft(d,w).some(e=>e.includes('supplied evidence cannot verify')),text);
  }
});
test('regenerating from revised evidence uses its current price and note',()=>{
  const w=createWorkspace();w.products[0]={...w.products[0],price:39.5,note:'Updated opinion from Maya.',revision:2,source:{page:0,label:'Updated product evidence',excerpt:'Private reference: maya-private-email'}};
  const d=draftAnswer(w.questions[3],w.products);assert.deepEqual(validateDraft(d,w),[]);assert.match(d.text,/£39.50/);assert.match(d.text,/Updated opinion from Maya/);
});
test('published payload omits audience messages and private workspace references',()=>{
  const w=createWorkspace(),q:Question={...w.questions[3],id:'q-private',handle:'@private-handle',source:{page:0,label:'Added in this workspace',excerpt:'Private question and personal background'}};
  w.questions.push(q);w.products[0]={...w.products[0],revision:2,source:{page:0,label:'Updated product evidence',excerpt:'Private reference: maya-private-email'}};
  const d=draftAnswer(q,w.products);d.status='approved';const a=toPublishedAdvice(d,w),raw=JSON.stringify(a);
  assert.ok(a.sourceRefs.every(s=>s.page>0));assert.doesNotMatch(raw,/private-handle|Private question|maya-private-email/);
  const seeded=draftAnswer(w.questions[3],w.products);seeded.status='approved';assert.ok(toPublishedAdvice(seeded,w).sourceRefs.every(s=>!s.label.startsWith('E-01.')));
});
test('revised Glass Drop evidence does not retain the fixed historical price judgement',()=>{
  const w=createWorkspace(),q:Question={...w.questions[3],id:'q-glass',text:'Is Glass Drop worth it?',productIds:['glass-drop']};w.questions.push(q);
  const p=w.products.find(p=>p.id==='glass-drop')!;p.price=50;p.note='Worth the revised price.';p.revision=2;p.source={page:0,label:'Updated product evidence',excerpt:'Verified current record.'};
  const d=draftAnswer(q,w.products);assert.deepEqual(validateDraft(d,w),[]);assert.match(d.text,/£50/);assert.doesNotMatch(d.text,/£62/);assert.match(d.text,/Worth the revised price/);
});
test('unknown questions and shade requests stay on hold',()=>{
  const w=createWorkspace();
  const q:Question={id:'q-custom',handle:'@new',text:'Can you recommend something for this?',intent:groupQuestion('Can you recommend something for this?'),productIds:[],source:{page:0,label:'Added question',excerpt:'Can you recommend something for this?'}};
  w.questions.push(q); assert.ok(validateDraft(draftAnswer(q,w.products),w).some(e=>e.includes('more context')));
  assert.ok(validateDraft(draftAnswer(w.questions[0],w.products),w).some(e=>e.includes('shade ranges')));
});
test('fragrance and compatibility cannot be inferred from a skin label',()=>{
  const w=createWorkspace(),q:Question={...w.questions[3],id:'q-sensitive',text:'Is Cloud Cream safe for sensitive skin?',productIds:['cloud-cream']};
  w.questions.push(q); assert.ok(validateDraft(draftAnswer(q,w.products),w).some(e=>e.includes('Ingredient')));
});
test('a named product does not establish an answer to an unsupported purchase question',()=>{
  const w=createWorkspace(),q:Question={...w.questions[3],id:'q-delivery',text:'How fast is Cloud Cream delivery?',productIds:['cloud-cream']};
  w.questions.push(q); assert.ok(validateDraft(draftAnswer(q,w.products),w).some(e=>e.includes('does not provide')));
});
test('empty copy and missing product references are blocked',()=>{
  const w=createWorkspace(),d=draftAnswer(w.questions[3],w.products); d.title=''; d.text=''; d.productIds.push('not-a-product');
  assert.ok(validateDraft(d,w).some(e=>e.includes('title'))); assert.ok(validateDraft(d,w).some(e=>e.includes('not in the catalogue')));
});
test('grouping preserves separate questions; reports carry exact references and caveats',()=>{
  const w=createWorkspace(); assert.equal(groupQuestion('Is Cloud Cream worth £38?'),'Product value'); assert.deepEqual(detectQuestionProducts('cloud cream and SPF',w.products),['cloud-cream','spf-50']);
  const report=buildReport(w); assert.match(report,/only if both entries describe the same order/); assert.match(report,/Page 17/); assert.match(report,/not an automatic audit/);
  w.issues[0].status='Checking'; w.issues[0].resolution='Requested details'; assert.equal(runEvidenceChecks(w)[0].status,'Checking');
});

function purchaseExample(text:string) {
  const workspace=createWorkspace();
  const question:Question={id:'q-purchase-roles',handle:'@reader',text,intent:groupQuestion(text),productIds:detectQuestionProducts(text,workspace.products),source:{page:0,label:'Added question',excerpt:text}};
  workspace.questions.push(question);
  return {workspace,question,draft:draftAnswer(question,workspace.products)};
}

test('keeping an explicitly owned product does not spend the follower’s zero budget',()=>{
  const {workspace,draft}=purchaseExample('I already own Cloud Cream, budget £0. Should I keep it?');
  assert.deepEqual(draft.productIds,['cloud-cream']);
  assert.ok(draft.sourceRefs.some(source=>source.label.startsWith('E-04.1')));
  assert.deepEqual(validateDraft(draft,workspace),[]);
  assert.match(draft.text,/already own Cloud Cream/);
  assert.match(draft.text,/£0/);
});

test('mutually exclusive products use their individual prices and remainders',()=>{
  const {workspace,draft}=purchaseExample('Cloud Cream or Daily Gel, just one under £40?');
  assert.deepEqual(draft.productIds,['cloud-cream','daily-gel']);
  assert.deepEqual(validateDraft(draft,workspace),[]);
  assert.doesNotMatch(draft.text,/£62/);
  draft.text='Cloud Cream costs £38. That would leave £2. Daily Gel costs £24. That would leave £16. Choose one after reviewing the finish.';
  assert.deepEqual(validateDraft(draft,workspace),[]);
  draft.text+=' You would spend £62.';
  assert.ok(validateDraft(draft,workspace).some(error=>error.includes('£62')&&error.includes('not supported')));
});

test('owned evidence stays linked while only the intended new product reduces the budget',()=>{
  const {workspace,draft}=purchaseExample('I already own Cloud Cream. I want to buy SPF 50. My budget is £30.');
  assert.deepEqual(draft.productIds,['cloud-cream','spf-50']);
  draft.text='Keep your Cloud Cream. SPF 50 costs £26. Your budget is £30. Leave £4 unspent.';
  assert.deepEqual(validateDraft(draft,workspace),[]);
  draft.text+=' The new purchase total is £64.';
  assert.ok(validateDraft(draft,workspace).some(error=>error.includes('£64')&&error.includes('not supported')));
});

test('buying both and explicitly repurchasing owned products still enforce the budget',()=>{
  for(const [text,total,budget] of [
    ['I want to buy Cloud Cream and Daily Gel. My budget is £40.','£62','£40'],
    ['I already own Cloud Cream but need to repurchase it. My budget is £30.','£38','£30'],
    ['I already own Cloud Cream. I want to buy another Cloud Cream. My budget is £30.','£38','£30'],
  ]){
    const {workspace,draft}=purchaseExample(text);
    assert.ok(validateDraft(draft,workspace).some(error=>error.includes(total)&&error.includes(budget)&&error.includes('above')),text);
  }
});

test('ambiguous product roles ask for clarification without inventing a combined basket',()=>{
  const {workspace,draft}=purchaseExample('Cloud Cream and Daily Gel are on my shelf or shopping list. Budget £40.');
  const errors=validateDraft(draft,workspace);
  assert.ok(errors.some(error=>error.includes('which products are already owned')));
  assert.doesNotMatch(errors.join(' '),/£62/);
  assert.equal(draft.decision?.verdict,'Need more context');
});

test('unrelated ownership and the word or do not exempt a genuine purchase basket',()=>{
  const {workspace,draft}=purchaseExample('I own a moisturiser. I want to buy Cloud Cream and Daily Gel for work or home. Budget £40.');
  assert.ok(validateDraft(draft,workspace).some(error=>error.includes('£62')&&error.includes('£40')));
  for(const text of ['If I own Cloud Cream, can I keep it? Budget £0.','I do not own Cloud Cream. Budget £0.']){
    const example=purchaseExample(text);
    assert.ok(validateDraft(example.draft,example.workspace).some(error=>error.includes('which products are already owned')),text);
  }
});

test('edited purchase instructions cannot use owned or comparison context to evade the budget',()=>{
  const comparison=purchaseExample('Cloud Cream or Daily Gel, just one under £40?');
  comparison.draft.text='Buy Cloud Cream and Daily Gel.';
  assert.ok(validateDraft(comparison.draft,comparison.workspace).some(error=>error.includes('£62')&&error.includes('£40')));
  const owned=purchaseExample('I already own Cloud Cream, budget £0. Should I keep it?');
  owned.draft.text='Buy another Cloud Cream.';
  assert.ok(validateDraft(owned.draft,owned.workspace).some(error=>error.includes('£38')&&error.includes('£0')));
});

test('affordable comparison choices remain possible but an explicit expensive choice is held',()=>{
  const {workspace,draft}=purchaseExample('Cloud Cream or Glass Drop, just one under £40?');
  draft.text='Buy Cloud Cream. It costs £38.';
  assert.deepEqual(validateDraft(draft,workspace),[]);
  draft.text='Buy Glass Drop. It costs £62.';
  assert.ok(validateDraft(draft,workspace).some(error=>error.includes('£62')&&error.includes('£40')));
});

test('explicit choice verbs and purchase articles cannot select an over-budget alternative',()=>{
  const {workspace,draft}=purchaseExample('Cloud Cream or Glass Drop, just one under £40?');
  for(const text of ['Choose Glass Drop. It costs £62.','I recommend Glass Drop. It costs £62.','I recommend buying Glass Drop. It costs £62.','Pick Glass Drop.','Go for Glass Drop.','Buy a Glass Drop.']){
    draft.text=text;
    assert.ok(validateDraft(draft,workspace).some(error=>error.includes('£62')&&error.includes('£40')&&error.includes('above')),text);
  }
  draft.text='Choose Cloud Cream. It costs £38.';
  assert.deepEqual(validateDraft(draft,workspace),[]);
});

test('multiunit purchase questions and edited answers are held without assuming one unit',()=>{
  for(const text of ['Buy Cloud Cream twice, budget £40.','Buy 2 Cloud Cream, budget £40.','Buy two Cloud Creams, budget £40.','Buy Cloud Cream x2, budget £40.','Buy 3 units of Cloud Cream, budget £40.','Buy three Cloud Creams, budget £40.','Buy 10 Cloud Creams, budget £40.','Buy Cloud Cream thrice, budget £40.','Buy Cloud Cream x3, budget £40.']){
    const {workspace,draft}=purchaseExample(text);
    assert.ok(validateDraft(draft,workspace).some(error=>error.includes('number of units')),text);
    assert.match(draft.text,/How many units/);
  }
  const {workspace,draft}=purchaseExample('Cloud Cream or Daily Gel, just one under £40?');
  draft.text='Buy Cloud Cream twice.';
  assert.ok(validateDraft(draft,workspace).some(error=>error.includes('number of units')));
});

test('a selected purchase uses its own remainder and spend rather than other comparison amounts',()=>{
  const {workspace,draft}=purchaseExample('Cloud Cream or Daily Gel, just one under £40?');
  for(const amount of [16,24,38,40]){
    draft.text=`Buy Cloud Cream. You will have £${amount} left.`;
    assert.ok(validateDraft(draft,workspace).some(error=>error.includes(`£${amount}`)&&error.includes('money left')),draft.text);
  }
  draft.text='Buy Cloud Cream. You will have £2 left.';
  assert.deepEqual(validateDraft(draft,workspace),[]);
  draft.text='Buy Cloud Cream. You would spend £24.';
  assert.ok(validateDraft(draft,workspace).some(error=>error.includes('£24')&&error.includes('purchase total')));
  draft.text='Buy Cloud Cream. You would spend £38. Daily Gel costs £24.';
  assert.deepEqual(validateDraft(draft,workspace),[]);
  draft.text='Cloud Cream costs £38. That would leave £2. Daily Gel costs £24. That would leave £16.';
  assert.deepEqual(validateDraft(draft,workspace),[]);
});

test('facts-only requests with a negated comparison instruction stay answerable',()=>{
  const factual=purchaseExample('Daily Gel-only catalogue facts: price, skin label, finish, quote and citation. Do not compare other products or make a safety claim.');
  assert.deepEqual(validateDraft(factual.draft,factual.workspace),[]);
  assert.notEqual(factual.draft.decision?.verdict,'Need more context');
  const comparison=purchaseExample('Compare Daily Gel.');
  assert.ok(validateDraft(comparison.draft,comparison.workspace).some(error=>error.includes('Both products')));
});
