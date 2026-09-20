import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {CHAT_RECOVERY_PREFIX,CHAT_STORAGE_KEY,clearChat,getChatRecoveryStatus,loadChat,retryChatStorage,saveChat,validChatMessage} from '../src/lib/chatStorage';
import type {ChatMessage} from '../src/lib/chat';
class MemoryStorage {
 values=new Map<string,string>();
 writes:string[]=[];
 failWrite:(key:string)=>boolean=()=>false;
 corruptWrite:(key:string)=>boolean=()=>false;
 getItem(key:string){return this.values.get(key)??null;}
 setItem(key:string,value:string){
  if(this.failWrite(key))throw new Error('Storage full');
  this.writes.push(key);this.values.set(key,this.corruptWrite(key)?'not the original':value);
 }
}
let storage:MemoryStorage,values:Map<string,string>;
beforeEach(()=>{storage=new MemoryStorage();values=storage.values;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});loadChat();});
const message=(id='one'):ChatMessage=>({id,role:'user',text:'Is Cloud Cream worth £38?',createdAt:'2026-09-20T12:00:00Z'});
const copies=()=>[...values.entries()].filter(([key])=>key.startsWith(CHAT_RECOVERY_PREFIX));
test('chat history survives a local roundtrip and retains only the latest 60 messages',()=>{
 assert.equal(saveChat([message()]),true);assert.deepEqual(loadChat(),[message()]);
 assert.equal(saveChat(Array.from({length:70},(_,i)=>message(String(i)))),true);assert.equal(loadChat().length,60);assert.equal(loadChat()[0].id,'10');
 assert.equal(copies().length,0);assert.equal(getChatRecoveryStatus().state,'ready');
});
test('invalid and duplicate records are excluded from rendering but preserved exactly before saving',()=>{
 const raw=JSON.stringify([null,message(),message(),{...message('two'),role:'system'},{...message('three'),sourceRefs:[null]}],null,2);
 values.set(CHAT_STORAGE_KEY,raw);
 const loaded=loadChat();
 assert.deepEqual(loaded,[message()]);assert.equal(validChatMessage({...message(),questionText:{raw:'not text'}}),false);
 assert.equal(values.get(CHAT_STORAGE_KEY),raw);assert.equal(storage.writes.length,0);
 assert.equal(getChatRecoveryStatus().reason,'invalid-records');
 assert.equal(saveChat(loaded),true);
 assert.equal(copies().length,1);assert.equal(copies()[0][1],raw);
 assert.deepEqual(JSON.parse(values.get(CHAT_STORAGE_KEY)!),loaded);
 assert.deepEqual(storage.writes,[copies()[0][0],CHAT_STORAGE_KEY]);
 assert.equal(getChatRecoveryStatus().state,'recovered');
 assert.equal(getChatRecoveryStatus().recoveryKey,copies()[0][0]);
});
for(const raw of ['{incomplete-but-recoverable','  {"words":"£38 and original whitespace"\n','null','{}','']){
 test(`unreadable stored data is not lost during an empty mount save (${JSON.stringify(raw)})`,()=>{
  values.set(CHAT_STORAGE_KEY,raw);
  assert.deepEqual(loadChat(),[]);assert.equal(storage.writes.length,0);
  assert.equal(getChatRecoveryStatus().state,'recovery-needed');
  assert.equal(getChatRecoveryStatus().reason,'unreadable');
  assert.equal(saveChat([]),true);
  assert.equal(copies().length,1);assert.equal(copies()[0][1],raw);
  assert.equal(values.get(CHAT_STORAGE_KEY),'[]');
 });
}
test('oversized existing history is copied exactly without being parsed or rendered',()=>{
 const raw=' '.repeat(2_000_001);values.set(CHAT_STORAGE_KEY,raw);
 assert.deepEqual(loadChat(),[]);assert.equal(getChatRecoveryStatus().reason,'oversized');
 assert.equal(saveChat([message()]),true);assert.equal(copies()[0][1],raw);
 assert.deepEqual(loadChat(),[message()]);
});
test('failed preservation blocks automatic save, retry and clear without changing the original',()=>{
 const raw='{incomplete-but-recoverable';values.set(CHAT_STORAGE_KEY,raw);
 storage.failWrite=key=>key.startsWith(CHAT_RECOVERY_PREFIX);
 loadChat();
 for(const attempt of [()=>saveChat([]),()=>retryChatStorage([message()]),()=>clearChat()]){
  assert.equal(attempt(),false);assert.equal(values.get(CHAT_STORAGE_KEY),raw);
  assert.equal(getChatRecoveryStatus().state,'blocked');assert.equal(storage.writes.length,0);
 }
});
test('oversized primary remains untouched when a recovery copy cannot fit',()=>{
 const raw='x'.repeat(2_000_001);values.set(CHAT_STORAGE_KEY,raw);
 storage.failWrite=key=>key.startsWith(CHAT_RECOVERY_PREFIX);
 assert.equal(saveChat([]),false);assert.equal(values.get(CHAT_STORAGE_KEY),raw);
 assert.equal(getChatRecoveryStatus().reason,'oversized');
});
test('a recovery write must read back as the exact original before replacing the primary',()=>{
 const raw='{preserve exactly';values.set(CHAT_STORAGE_KEY,raw);
 storage.corruptWrite=key=>key.startsWith(CHAT_RECOVERY_PREFIX);
 assert.equal(saveChat([]),false);assert.equal(values.get(CHAT_STORAGE_KEY),raw);
 assert.equal(storage.writes.includes(CHAT_STORAGE_KEY),false);
 assert.equal(getChatRecoveryStatus().state,'blocked');
});
test('explicit retry preserves the original and saves the current in-memory conversation',()=>{
 const raw='{original';values.set(CHAT_STORAGE_KEY,raw);
 storage.failWrite=key=>key.startsWith(CHAT_RECOVERY_PREFIX);
 const memory=[message()];assert.equal(saveChat(memory),false);
 storage.failWrite=()=>false;
 assert.equal(retryChatStorage(memory),true);assert.equal(copies()[0][1],raw);
 assert.deepEqual(JSON.parse(values.get(CHAT_STORAGE_KEY)!),memory);
 assert.equal(getChatRecoveryStatus().state,'recovered');
});
test('a failed primary write retains the original and its backup, then retry reuses the copy',()=>{
 const raw='{original';values.set(CHAT_STORAGE_KEY,raw);
 storage.failWrite=key=>key===CHAT_STORAGE_KEY;
 assert.equal(saveChat([message()]),false);assert.equal(values.get(CHAT_STORAGE_KEY),raw);
 assert.equal(copies().length,1);assert.equal(copies()[0][1],raw);
 assert.equal(getChatRecoveryStatus().state,'save-failed');
 storage.failWrite=()=>false;
 assert.equal(retryChatStorage([message()]),true);assert.equal(copies().length,1);
});
test('explicit clear removes active history only and retains every recovery copy',()=>{
 const first='{first original';values.set(CHAT_STORAGE_KEY,first);assert.equal(saveChat([message()]),true);
 const firstCopy=copies()[0];
 const second='{second original';values.set(CHAT_STORAGE_KEY,second);assert.equal(clearChat(),true);
 assert.equal(values.get(CHAT_STORAGE_KEY),'[]');assert.equal(values.get(firstCopy[0]),first);
 assert.equal(copies().length,2);assert.ok(copies().some(([,raw])=>raw===second));
 assert.equal(clearChat(),true);assert.equal(copies().length,2);
});
test('clear failure on valid stored chat does not erase the conversation',()=>{
 assert.equal(saveChat([message()]),true);storage.failWrite=key=>key===CHAT_STORAGE_KEY;
 assert.equal(clearChat(),false);assert.deepEqual(loadChat(),[message()]);
});
test('save inspects the latest stored data even when load was never called for it',()=>{
 const raw='{changed after load';values.set(CHAT_STORAGE_KEY,raw);
 assert.equal(saveChat([message()]),true);assert.equal(copies()[0][1],raw);
});
test('invalid, duplicate and oversized outgoing chat leaves all stored data untouched',()=>{
 const raw='{existing original';values.set(CHAT_STORAGE_KEY,raw);
 const large=Array.from({length:60},(_,i)=>({...message(String(i)),sourceRefs:Array.from({length:20},()=>({page:1,label:'Reference',excerpt:'x'.repeat(2000)}))}));
 const cases=[
  [{...message(),text:''}],
  [message(),message()],
  large,
  [{...message(),toJSON:()=>null}],
  [{...message(),extra:BigInt(1)}],
 ];
 for(const messages of cases){
  assert.equal(saveChat(messages),false);assert.equal(values.get(CHAT_STORAGE_KEY),raw);
  assert.equal(storage.writes.length,0);assert.equal(getChatRecoveryStatus().state,'save-failed');
 }
});
test('legacy and bounded AI metadata roundtrip, while invalid metadata is protected as damaged data',()=>{
 const legacy=message('legacy'),local={...message('local'),origin:'local' as const},ai={...message('ai'),origin:'ai' as const,aiModel:'m'.repeat(120)};
 assert.equal(saveChat([legacy,local,ai]),true);assert.deepEqual(loadChat(),[legacy,local,ai]);
 for(const invalid of [{...message(),origin:'remote'},{...message(),aiModel:'m'.repeat(121)},{...message(),aiModel:12}])assert.equal(validChatMessage(invalid),false);
 const raw=JSON.stringify([legacy,{...ai,aiModel:'m'.repeat(121)}]);values.set(CHAT_STORAGE_KEY,raw);
 assert.deepEqual(loadChat(),[legacy]);assert.equal(saveChat([legacy]),true);assert.equal(copies()[0][1],raw);
});
test('chat storage failures are reported without throwing away the in-memory conversation',()=>{
 const memory=[message()];Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>{throw new Error('Blocked');},setItem:()=>{throw new Error('Full');}}});
 assert.deepEqual(loadChat(),[]);assert.equal(saveChat(memory),false);assert.equal(memory[0].text,'Is Cloud Cream worth £38?');
 assert.equal(getChatRecoveryStatus().state,'unavailable');
});
test('unavailable localStorage getter is handled by load, save, clear and retry',()=>{
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Security restriction');}});
 assert.deepEqual(loadChat(),[]);assert.equal(saveChat([message()]),false);
 assert.equal(clearChat(),false);assert.equal(retryChatStorage([message()]),false);
 assert.equal(getChatRecoveryStatus().state,'unavailable');
});
test('recovery status contains no stored message content and callers cannot mutate it',()=>{
 const raw='{private original text';values.set(CHAT_STORAGE_KEY,raw);saveChat([]);
 const snapshot=getChatRecoveryStatus();assert.equal(JSON.stringify(snapshot).includes(raw),false);
 snapshot.state='ready';assert.equal(getChatRecoveryStatus().state,'recovered');
});
