import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {CHAT_STORAGE_KEY,loadChat,saveChat,validChatMessage} from '../src/lib/chatStorage';
import type {ChatMessage} from '../src/lib/chat';
let values:Map<string,string>;
beforeEach(()=>{values=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}}});});
const message=(id='one'):ChatMessage=>({id,role:'user',text:'Is Cloud Cream worth £38?',createdAt:'2026-09-20T12:00:00Z'});
test('chat history survives a local roundtrip and retains only the latest 60 messages',()=>{
 assert.equal(saveChat([message()]),true);assert.deepEqual(loadChat(),[message()]);
 saveChat(Array.from({length:70},(_,i)=>message(String(i))));assert.equal(loadChat().length,60);assert.equal(loadChat()[0].id,'10');
});
test('invalid and duplicate chat records do not enter the rendered history',()=>{
 values.set(CHAT_STORAGE_KEY,JSON.stringify([null,message(),message(),{...message('two'),role:'system'},{...message('three'),sourceRefs:[null]}]));
 assert.deepEqual(loadChat(),[message()]);assert.equal(validChatMessage({...message(),questionText:{raw:'not text'}}),false);
 values.set(CHAT_STORAGE_KEY,'{incomplete');assert.deepEqual(loadChat(),[]);
});
test('chat storage failures are reported without throwing away the in-memory conversation',()=>{
 const memory=[message()];Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>{throw new Error('Blocked');},setItem:()=>{throw new Error('Full');}}});
 assert.deepEqual(loadChat(),[]);assert.equal(saveChat(memory),false);assert.equal(memory[0].text,'Is Cloud Cream worth £38?');
});
