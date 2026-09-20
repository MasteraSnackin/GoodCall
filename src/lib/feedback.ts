import type { PublishedAdvice } from './types';
import { isAdvice } from './share';

export const FEEDBACK_STORAGE_KEY='goodcall-follower-feedback-v1';
export const FEEDBACK_CHANGED_EVENT='goodcall-feedback-changed';
export const FEEDBACK_LIMIT=200;
export const FEEDBACK_REASONS=[
  {id:'helped',label:'That helped'},
  {id:'too-expensive',label:'Too expensive'},
  {id:'already-own',label:'I already own something similar'},
  {id:'still-unsure',label:'Still unsure'},
] as const;
export type FeedbackReason=typeof FEEDBACK_REASONS[number]['id'];
export type FeedbackHandoff='new'|'handoff-pending'|'question-added';
export interface FeedbackRecord {
  version:1; id:string; adviceId:string; adviceVersion:string; advicePublishedAt:string; adviceTitle:string;
  products:{name:string;price:number}[]; reason:FeedbackReason; clarification:string; createdAt:string;
  handoff:FeedbackHandoff; questionAddedAt?:string;
}
export type FeedbackRead={items:FeedbackRecord[];error?:string};
export type FeedbackResult={ok:true;item:FeedbackRecord;alreadySaved?:boolean}|{ok:false;error:string};
const MAX_RAW=1_500_000;
const bounded=(value:unknown,min:number,max:number):value is string=>typeof value==='string'&&value.trim().length>=min&&value.length<=max;
const date=(value:unknown):value is string=>bounded(value,1,80)&&Number.isFinite(Date.parse(value));

/** Snapshot identity only, not a signature or proof of authorship. */
export function feedbackAdviceVersion(advice:PublishedAdvice):string {
  const content=JSON.stringify([advice.publishedAt,advice.title,advice.text,advice.products,advice.decision,advice.sourceRefs]);
  let hash=2166136261;
  for(let i=0;i<content.length;i++){hash^=content.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return `${advice.publishedAt}:${(hash>>>0).toString(16).padStart(8,'0')}`;
}

export function validFeedback(value:unknown):value is FeedbackRecord {
  if(!value||typeof value!=='object')return false;
  const f=value as FeedbackRecord;
  return f.version===1&&bounded(f.id,1,120)&&bounded(f.adviceId,1,100)&&bounded(f.adviceVersion,1,100)&&date(f.advicePublishedAt)&&bounded(f.adviceTitle,1,300)
    &&Array.isArray(f.products)&&f.products.length<=15&&f.products.every(p=>p&&bounded(p.name,1,200)&&typeof p.price==='number'&&Number.isFinite(p.price)&&p.price>=0&&p.price<100000)
    &&FEEDBACK_REASONS.some(r=>r.id===f.reason)&&bounded(f.clarification,f.reason==='helped'?0:2,1000)&&date(f.createdAt)
    &&['new','handoff-pending','question-added'].includes(f.handoff)&&(f.questionAddedAt===undefined||date(f.questionAddedAt))
    &&(f.handoff!=='question-added'||f.questionAddedAt!==undefined);
}

export function readFeedback():FeedbackRead {
  try {
    const raw=localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if(!raw)return {items:[]};
    if(raw.length>MAX_RAW)return {items:[],error:'The saved feedback is too large to open here. Its stored copy has been left unchanged.'};
    const parsed:unknown=JSON.parse(raw);
    if(!Array.isArray(parsed)||parsed.length>FEEDBACK_LIMIT||!parsed.every(validFeedback)||new Set(parsed.map(f=>f.id)).size!==parsed.length) return {items:[],error:'Saved feedback could not be validated. Its stored copy has been left unchanged.'};
    return {items:parsed};
  }catch{return {items:[],error:'Feedback could not be read on this device. Please try again when browser storage is available.'};}
}

function writeFeedback(items:FeedbackRecord[]):string|undefined {
  if(items.length>FEEDBACK_LIMIT||!items.every(validFeedback))return 'Feedback could not be saved because the local record is incomplete or full.';
  const raw=JSON.stringify(items);
  if(raw.length>MAX_RAW)return 'The local feedback store is full. This response has not been saved.';
  try {
    localStorage.setItem(FEEDBACK_STORAGE_KEY,raw);
    if(typeof window!=='undefined')window.dispatchEvent(new Event(FEEDBACK_CHANGED_EVENT));
    return undefined;
  }catch{return 'Feedback could not be saved on this device. Your wording is still here; try again when browser storage is available.';}
}

export function saveFollowerFeedback(advice:PublishedAdvice,reason:FeedbackReason,clarification:string):FeedbackResult {
  if(!isAdvice(advice))return {ok:false,error:'This advice card is incomplete. Open a valid shared card before leaving feedback.'};
  const read=readFeedback();if(read.error)return {ok:false,error:read.error};
  const adviceVersion=feedbackAdviceVersion(advice);
  const existing=read.items.find(f=>f.adviceId===advice.id&&f.adviceVersion===adviceVersion);
  if(existing)return {ok:true,item:existing,alreadySaved:true};
  if(read.items.length>=FEEDBACK_LIMIT)return {ok:false,error:'This device has reached its local feedback limit. This response has not been saved.'};
  const item:FeedbackRecord={version:1,id:`feedback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`,adviceId:advice.id,adviceVersion,advicePublishedAt:advice.publishedAt,adviceTitle:advice.title,products:advice.products.map(({name,price})=>({name,price})),reason,clarification:clarification.trim(),createdAt:new Date().toISOString(),handoff:'new'};
  if(!validFeedback(item))return {ok:false,error:'Choose a feedback reason and add a short clarification of up to 1,000 characters.'};
  const error=writeFeedback([item,...read.items]);return error?{ok:false,error}:{ok:true,item};
}

/** Record an explicit handoff separately from the audience question/workspace. */
export function setFeedbackHandoff(id:string,handoff:FeedbackHandoff):FeedbackResult {
  const read=readFeedback();if(read.error)return {ok:false,error:read.error};
  const found=read.items.find(f=>f.id===id);if(!found)return {ok:false,error:'That feedback record is no longer available. Refresh this view before trying again.'};
  if(found.handoff==='question-added'||(found.handoff==='handoff-pending'&&handoff==='handoff-pending'))return {ok:true,item:found,alreadySaved:true};
  const item:FeedbackRecord={...found,handoff,...(handoff==='question-added'?{questionAddedAt:new Date().toISOString()}:{questionAddedAt:undefined})};
  const error=writeFeedback(read.items.map(f=>f.id===id?item:f));return error?{ok:false,error}:{ok:true,item};
}

export function feedbackFollowupQuestion(item:FeedbackRecord):string {
  const reason=FEEDBACK_REASONS.find(r=>r.id===item.reason)!.label;
  // Prices stay in the feedback metadata, where they cannot be mistaken for a follower's limit.
  const products=item.products.map(p=>p.name).join(', ');
  let clarification=`Follower clarification: ${item.clarification}`;
  if(item.reason==='too-expensive'){
    // Only normalise a plainly stated single amount. Free text remains for a person to clarify.
    const amount=item.clarification.match(/^(?:(?:my\s+)?budget\s*(?:(?:is|of)\s*)?|i\s+(?:can|could)\s+(?:only\s+)?spend\s+)?£?\s*(\d+(?:\.\d{1,2})?)\s*(?:pounds?|gbp)?[.!]?$/i);
    clarification=amount?`My budget is £${amount[1]}.\n${clarification}`:`My budget is not yet confirmed.\n${clarification}`;
  }
  return `Follow-up on “${item.adviceTitle}”.\nFeedback: ${reason}.\n${products?`Products discussed: ${products}.\n`:''}${clarification}\nPlease review the current context before preparing a new answer.`;
}
