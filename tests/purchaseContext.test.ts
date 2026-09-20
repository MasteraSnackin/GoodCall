import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedProducts} from '../src/lib/seed';
import {hasPositiveComparisonIntent,purchaseTotals,resolvePurchaseContext} from '../src/lib/purchaseContext';

const catalogue=seedProducts();
const products=(...ids:string[])=>catalogue.filter(product=>ids.includes(product.id));

test('a purchase verb introducing alternatives does not select the first option',()=>{
  const selected=products('cloud-cream','daily-gel');
  const context=resolvePurchaseContext('I want to buy Cloud Cream or Daily Gel.',selected);
  assert.equal(context.mode,'alternatives');
  assert.deepEqual(purchaseTotals(context,selected),[38,24]);
});

test('a separately stated choice selects its price while keeping comparison evidence',()=>{
  const selected=products('cloud-cream','glass-drop');
  const context=resolvePurchaseContext('Compare Cloud Cream and Glass Drop. Buy Glass Drop.',selected);
  assert.equal(context.mode,'basket');
  assert.deepEqual(purchaseTotals(context,selected),[62]);
});

test('a fixed purchase combines with each alternative separately',()=>{
  const selected=products('cloud-cream','daily-gel','spf-50');
  const context=resolvePurchaseContext('I want to buy SPF. Compare Cloud Cream and Daily Gel.',selected);
  assert.equal(context.mode,'alternatives');
  assert.deepEqual(purchaseTotals(context,selected),[64,50]);
});

test('uncertain ownership and plural repurchase references need clarification',()=>{
  const selected=products('cloud-cream','daily-gel');
  for(const text of ['I already own Cloud Cream or Daily Gel.','I own Cloud Cream and Daily Gel. I need to repurchase it.']){
    const context=resolvePurchaseContext(text,selected);
    assert.equal(context.mode,'unclear',text);
    assert.deepEqual(purchaseTotals(context,selected),[]);
  }
});

test('owning two named products does not create new spending',()=>{
  const selected=products('cloud-cream','daily-gel');
  const context=resolvePurchaseContext('I already own Cloud Cream and Daily Gel.',selected);
  assert.deepEqual(context.ownedProductIds,['cloud-cream','daily-gel']);
  assert.deepEqual(purchaseTotals(context,selected),[0]);
});

test('explicit choices and articles select a purchase without charging reference products',()=>{
  const selected=products('cloud-cream','glass-drop');
  for(const text of ['Choose Glass Drop.','Pick Glass Drop.','I recommend Glass Drop.','I recommend buying Glass Drop.','I recommend purchasing a Glass Drop.','Go for Glass Drop.','Buy a Glass Drop.']){
    const context=resolvePurchaseContext(text,selected,true);
    assert.equal(context.hasExplicitPurchase,true,text);
    assert.deepEqual(purchaseTotals(context,selected),[62],text);
  }
  const articleProduct={...selected.find(product=>product.id==='glass-drop')!,name:'Essence'};
  assert.deepEqual(purchaseTotals(resolvePurchaseContext('Purchase an Essence.',[articleProduct]),[articleProduct]),[62]);
  for(const text of ['Choose Cloud Cream or Glass Drop.','Pick a Cloud Cream or a Glass Drop.']){
    const context=resolvePurchaseContext(text,selected,true);
    assert.equal(context.mode,'alternatives',text);
    assert.deepEqual(purchaseTotals(context,selected),[38,62],text);
  }
  for(const text of ['Do not choose Glass Drop.','I never recommend Glass Drop.','I do not recommend buying Glass Drop.','If you choose Glass Drop.']){
    const context=resolvePurchaseContext(text,selected,true);
    assert.equal(context.mode,'unclear',text);
    assert.deepEqual(purchaseTotals(context,selected),[],text);
  }
});

test('clear quantities attached to a purchase need clarification, while unrelated numbers do not',()=>{
  const selected=products('cloud-cream');
  for(const text of ['Buy 2 Cloud Cream, budget £40.','Buy two Cloud Cream, budget £40.','Buy two Cloud Creams, budget £40.','Buy Cloud Cream twice, budget £40.','Buy Cloud Cream x2, budget £40.','Buy x2 Cloud Cream, budget £40.','Buy two jars of Cloud Cream, budget £40.','Buy 3 Cloud Creams, budget £40.','Buy three Cloud Creams, budget £40.','Buy 10 Cloud Creams, budget £40.','Buy three units of Cloud Cream, budget £40.','Buy Cloud Cream thrice, budget £40.','Buy Cloud Cream x3, budget £40.','Buy a dozen Cloud Creams, budget £40.']){
    const context=resolvePurchaseContext(text,selected);
    assert.equal(context.hasExplicitPurchase,true,text);
    assert.equal(context.mode,'unclear',text);
    assert.match(context.clarification ?? '',/number of units/,text);
    assert.deepEqual(purchaseTotals(context,selected),[],text);
  }
  for(const text of ['Buy Cloud Cream, budget £40.','Buy Cloud Cream for a 2-step routine, budget £40.','Buy Cloud Cream in two weeks, budget £40.','Buy Cloud Cream in three weeks, budget £40.','Buy Cloud Cream for a 10-step routine, budget £40.']){
    const context=resolvePurchaseContext(text,selected);
    assert.equal(context.mode,'basket',text);
    assert.deepEqual(purchaseTotals(context,selected),[38],text);
  }
});

test('positive comparison intent excludes explicit negative instructions',()=>{
  for(const text of ['Do not compare other products.','Never compare Daily Gel.','Avoid comparing Daily Gel.']) assert.equal(hasPositiveComparisonIntent(text),false,text);
  for(const text of ['Compare Daily Gel.','Compare Daily Gel and Cloud Cream.','Do not compare prices, but compare Daily Gel and Cloud Cream finishes.']) assert.equal(hasPositiveComparisonIntent(text),true,text);
  const context=resolvePurchaseContext('Daily Gel-only catalogue facts: price, skin label, finish, quote and citation. Do not compare other products or make a safety claim.',products('daily-gel'));
  assert.equal(context.mode,'basket');
  assert.equal(context.clarification,undefined);
});
