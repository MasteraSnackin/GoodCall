import type {ChatMessage} from './chat';
import type {SourceRef} from './types';

export const CHAT_STORAGE_KEY='maya-chat-v1';
export const CHAT_RECOVERY_PREFIX='maya-chat-recovery-v1:';
export const CHAT_HISTORY_LIMIT=60;
const MAX_RAW=2_000_000;
export type ChatRecoveryReason='unreadable'|'invalid-records'|'oversized';
export type ChatRecoveryStatus={
 state:'ready'|'recovery-needed'|'recovered'|'blocked'|'unavailable'|'save-failed';
 message:string;
 reason?:ChatRecoveryReason;
 recoveryKey?:string;
};
let status:ChatRecoveryStatus={state:'ready',message:'Chat history saves in this browser.'};
let copySequence=0;
export function getChatRecoveryStatus():ChatRecoveryStatus {return {...status};}
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max;
function source(value:unknown):value is SourceRef {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const s=value as SourceRef;
 return Number.isInteger(s.page)&&s.page>=0&&s.page<=999&&text(s.label,300)&&text(s.excerpt,2000);
}
export function validChatMessage(value:unknown):value is ChatMessage {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const m=value as ChatMessage;
 return text(m.id,120)&&m.id.length>0&&(m.role==='user'||m.role==='assistant')&&text(m.text,8000)&&m.text.trim().length>0&&text(m.createdAt,80)&&Number.isFinite(Date.parse(m.createdAt))&&(m.questionText===undefined||text(m.questionText,2000))&&(m.kind===undefined||['answer','clarification','help'].includes(m.kind))&&(m.sourceRefs===undefined||(Array.isArray(m.sourceRefs)&&m.sourceRefs.length<=20&&m.sourceRefs.every(source)))&&(m.origin===undefined||m.origin==='local'||m.origin==='ai')&&(m.aiModel===undefined||text(m.aiModel,120));
}
function inspect(raw:string):{messages:ChatMessage[];reason?:ChatRecoveryReason} {
 if(raw.length>MAX_RAW)return {messages:[],reason:'oversized'};
 try {
  const data:unknown=JSON.parse(raw);
  if(!Array.isArray(data))return {messages:[],reason:'unreadable'};
  const ids=new Set<string>();
  const messages=data.filter((message:unknown):message is ChatMessage=>{
   if(!validChatMessage(message)||ids.has(message.id))return false;
   ids.add(message.id);return true;
  });
  return {messages:messages.slice(-CHAT_HISTORY_LIMIT),...(messages.length!==data.length?{reason:'invalid-records' as const}:{})};
 }catch{return {messages:[],reason:'unreadable'};}
}
function recoverySaved(reason:ChatRecoveryReason,recoveryKey:string):ChatRecoveryStatus {
 return {state:'recovered',reason,recoveryKey,message:'Some stored chat could not be read. Its original data is preserved in a recovery copy in this browser.'};
}
/** Reading never rewrites storage; valid records remain usable while the original is protected. */
export function loadChat():ChatMessage[] {
 try {
  const raw=localStorage.getItem(CHAT_STORAGE_KEY);
  const result=raw===null?{messages:[]}:inspect(raw);
  status=result.reason
   ?{state:'recovery-needed',reason:result.reason,message:'Some stored chat could not be read. The original must be preserved before chat can be saved.'}
   :{state:'ready',message:'Chat history loaded from this browser.'};
  return result.messages;
 }catch{
  status={state:'unavailable',message:'Browser storage is unavailable. Keep this page open to retain the conversation.'};
  return [];
 }
}
/** Keep every damaged original: recovery copies are never overwritten or automatically deleted. */
function preserveOriginal(storage:Storage,raw:string):string|null {
 try {
  if(status.recoveryKey&&storage.getItem(status.recoveryKey)===raw)return status.recoveryKey;
  for(let attempt=0;attempt<20;attempt++){
   const key=`${CHAT_RECOVERY_PREFIX}${Date.now().toString(36)}-${++copySequence}`;
   if(storage.getItem(key)!==null)continue;
   storage.setItem(key,raw);
   return storage.getItem(key)===raw?key:null;
  }
  return null;
 }catch{return null;}
}
export function saveChat(messages:ChatMessage[]):boolean {
 let data:string;
 try {
  if(!Array.isArray(messages)||!messages.every(validChatMessage)||new Set(messages.map(message=>message.id)).size!==messages.length)throw new Error();
  data=JSON.stringify(messages.slice(-CHAT_HISTORY_LIMIT));
  // Check the serialised form too: runtime objects may override JSON serialisation.
  if(inspect(data).reason)throw new Error();
 }catch{
  status={...status,state:'save-failed',message:'Chat history was not saved because it is invalid or exceeds the supported size. The stored conversation is unchanged.'};
  return false;
 }
 let storage:Storage,previous:string|null;
 try {storage=localStorage;previous=storage.getItem(CHAT_STORAGE_KEY);}catch{
  status={...status,state:'unavailable',message:'Browser storage is unavailable. Keep this page open to retain the conversation.'};
  return false;
 }
 const reason=previous===null?undefined:inspect(previous).reason;
 if(reason&&previous!==null){
  const recoveryKey=preserveOriginal(storage,previous);
  if(!recoveryKey){
   status={state:'blocked',reason,message:'Chat could not be saved because the previous history could not be preserved. Keep this page open and retry after freeing browser storage.'};
   return false;
  }
  status=recoverySaved(reason,recoveryKey);
 }
 try {
  storage.setItem(CHAT_STORAGE_KEY,data);
  status=status.recoveryKey&&status.reason
   ?recoverySaved(status.reason,status.recoveryKey)
   :{state:'ready',message:'Chat history is saved in this browser.'};
  return true;
 }catch{
  status={...status,state:'save-failed',message:'Chat history could not be saved on this device. Keep this page open to retain the conversation.'};
  return false;
 }
}
/** Explicit retries use the current in-memory chat and repeat all preservation checks. */
export function retryChatStorage(messages:ChatMessage[]):boolean {return saveChat(messages);}
/** Clear active history only after a safe write; callers keep their messages if this returns false. */
export function clearChat():boolean {return saveChat([]);}
