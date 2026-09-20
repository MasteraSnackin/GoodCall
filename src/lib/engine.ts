import type { Draft, Intent, Issue, Product, PublishedAdvice, Question, SourceRef, Workspace } from './types';
import { createCaseIssues, mayaNotes } from './seed';
import { MAYA_PERSONA } from './persona';
import { buildDecisionProfile } from './decisionProfile';
import { isDecisionProfile } from './decisionTypes';

const unique = <T>(items: T[]) => [...new Set(items)];
const tidy = (s: string) => s.toLowerCase().replace(/[’']/g, '');
const money = (value: number) => `£${value.toFixed(value % 1 ? 2 : 0)}`;
// Support numeric currency wording without guessing at an unparsed spending limit.
const numericPounds = (text: string) => text.replace(/\b(\d+(?:\.\d{1,2})?)\s*(?:pounds?|gbp)\b/gi,'£$1');

/** Bounded keyword grouping: individual questions and their constraints are preserved. */
export function groupQuestion(text: string): Intent {
  const t=tidy(numericPounds(text));
  if (/shade|skin type|last week|payday|todays video/.test(t)) return 'Missing context';
  if (/worth|value|overpriced|rebuy|repurchase/.test(t)) return 'Product value';
  if (/routine|already have|need .*too|budget|spend|afford|pounds|£\d|two products|2 products/.test(t)) return 'Routine & budget';
  if (/trust|first date|thank|love you/.test(t)) return 'Relationship & trust';
  if (/would.*buy|would.*do|keep|recommend|which one|your money|if you were me/.test(t)) return 'Personal recommendation';
  return 'Missing context';
}

export function detectQuestionProducts(text: string, products: Product[]): string[] {
  const t=tidy(text);
  return products.filter(p => t.includes(tidy(p.name)) || (p.id==='spf-50' && /\bspf\b/.test(t))).map(p=>p.id);
}

function budgetFor(text: string): number | undefined {
  const t=tidy(numericPounds(text));
  const explicit=[...t.matchAll(/(?:budget(?:\s+(?:is|of))?|(?:can|could)\s+(?:only\s+)?spend|only have|(?:up to|under|at most))\s*(?:of\s*)?£\s*(\d+(?:\.\d{1,2})?)/g),...t.matchAll(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:budget|maximum|max|limit)/g)].map(m=>Number(m[1]));
  const statedClauses=[...t.matchAll(/\b(?:budget(?:\s+(?:is|of))?|(?:can|could)\s+(?:only\s+)?spend|only have)\s+([^,.;?!]+)/g)];
  if (statedClauses.some(m=>!/^£\s*\d/.test(m[1]))) return undefined;
  if (explicit.length) return Math.min(...explicit);
  if (/worth\s*£|paying\s*£|costs?\s*£|is.*£.*good/.test(t) && !/budget|under|only have|can (?:only )?spend/.test(t)) return undefined;
  const values=[...t.matchAll(/£\s*(\d+(?:\.\d{1,2})?)/g)].map(m=>Number(m[1]));
  return values.length ? Math.min(...values) : undefined;
}

function relatedProducts(question: Question, products: Product[]): Product[] {
  const ids=unique([...question.productIds,...detectQuestionProducts(question.text,products)]);
  const t=tidy(question.text);
  if (ids.length===0 && /recommend|what to buy|what should|routine/.test(t)) {
    if (/\bdry\b/.test(t)) ids.push('cloud-cream');
    if (/\boily\b/.test(t)) ids.push('daily-gel');
    if (/\bredness\b/.test(t)) ids.push('red-reset');
  }
  return products.filter(p=>ids.includes(p.id));
}

function questionHolds(question: Question, products: Product[]): string[] {
  const t=tidy(question.text), holds:string[]=[], selected=relatedProducts(question,products);
  for (const name of ['Barrier Oil','Barrier Cream']) {
    if (t.includes(tidy(name))) {
      if (!products.some(p=>tidy(p.name)===tidy(name))) holds.push(`${name} has no verified product record. Confirm its identity before answering.`);
      else holds.push(`The supplied notes do not establish whether ${name} is needed alongside the follower’s existing products. Add evidence for that judgement.`);
    }
  }
  if (/shade|foundation match|colour match|color match/.test(t)) holds.push('The case file does not supply shade ranges or the follower’s current foundation. Ask for that context.');
  if (/delivery|shipping|refund|\bstock\b|where.*(?:buy|get)|buying link|dupe|vegan|cruelty|packaging|bottle|\bsize\b|\bml\b|expir|shelf life/.test(t)) holds.push('The question asks for product or purchase information that the case-file catalogue does not provide. Obtain a source for that detail.');
  if (/sensitive|fragrance|perfume|allerg|eczema|rosacea|pregnan|breastfeed|skin condition|diagnos|acne|retinol|tretinoin|adapalene|isotretinoin|ceramide|ingredient|compatible|compatibility|mix.*(serum|product)|combine|(?:use|apply|wear).*(?:with|alongside)/.test(t)) holds.push('Ingredient, compatibility and clinical evidence are missing. The catalogue’s skin labels cannot establish individual safety or treatment.');
  if (/(?:around|under|near|on|in)\s+(?:(?:my|your|the)\s+)?(?:eyes?|eyelids?)\b|\beye[- ]area\b|\beyelids?\b|\bchildren\b|\bchild\b|\bbab(?:y|ies)\b|\btoddler\b|\byears?[- ]old\b/.test(t)) holds.push('The case file has no age-specific or eye-area usage evidence. Obtain verified instructions before answering this suitability question.');
  if (/dont.*know.*skin|do not.*know.*skin|what.*skin type|tell.*skin type/.test(t)) holds.push('The supplied evidence cannot determine someone’s skin type. Ask for context without diagnosing.');
  if (/first date/.test(t)) holds.push('Ask what help they want for the date, what they own and their preferred finish before recommending a product.');
  if (/already have/.test(t) && !/barrier/.test(t) && selected.length>1) holds.push('The notebook does not establish whether this combination is needed. Clarify the existing routine and the desired change.');
  // These are preference/label conflicts only; they do not establish medical unsuitability.
  const skinStatement=t.match(/\b(?:i have|ive got)\s+(?:very\s+)?(dry|oily|combination|combo)\s+skin\b|\bmy skin is\s+(?:very\s+)?(dry|oily|combination|combo)\b|\bfor\s+(?:my\s+)?(dry|oily|combination|combo)\s+skin\b/);
  const statedSkin=skinStatement?.slice(1).find(Boolean);
  const avoidedFinish=t.match(/\b(?:hate|dislike|dont like|do not like|dont want|do not want|avoid)\s+(?:a\s+|very\s+)?(rich|light|dewy|matte|glow|foam)\b/)?.[1];
  const preferredFinish=t.match(/\b(?:prefer|want|looking for)\s+(?:a\s+)?(rich|light)\s+(?:finish|cream|moisturiser|texture)\b/)?.[1];
  for (const p of selected) {
    const label=tidy(p.skin),finish=tidy(p.finish);
    if (statedSkin && ((statedSkin==='dry' && /oily|combo/.test(label)) || (['oily','combination','combo'].includes(statedSkin) && label==='dry'))) holds.push(`${p.name} is labelled for ${p.skin.toLowerCase()} skin, while the follower explicitly describes ${statedSkin} skin. Clarify the preference mismatch before making a personal recommendation; this is not a medical suitability judgement.`);
    if (avoidedFinish && finish===avoidedFinish) holds.push(`${p.name} has a ${p.finish.toLowerCase()} finish, which the follower explicitly says they dislike or want to avoid. Clarify that preference before recommending it.`);
    else if (preferredFinish && ['rich','light'].includes(finish) && finish!==preferredFinish) holds.push(`${p.name} has a ${p.finish.toLowerCase()} finish, while the follower explicitly wants a ${preferredFinish} finish. Clarify the preference before recommending it.`);
  }
  const budget=budgetFor(t);
  const normalisedMoney=tidy(numericPounds(t));
  if (/\bpounds?\b|\bgbp\b|£\s*[a-z]/.test(normalisedMoney) || (budget===undefined && /\bbudget\b|\bspend\b|\bafford\b/.test(t))) holds.push('The spending limit is not clear in a supported numeric format. Confirm the amount in pounds using digits before recommending a purchase.');
  if (budget!==undefined && selected.reduce((sum,p)=>sum+p.price,0)>budget) holds.push(`The linked products total ${money(selected.reduce((sum,p)=>sum+p.price,0))}, above the ${money(budget)} budget. Ask which concern to prioritise; do not silently drop it.`);
  if (selected.length===0 && !/i trust you|trust you more|thank you/.test(t)) holds.push('The question needs more context: identify the product or goal, current routine, skin preference and budget.');
  if (/\broutine\b/.test(t) && !/\b(dry|oily)\b/.test(t)) holds.push('A routine needs the follower’s skin preference, existing products and budget. “Two products” alone does not establish a suitable routine.');
  if (/compare|versus|\bvs\b|better than|cheaper than/.test(t) && selected.length<2) holds.push('Both products and the comparison criteria need supporting records.');
  return unique(holds);
}

const noteSource = (id:string) => mayaNotes.find(n=>n.id===id)!.source;
const uniqueSources = (refs:SourceRef[]) => refs.filter((r,i)=>refs.findIndex(s=>s.page===r.page && s.label===r.label && s.excerpt===r.excerpt)===i);
const normaliseQuote = (text:string) => text.replace(/\s+/g,' ').trim().replace(/[.!?]+$/,'').toLowerCase();
const escapeRegex = (text:string) => text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function draftAnswer(question: Question, products: Product[]): Draft {
  const selected=relatedProducts(question,products), holds=questionHolds(question,products), at=new Date().toISOString();
  let title='A little more context first', text='';
  const cloud=selected.find(p=>p.id==='cloud-cream'), glass=selected.find(p=>p.id==='glass-drop');
  if (holds.length) {
    title='One question before a recommendation';
    const first=holds[0];
    let clarification='Which product or result are you asking about?';
    const missingProduct=first.match(/^(Barrier Oil|Barrier Cream)/)?.[1];
    if (missingProduct) clarification=`Which ${missingProduct} do you mean? Send the exact product name or a link.`;
    else if (first.includes('shade ranges')) clarification='Which foundation and shade do you currently wear?';
    else if (first.includes('product or purchase information')) clarification='Which retailer or product page are you looking at?';
    else if (first.includes('Ingredient, compatibility')) clarification='Can you share the product’s full ingredient list or its official product page?';
    else if (first.includes('skin type')) clarification='What are you using on your skin now?';
    else if (first.includes('for the date')) clarification='What would you like help with for the date?';
    else if (first.includes('combination is needed')) clarification='What would you like to change about your current routine?';
    else if (first.includes('above the')) clarification=`Which concern would you prioritise within your ${money(budgetFor(question.text)!)} budget?`;
    else if (first.includes('comparison criteria')) clarification='Which two products are you choosing between?';
    text=`${clarification}\n\nI need that before making a useful recommendation. It is a starting point; these checks still need evidence:\n\n${holds.map(h=>`• ${h}`).join('\n')}\n\nNo product choice has been approved yet.`;
  } else if (cloud && selected.length===1) {
    title='Cloud Cream: when it earns its place';
    text=`Cloud Cream is ${money(cloud.price)}. The catalogue lists it as a ${cloud.finish.toLowerCase()} moisturiser for ${cloud.skin.toLowerCase()} skin. My recorded note: “${cloud.note}”\n\nWorth considering if that fills a gap in your routine. If your current moisturiser does the job, keep it. There is no prize for owning two.`;
  } else if (glass && selected.length===1) {
    title='Glass Drop: good, but consider the price';
    text=`Glass Drop is ${money(glass.price)}. My recorded note: “${glass.note}”\n\nThat is the value judgement to weigh up. A nice finish is no reason to stretch your budget.`;
  } else if (selected.length===1) {
    const p=selected[0];
    title=`${p.name}: the note behind the choice`;
    text=`${p.name} costs ${money(p.price)}. The catalogue lists a ${p.finish.toLowerCase()} finish and the skin category “${p.skin}”. My recorded note: “${p.note}”\n\nA good note is a starting point. Check it against what you already use, your budget and the finish you want before adding another product.`;
  } else if (/i trust you|trust you more|thank you/.test(tidy(question.text))) {
    title='The judgement is the point';
    text='That trust matters. Sometimes the recommendation is to keep your money. What are you choosing between?';
  } else {
    text='What are you choosing between? Start there. Then we can check what you already use, your skin preference and your budget before adding anything to the basket.';
  }
  return {id:`draft-${question.id}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,questionId:question.id,title,text,decision:buildDecisionProfile(selected,holds),productIds:selected.map(p=>p.id),productRevisions:Object.fromEntries(selected.map(p=>[p.id,p.revision])),sourceRefs:uniqueSources([question.source,...selected.map(p=>p.source),noteSource('notebook-questions'),noteSource('maya-judgement'),...(holds.length?[noteSource('notebook-routing')]:[]),...(glass?[{page:12,label:'E-08.3 · Value judgement',excerpt:'Maya likes it. She would not\nrecommend paying £62.'}]:[])]),status:'draft',mode:'Evidence template',persona:{id:MAYA_PERSONA.id,version:MAYA_PERSONA.version},createdAt:at,updatedAt:at};
}

/** This deliberately bounded validator supports the demo dataset; it is not general clinical or document verification. */
export function validateDraft(draft: Draft, workspace: Workspace): string[] {
  const errors:string[]=[], question=workspace.questions.find(q=>q.id===draft.questionId);
  if (!draft.title.trim()) errors.push('Add a title before approval.');
  if (!draft.text.trim()) errors.push('Add an answer before approval.');
  if (!question) errors.push('The original question is missing.');
  else errors.push(...questionHolds(question,workspace.products));
  if (!draft.sourceRefs.length) errors.push('Attach supporting source evidence before approval.');
  for (const id of unique(draft.productIds)) {
    const p=workspace.products.find(p=>p.id===id);
    if (!p) errors.push(`Referenced product “${id}” is not in the catalogue.`);
    else {
      if (draft.productRevisions[id]!==p.revision) errors.push(`${p.name} changed after this draft was created. Generate a fresh draft and review it.`);
      if (!draft.sourceRefs.some(r=>r.page===p.source.page && r.label===p.source.label)) errors.push(`${p.name} needs its product source attached.`);
    }
  }
  if(draft.decision && !isDecisionProfile(draft.decision)) errors.push('Complete all decision fields within 800 characters before approval.');
  if(draft.decision?.verdict==='Need more context') errors.push('This decision still needs context. Clarify it before approving a reusable recommendation.');
  const decisionText=draft.decision?[draft.decision.suits,draft.decision.skipIf,draft.decision.unknowns].filter(v=>typeof v==='string').join('\n'):'';
  const body=`${draft.title}\n${draft.text}\n${decisionText}`, t=tidy(body);
  if(/(?:^|\s)@[a-z0-9_.]{2,}/i.test(body)) errors.push('Remove follower handles from the public answer and decision fields before approval.');
  for (const name of ['Barrier Oil','Barrier Cream']) if (t.includes(tidy(name))) errors.push(`An answer about ${name} needs verified product and recommendation evidence; resolving a report entry is not sufficient.`);
  for (const id of detectQuestionProducts(body,workspace.products)) if (!draft.productIds.includes(id)) errors.push(`The answer mentions ${workspace.products.find(p=>p.id===id)!.name} without linked product evidence.`);
  if (/\b(cures?|treats?|heals?|diagnos(?:e|es|is)|guaranteed|hypoallergenic|non[- ]comedogenic|safe|safer|safest|harmless|risk[- ]free|non[- ]irritating|anti[- ]inflammatory)\b|\bsuitable (?:for|during|with)\b|pregnancy[- ]safe|fragrance[- ]free|clinically (?:proven|tested)|dermatologist[- ](?:approved|tested)|(?:clears?|prevents?|reduces?|eliminates?|fix(?:es)?) (?:your )?(?:acne|redness|eczema|rosacea|wrinkles)|contains? (?:niacinamide|retinol|acid|vitamin)|(?:will|can) (?:cure|treat|heal)/i.test(body)) errors.push('The answer includes a safety, ingredient or clinical claim unsupported by the case file. Remove it or provide verified evidence through a future supported review process.');
  if (/\b(?:eczema|rosacea|tretinoin|adapalene|isotretinoin|ceramides?|perfume|irritat\w*)\b|\bcontains?\b|\b(?:no|without|free of)\s+(?:added\s+)?fragrance\b/i.test(body)) errors.push('This wording involves ingredients, irritation or clinical suitability that the supplied evidence cannot verify. Keep the answer within the recorded facts or request more evidence.');
  const linkedProducts=draft.productIds.map(id=>workspace.products.find(p=>p.id===id)).filter((p):p is Product=>!!p);
  const knownBudget=question?budgetFor(question.text):undefined;
  const total=linkedProducts.reduce((sum,p)=>sum+p.price,0);
  const sourceAmounts=linkedProducts.flatMap(p=>[...numericPounds(p.note).matchAll(/£\s*(\d+(?:\.\d{1,2})?)/g)].map(m=>Number(m[1])));
  const supportedAmounts=[0,total,...linkedProducts.map(p=>p.price),...sourceAmounts,...(knownBudget!==undefined?[knownBudget,Math.max(0,knownBudget-total)]:[])];
  for (const match of numericPounds(body).matchAll(/£\s*(\d+(?:\.\d{1,2})?)/g)) {
    const amount=Number(match[1]);
    if (!supportedAmounts.some(n=>Math.abs(n-amount)<0.001)) errors.push(`${money(amount)} is not supported by the linked prices, recorded notes or this follower’s budget. Check the amount before approval.`);
  }
  // A valid budget amount must not masquerade as a product price. Quoted source notes retain historical amounts.
  const outsideQuotes=numericPounds(body.replace(/“[^”]*”|"[^"\n]*"/g,''));
  for (const p of linkedProducts) {
    const re=new RegExp(`\\b${escapeRegex(p.name)}\\b([^.!?£\\n]{0,70})£\\s*(\\d+(?:\\.\\d{1,2})?)`,'gi');
    for (const match of outsideQuotes.matchAll(re)) {
      if (/budget|limit|under|up to|saving|left|remaining/i.test(match[1])) continue;
      if (Math.abs(Number(match[2])-p.price)>0.001) errors.push(`${p.name} is recorded at ${money(p.price)}. Its price in this answer does not match the current evidence.`);
    }
  }
  for (const match of body.matchAll(/(?:my (?:recorded )?note|maya[’']?s (?:recorded )?note|recorded note)[^“"\n]*[“"]([^”"\n]+)[”"]/gi)) {
    if (!linkedProducts.some(p=>normaliseQuote(p.note)===normaliseQuote(match[1]))) errors.push('The quotation attributed to Maya does not match a linked product’s current note. Restore the source wording or write an unattributed explanation.');
  }
  if (question) {
    const allowed=relatedProducts(question,workspace.products).map(p=>p.id);
    for (const id of draft.productIds) if (!allowed.includes(id)) errors.push(`The question does not establish a reason to recommend ${workspace.products.find(p=>p.id===id)?.name ?? id}. Clarify the question before adding products.`);
    const budget=budgetFor(question.text), sum=draft.productIds.reduce((v,id)=>v+(workspace.products.find(p=>p.id===id)?.price??0),0);
    if (budget!==undefined && sum>budget) errors.push(`This draft’s linked products exceed the ${money(budget)} budget.`);
  }
  return unique(errors);
}

export function runEvidenceChecks(workspace: Workspace): Issue[] {
  return createCaseIssues(workspace.products).map(fresh=>{
    const existing=workspace.issues.find(i=>i.id===fresh.id);
    if (!existing) return fresh;
    // A report decision is retained for review; answer validation independently checks the underlying evidence.
    return {...fresh,status:existing.status,resolution:existing.resolution,resolutionSource:existing.resolutionSource,resolvedAt:existing.resolvedAt};
  });
}

export function buildReport(workspace: Workspace): string {
  const issues=runEvidenceChecks(workspace), now=new Date().toISOString();
  return `# GoodCall — evidence and issues report\n\nGenerated: ${now}\n\nSource: Operation Shade Case File.pdf (17 pages). This report runs ten bounded checks against the supplied case file and current product records. It is not an automatic audit of arbitrary documents.\n\n${issues.filter(i=>i.status!=='Resolved').length} open or checking · ${issues.filter(i=>i.status==='Resolved').length} marked resolved · ${workspace.questions.length} audience questions · ${workspace.products.length} product records\n\nMarking an issue resolved does not authorise an unsupported answer.\n\n${issues.map(i=>`## ${i.title}\n\nStatus: ${i.status} | ${i.kind} | ${i.area} | ${i.severity}\n\n${i.description}\n\nRequired action: ${i.nextAction}\n\nAffected questions: ${i.questionIds.length?i.questionIds.join(', '):'None directly'}\n\nAffected products: ${i.productIds.length?i.productIds.map(id=>workspace.products.find(p=>p.id===id)?.name??id).join(', '):'None directly'}\n\nEvidence:\n${i.sourceRefs.map(r=>`- Page ${r.page}, ${r.label}: “${r.excerpt.replace(/\s+/g,' ')}”`).join('\n')}${i.resolution?`\n\nResolution note: ${i.resolution}`:''}${i.resolutionSource?`\n\nResolution evidence: ${i.resolutionSource}`:''}`).join('\n\n---\n\n')}\n`;
}

export function toPublishedAdvice(draft: Draft, workspace: Workspace): PublishedAdvice {
  const errors=validateDraft(draft,workspace);
  if (draft.status!=='approved' && draft.status!=='published') errors.push('Maya must approve this draft before it can be published.');
  if (errors.length) throw new Error(errors.join('\n'));
  const questionSource=workspace.questions.find(q=>q.id===draft.questionId)?.source;
  // Original questions and private correction references belong to the workspace, not to shareable URLs.
  const publicSources=draft.sourceRefs.filter(s=>s.page>0 && !(questionSource && s.page===questionSource.page && s.label===questionSource.label && s.excerpt===questionSource.excerpt) && !/^E-01\./.test(s.label));
  return {version:1,id:draft.cardId??draft.id,title:draft.title.trim(),text:draft.text.trim(),products:draft.productIds.map(id=>workspace.products.find(p=>p.id===id)!).map(({name,price,note})=>({name,price,note})),sourceRefs:publicSources,...(draft.decision?{decision:{verdict:draft.decision.verdict,suits:draft.decision.suits.trim(),skipIf:draft.decision.skipIf.trim(),unknowns:draft.decision.unknowns.trim()}}:{}),publishedAt:draft.publishedAt??new Date().toISOString(),demo:true};
}
