import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftAnswer, toPublishedAdvice, validateDraft } from '../src/lib/engine';
import { createWorkspace } from '../src/lib/seed';
import type { Draft, Question } from '../src/lib/types';

test('generated answers identify the case-file persona and remain unapproved templates',()=>{
  const workspace=createWorkspace();
  const draft=draftAnswer(workspace.questions[3],workspace.products);
  assert.deepEqual(draft.persona,{id:'maya-case-file',version:1});
  assert.equal(draft.mode,'Evidence template');
  assert.equal(draft.status,'draft');
  assert.equal(draft.approvedAt,undefined);
  assert.throws(()=>toPublishedAdvice(draft,workspace),/approve/);
  draft.status='approved';
  assert.equal(toPublishedAdvice(draft,workspace).text,draft.text);
});

test('persona wording preserves every product’s recorded quote, price and source',()=>{
  const workspace=createWorkspace();
  for (const product of workspace.products) {
    const question:Question={...workspace.questions[3],id:`q-persona-${product.id}`,text:`Is ${product.name} worth its price?`,productIds:[product.id]};
    workspace.questions.push(question);
    const draft=draftAnswer(question,workspace.products);
    assert.ok(draft.text.includes(`“${product.note}”`),`${product.name} quote must stay verbatim`);
    assert.ok(draft.text.includes(`£${product.price}`),`${product.name} must retain its price`);
    assert.ok(draft.sourceRefs.some(source=>source.page===product.source.page && source.label===product.source.label && source.excerpt===product.source.excerpt));
    assert.deepEqual(validateDraft(draft,workspace),[],`${product.name} template must preserve the evidence checks`);
  }
});

test('persona wording keeps the budget hold and asks what to prioritise first',()=>{
  const workspace=createWorkspace();
  const draft=draftAnswer(workspace.questions[1],workspace.products);
  assert.match(draft.text,/^Which concern would you prioritise within your £60 budget\?/);
  assert.match(draft.text,/total £70, above the £60 budget/);
  assert.ok(validateDraft(draft,workspace).some(error=>error.includes('£70') && error.includes('£60')));
  draft.status='approved';
  assert.throws(()=>toPublishedAdvice(draft,workspace),/budget/);
});

test('a targeted first clarification retains the other missing-evidence holds',()=>{
  const workspace=createWorkspace();
  const question:Question={...workspace.questions[4],id:'q-persona-multiple-holds',text:'Do I need Barrier Cream with Cloud Cream for sensitive skin? My budget is £20.',productIds:['cloud-cream']};
  workspace.questions.push(question);
  const draft=draftAnswer(question,workspace.products);
  assert.match(draft.text,/^Which Barrier Cream do you mean\?/);
  assert.match(draft.text,/these checks still need evidence/);
  assert.match(draft.text,/Barrier Cream has no verified product record/);
  assert.match(draft.text,/Ingredient, compatibility and clinical evidence are missing/);
  assert.match(draft.text,/total £38, above the £20 budget/);
  const holds=validateDraft(draft,workspace);
  assert.ok(holds.some(error=>error.includes('Barrier Cream')));
  assert.ok(holds.some(error=>error.includes('Ingredient')));
  assert.ok(holds.some(error=>error.includes('£20')));
});

test('regeneration uses revised evidence and leaves a saved older draft unchanged',()=>{
  const workspace=createWorkspace();
  const previous=draftAnswer(workspace.questions[3],workspace.products);
  const {persona:unused,...legacy}=previous;
  void unused;
  legacy.status='approved';
  workspace.drafts.push(legacy as Draft);
  const saved=structuredClone(workspace.drafts[0]);
  workspace.products[0]={...workspace.products[0],price:39.5,note:'Updated opinion from Maya.',revision:2};
  const fresh=draftAnswer(workspace.questions[3],workspace.products);
  assert.deepEqual(workspace.drafts[0],saved);
  assert.equal(workspace.drafts[0].persona,undefined);
  assert.equal(fresh.status,'draft');
  assert.deepEqual(fresh.persona,{id:'maya-case-file',version:1});
  assert.match(fresh.text,/£39\.50/);
  assert.ok(fresh.text.includes('“Updated opinion from Maya.”'));
  assert.deepEqual(validateDraft(fresh,workspace),[]);
});
