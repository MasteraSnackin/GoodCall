import type {PublishedAdvice} from './types';
import type {DecisionContext} from './followerDiscovery';
import {toPublicAdviceSnapshot} from './share';
import {feedbackAdviceVersion} from './feedback';

export const SAVED_ADVICE_KEY='maya-saved-advice-v1';
export const DECISION_CONTEXT_KEY='goodcall-decision-context-v1';
export const SAVED_ADVICE_EVENT='goodcall-saved-advice-changed';
const LIMIT=100;
type Result={ok:true}|{ok:false;error:string};
export function readSavedAdvice():{items:PublishedAdvice[];error?:string}{
 try{const raw=localStorage.getItem(SAVED_ADVICE_KEY);if(!raw)return {items:[]};if(raw.length>3_000_000)throw Error();const parsed:unknown=JSON.parse(raw);if(!Array.isArray(parsed)||parsed.length>LIMIT)throw Error();const items=parsed.map(toPublicAdviceSnapshot);if(items.some(x=>!x)||new Set(items.map(x=>x!.id)).size!==items.length)throw Error();return {items:items as PublishedAdvice[]};}
 catch{return {items:[],error:'Saved answers could not be read. Their stored copy has been left unchanged.'};}
}
function write(items:PublishedAdvice[]):Result{try{const raw=JSON.stringify(items);if(raw.length>3_000_000)return {ok:false,error:'Your saved collection is full. Existing answers have been preserved.'};localStorage.setItem(SAVED_ADVICE_KEY,raw);window.dispatchEvent(new Event(SAVED_ADVICE_EVENT));return {ok:true};}catch{return {ok:false,error:'Your browser could not save this change. Copy the answer link to keep it.'};}}
export function saveAdvice(advice:PublishedAdvice):Result{const clean=toPublicAdviceSnapshot(advice);if(!clean)return {ok:false,error:'This answer is incomplete and could not be saved.'};const read=readSavedAdvice();if(read.error)return {ok:false,error:read.error};const next=[clean,...read.items.filter(x=>x.id!==clean.id)];if(next.length>LIMIT)return {ok:false,error:'Your collection is full. Remove an older answer before saving another.'};return write(next);}
export function removeSavedAdvice(advice:PublishedAdvice):Result{const read=readSavedAdvice();if(read.error)return {ok:false,error:read.error};return write(read.items.filter(x=>x.id!==advice.id));}
export function sameAdvice(a:PublishedAdvice,b:PublishedAdvice){return a.id===b.id&&feedbackAdviceVersion(a)===feedbackAdviceVersion(b);}
type ContextRecord={id:string;version:string;context:DecisionContext};
function validContext(x:unknown):x is DecisionContext{if(!x||typeof x!=='object'||Array.isArray(x))return false;const c=x as DecisionContext;return ['goal','budget','owned','note'].every(k=>typeof c[k as keyof DecisionContext]==='string'&&c[k as keyof DecisionContext].length<=1000);}
function readContexts():{items:ContextRecord[];error?:string}{try{const raw=localStorage.getItem(DECISION_CONTEXT_KEY);if(!raw)return {items:[]};if(raw.length>500_000)throw Error();const parsed:unknown=JSON.parse(raw);if(!Array.isArray(parsed)||parsed.length>LIMIT||!parsed.every(x=>x&&typeof x.id==='string'&&x.id.length<=100&&typeof x.version==='string'&&x.version.length<=100&&validContext(x.context)))throw Error();return {items:parsed};}catch{return {items:[],error:'Your saved decision notes could not be read. Their stored copy has been left unchanged.'};}}
export function readDecisionContext(advice:PublishedAdvice):{context?:DecisionContext;error?:string}{const read=readContexts();return {context:read.items.find(x=>x.id===advice.id&&x.version===feedbackAdviceVersion(advice))?.context,...(read.error?{error:read.error}:{})};}
export function saveDecisionContext(advice:PublishedAdvice,context:DecisionContext):Result{if(!validContext(context)||!toPublicAdviceSnapshot(advice))return {ok:false,error:'Keep each decision note within 1,000 characters.'};const read=readContexts();if(read.error)return {ok:false,error:read.error};if(read.items.length>=LIMIT&&!read.items.some(x=>x.id===advice.id))return {ok:false,error:'Your decision notes are full. Existing notes have been preserved; update an existing answer instead.'};const {goal,budget,owned,note}=context;const next=[{id:advice.id,version:feedbackAdviceVersion(advice),context:{goal,budget,owned,note}},...read.items.filter(x=>x.id!==advice.id)];try{localStorage.setItem(DECISION_CONTEXT_KEY,JSON.stringify(next));window.dispatchEvent(new Event(SAVED_ADVICE_EVENT));return {ok:true};}catch{return {ok:false,error:'Your decision notes could not be saved. Keep this page open and try again.'};}}
