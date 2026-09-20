import type {ChatMessage} from './chat';
import type {SourceRef} from './types';

export const CHAT_STORAGE_KEY='maya-chat-v1';
export const CHAT_HISTORY_LIMIT=60;
const MAX_RAW=2_000_000;
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max;
function source(value:unknown):value is SourceRef {
 if(!value||typeof value!=='object')return false;
 const s=value as SourceRef;
 return Number.isInteger(s.page)&&s.page>=0&&s.page<=999&&text(s.label,300)&&text(s.excerpt,2000);
}
export function validChatMessage(value:unknown):value is ChatMessage {
 if(!value||typeof value!=='object')return false;
 const m=value as ChatMessage;
 return text(m.id,120)&&m.id.length>0&&(m.role==='user'||m.role==='assistant')&&text(m.text,8000)&&m.text.trim().length>0&&text(m.createdAt,80)&&Number.isFinite(Date.parse(m.createdAt))&&(m.questionText===undefined||text(m.questionText,2000))&&(m.kind===undefined||['answer','clarification','help'].includes(m.kind))&&(m.sourceRefs===undefined||(Array.isArray(m.sourceRefs)&&m.sourceRefs.length<=20&&m.sourceRefs.every(source)));
}
export function loadChat():ChatMessage[] {
 try {
  const raw=localStorage.getItem(CHAT_STORAGE_KEY);
  if(!raw||raw.length>MAX_RAW)return [];
  const data:unknown=JSON.parse(raw);
  if(!Array.isArray(data))return [];
  const ids=new Set<string>();
  return data.filter(validChatMessage).filter(message=>{if(ids.has(message.id))return false;ids.add(message.id);return true;}).slice(-CHAT_HISTORY_LIMIT);
 }catch{return [];}
}
export function saveChat(messages:ChatMessage[]):boolean {
 try {
  if(!messages.every(validChatMessage))return false;
  const data=JSON.stringify(messages.slice(-CHAT_HISTORY_LIMIT));
  if(data.length>MAX_RAW)return false;
  localStorage.setItem(CHAT_STORAGE_KEY,data);
  return true;
 }catch{return false;}
}
