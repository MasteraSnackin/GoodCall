import {useEffect,useState} from 'react';
import {Check,MessageSquare,Plus,RefreshCw} from 'lucide-react';
import type {PublishedAdvice} from '../lib/types';
import {FEEDBACK_CHANGED_EVENT,FEEDBACK_REASONS,feedbackAdviceVersion,feedbackFollowupQuestion,readFeedback,saveFollowerFeedback,setFeedbackHandoff,type FeedbackReason,type FeedbackRecord} from '../lib/feedback';
import './FollowerFeedback.css';

const prompts={
 'too-expensive':{label:'What is your budget for this?',placeholder:'For example, £25 for a moisturiser.'},
 'already-own':{label:'What do you already use, and is it working for you?',placeholder:'Name the product and tell us what you would like to change.'},
 'still-unsure':{label:'What is the one thing you still need to decide?',placeholder:'Tell us what is missing from this answer.'},
};

export default function FollowerFeedback({advice}:{advice:PublishedAdvice}){
 const [initial]=useState(readFeedback);
 const [saved,setSaved]=useState(()=>initial.items.find(f=>f.adviceId===advice.id&&f.adviceVersion===feedbackAdviceVersion(advice)));
 const [reason,setReason]=useState<FeedbackReason|null>(null);
 const [clarification,setClarification]=useState('');
 const [error,setError]=useState(initial.error||'');
 function save(choice:FeedbackReason){
  const result=saveFollowerFeedback(advice,choice,choice==='helped'?'':clarification);
  if(!result.ok){setError(result.error);return;}
  setSaved(result.item);setError('');
 }
 return <section className="follower-feedback" aria-labelledby="feedback-heading">
  <div className="feedback-heading"><MessageSquare size={18}/><h2 id="feedback-heading">Did this help you decide?</h2></div>
  <p className="feedback-local-note">You can read this feedback in the creator view on this device. It stays in this browser and is not sent to Maya on another device.</p>
  {saved?<div className="feedback-saved" role="status"><Check size={18}/><div><strong>Feedback saved on this device</strong><p>{FEEDBACK_REASONS.find(r=>r.id===saved.reason)?.label}</p>{saved.clarification&&<p>{saved.clarification}</p>}</div></div>:<>
   <div className="feedback-options">{FEEDBACK_REASONS.map(option=><button key={option.id} type="button" className="secondary" aria-pressed={reason===option.id} onClick={()=>{setReason(option.id);setClarification('');setError('');if(option.id==='helped')save(option.id);}}>{option.label}</button>)}</div>
   {reason&&reason!=='helped'&&<form onSubmit={event=>{event.preventDefault();save(reason);}}><label className="field">{prompts[reason].label}<textarea value={clarification} onChange={event=>setClarification(event.target.value)} maxLength={1000} minLength={2} required rows={3} placeholder={prompts[reason].placeholder}/></label><button className="primary" type="submit" disabled={clarification.trim().length<2}>Save feedback</button></form>}
  </>}
  {error&&<p className="feedback-error" role="alert">{error}</p>}
 </section>;
}

type AddQuestion=(text:string)=>void|boolean|Promise<void|boolean>;
export function FollowerFeedbackInbox({onAddQuestion}:{onAddQuestion:AddQuestion}){
 const [store,setStore]=useState(readFeedback);
 const refresh=()=>setStore(readFeedback());
 useEffect(()=>{window.addEventListener(FEEDBACK_CHANGED_EVENT,refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener(FEEDBACK_CHANGED_EVENT,refresh);window.removeEventListener('storage',refresh);};},[]);
 return <section className="feedback-inbox" aria-labelledby="feedback-inbox-heading">
  <header><div><span className="eyebrow">AFTER THE ANSWER</span><h2 id="feedback-inbox-heading">Follower feedback</h2></div><button className="secondary" onClick={refresh}><RefreshCw size={15}/>Refresh feedback</button></header>
  <p className="feedback-local-note">This view shows feedback saved in this browser; it does not collect feedback from other devices. Adding a follow-up creates an audience question for review and leaves the published answer unchanged.</p>
  {store.error&&<p className="feedback-error" role="alert">{store.error}</p>}
  {!store.error&&store.items.length===0&&<p className="feedback-empty">No feedback saved in this browser yet. Followers can leave feedback when they open a shared answer on this device.</p>}
  {store.items.map(item=><FeedbackInboxItem key={item.id} item={item} onAddQuestion={onAddQuestion}/>)}
 </section>;
}

function FeedbackInboxItem({item,onAddQuestion}:{item:FeedbackRecord;onAddQuestion:AddQuestion}){
 const [question,setQuestion]=useState(()=>feedbackFollowupQuestion(item));
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [done,setDone]=useState(item.handoff==='question-added');
 async function add(){
  if(busy||done||item.handoff!=='new'||question.trim().length<8||question.length>2000)return;
  setBusy(true);setError('');
  const claimed=setFeedbackHandoff(item.id,'handoff-pending');
  if(!claimed.ok){setBusy(false);setError(`${claimed.error} No follow-up question was added.`);return;}
  if(claimed.alreadySaved){setBusy(false);setDone(claimed.item.handoff==='question-added');return;}
  try{
   const result=await onAddQuestion(question.trim());
   if(result===false)throw new Error('not-added');
   setDone(true);
   const recorded=setFeedbackHandoff(item.id,'question-added');
   if(!recorded.ok)setError('The follow-up question was added, but its completion could not be recorded. Check Audience questions before attempting another handoff.');
  }catch{
   const reset=setFeedbackHandoff(item.id,'new');
   setError(reset.ok?'The follow-up question could not be added. Your wording is still here; try again.':'The handoff could not be confirmed or reset. Check Audience questions before attempting another handoff.');
  }finally{setBusy(false);}
 }
 const added=done||item.handoff==='question-added';
 const pending=item.handoff==='handoff-pending'&&!busy&&!added;
 return <article className="feedback-inbox-item">
  <div className="feedback-item-top"><strong>{FEEDBACK_REASONS.find(r=>r.id===item.reason)?.label}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString('en-GB')}</time></div>
  <h3>{item.adviceTitle}</h3><p className="feedback-version">Answer version {item.adviceVersion.split(':').at(-1)} · published {new Date(item.advicePublishedAt).toLocaleDateString('en-GB')}</p>
  {item.products.length>0&&<p className="feedback-product-context">{item.products.map(p=>`${p.name} (£${p.price.toFixed(p.price%1?2:0)})`).join(' · ')}</p>}
  {item.clarification&&<blockquote>{item.clarification}</blockquote>}
  {item.reason!=='helped'&&(added?<p className="feedback-handoff-done" role="status"><Check size={16}/>Follow-up question added.</p>:pending?<p className="feedback-error" role="status">A previous handoff could not be confirmed. Check Audience questions before adding this feedback again.</p>:<><label className="field">Follow-up question<textarea rows={5} value={question} maxLength={2000} onChange={event=>setQuestion(event.target.value)} disabled={busy}/></label>{question.length>2000&&<p className="feedback-error">Shorten this follow-up to 2,000 characters before adding it. The full context has been kept for you to edit.</p>}<button className="secondary" onClick={add} disabled={busy||question.trim().length<8||question.length>2000}><Plus size={15}/>{busy?'Adding follow-up…':'Add follow-up question'}</button></>)}
  {error&&<p className="feedback-error" role="alert">{error}</p>}
 </article>;
}
