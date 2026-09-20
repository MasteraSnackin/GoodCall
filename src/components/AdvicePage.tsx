import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Bookmark,Check,Copy,ChevronDown,Heart,ShieldCheck} from 'lucide-react';
import type {PublishedAdvice} from '../lib/types';
import type {DecisionContext} from '../lib/followerDiscovery';
import {shareUrl} from '../lib/share';
import './AdvicePage.css';
import {DecisionSummary} from './DecisionProfile';
import FollowerFeedback from './FollowerFeedback';
import {feedbackAdviceVersion} from '../lib/feedback';
import {readSavedAdvice,saveAdvice,removeSavedAdvice,sameAdvice,readDecisionContext,saveDecisionContext} from '../lib/savedAdvice';
import {recordFollowerEvent} from '../lib/followerActivity';
const EMPTY_CONTEXT:DecisionContext={goal:'',budget:'',owned:'',note:''};
function AdviceContent({advice}:{advice:PublishedAdvice}){
 return <div data-testid="public-advice-content">
  <h1>{advice.title}</h1><p className="advice-deck">Return to this answer when you're ready to decide.</p>
  <article className="advice-body"><div className="advice-avatar">m.</div><div><span className="eyebrow">YOUR ANSWER</span><div className="advice-copy">{advice.text}</div></div></article>
  {advice.decision&&<DecisionSummary value={advice.decision}/>}
  {advice.products.length>0&&<div className="advice-products">{advice.products.map(p=><article key={p.name}><div className="product-symbol"><Heart size={22} strokeWidth={1.3}/></div><div><span className="eyebrow">FROM THE CASE-FILE SHELF</span><h3>{p.name}</h3><p>“{p.note}”</p></div><strong>£{p.price.toFixed(p.price%1?2:0)}</strong></article>)}</div>}
  <details className="advice-sources"><summary>What this answer is based on <ChevronDown size={16}/></summary>{advice.sourceRefs.map((s,i)=><div key={i}>{s.page>0?<a target="_blank" rel="noreferrer" href={`/operation-shade-case-file.pdf#page=${s.page}`}>{s.label} · page {s.page} <ArrowUpRight size={13}/></a>:<span>{s.label}</span>}<p>{s.excerpt}</p></div>)}</details>
 </div>;
}
type Props={advice:PublishedAdvice|null;onBack:()=>void;preview?:boolean;onBrowse?:()=>void;onCheckSituation?:()=>void;onOpenAdvice?:(advice:PublishedAdvice)=>void;initialContext?:DecisionContext;catalogue?:PublishedAdvice[];sharedEntry?:boolean;navigationNotice?:string};
export default function AdvicePage({advice,onBack,preview=false,onBrowse,onCheckSituation,onOpenAdvice,initialContext,catalogue,sharedEntry=false,navigationNotice}:Props){
 const [selection,setSelection]=useState<{base:PublishedAdvice;advice:PublishedAdvice}|null>(null);
 const current=!preview&&selection?.base===advice?selection.advice:advice;
 const [savedRead,setSavedRead]=useState(()=>preview?{items:[] as PublishedAdvice[]}:readSavedAdvice());
 const saved=savedRead.items;
 const [copied,setCopied]=useState(false);const [fallback,setFallback]=useState('');const [error,setError]=useState('');const [activityError,setActivityError]=useState('');
 const [context,setContext]=useState<DecisionContext>(()=>initialContext||(!preview&&advice?readDecisionContext(advice).context:undefined)||EMPTY_CONTEXT);
 const [contextNotice,setContextNotice]=useState(()=>!preview&&advice?readDecisionContext(advice).error||'':'');
 const version=current?feedbackAdviceVersion(current):'';
 useEffect(()=>{if(preview||!current)return;const result=recordFollowerEvent(current,sharedEntry?'shared-opened':'opened');if(!result.ok)setActivityError(result.error);},[version,current?.id,preview,sharedEntry]);
 if(!current)return <div className={`advice-page${preview?' advice-preview':''}`}><nav>{!preview&&<button onClick={onBrowse||onBack}><ArrowLeft size={17}/>{onBrowse?'Maya’s advice':'Back to workspace'}</button>}<span>GoodCall</span></nav><main><span className="eyebrow">{preview?'PREVIEW · NOT PUBLISHED':'THAT LINK NEEDS ANOTHER LOOK'}</span><h1>We couldn’t open this answer.</h1><p>{preview?'A complete answer is needed before it can be previewed.':'The shared link may be incomplete or invalid. Ask for a fresh link to the approved card.'}</p>{!preview&&<button className="primary" onClick={onBrowse||onBack}>{onBrowse?'Browse advice':'Open workspace'}</button>}</main></div>;
 const isSaved=saved.some(s=>sameAdvice(s,current));
 const latest=catalogue?.find(a=>a.id===current.id);
 function record(kind:'saved'|'share-copied'){const result=recordFollowerEvent(current!,kind);if(!result.ok)setActivityError(result.error);}
 function keepContext(){const result=saveDecisionContext(current!,context);setContextNotice(result.ok?'Your decision notes are saved in this browser.':result.error);return result.ok;}
 function toggleSave(){if(preview)return;const result=isSaved?removeSavedAdvice(current!):saveAdvice(current!);if(!result.ok){setError(result.error);return;}setSavedRead(readSavedAdvice());setError('');if(!isSaved){keepContext();record('saved');}}
 async function copy(){if(preview)return;let url:string;try{url=shareUrl(current!);}catch{setError('This answer could not be turned into a share link.');return;}try{await navigator.clipboard.writeText(url);setCopied(true);record('share-copied');setTimeout(()=>setCopied(false),2500);}catch{setFallback(url);}}
 function openSaved(s:PublishedAdvice){if(onOpenAdvice){onOpenAdvice(s);return;}location.hash=shareUrl(s).split('#')[1];setSelection({base:advice!,advice:s});setContext(readDecisionContext(s).context||EMPTY_CONTEXT);setContextNotice(readDecisionContext(s).error||'');setFallback('');setCopied(false);setError('');window.scrollTo(0,0);}
 return <div className={`advice-page${preview?' advice-preview':''}`}>
  <nav>{!preview&&<button onClick={onBrowse||onBack}><ArrowLeft size={17}/>{onBrowse?'Maya’s advice':'Workspace'}</button>}<span>GoodCall</span><small>{preview?'FOLLOWER PREVIEW':'YOUR ANSWER'}</small></nav>
  <main><div className="advice-kicker"><span className="eyebrow">FROM MAYA'S NOTES</span><span className="approved-tag">{preview?'Preview · not published':<><ShieldCheck size={14}/>Reviewed in this demo</>}</span></div>
   {!preview&&catalogue&&(!latest||!sameAdvice(latest,current))&&<div className="advice-version-notice" role="status"><strong>{latest?'A newer reviewed version is available on this device.':'This is a saved or shared copy.'}</strong><p>{latest?'Check the latest wording and evidence before deciding.':'This version is not in the current published collection on this device. Its current review status cannot be confirmed here.'}</p>{latest&&<button className="secondary small" onClick={()=>openSaved(latest)}>Read the latest version</button>}</div>}
   {navigationNotice&&<p role="alert">{navigationNotice}</p>}<AdviceContent advice={current}/>
   {!preview&&<>
    {onCheckSituation&&<section className="advice-personal-check"><h2>Does this fit your situation?</h2><p>A friend’s choice may have a different budget or starting point. Explore reviewed advice with your own context.</p><button className="secondary" onClick={onCheckSituation}>Check for my situation<ArrowUpRight size={15}/></button></section>}
    <details className="decision-notes" open={!!(context.goal||context.budget||context.owned||context.note)}><summary>Your decision notes · private to this browser</summary><p>Keep your question and reasons for returning. These notes are never included in the shared link.</p><div className="decision-context-grid"><label className="field">What I want to decide<input value={context.goal} maxLength={1000} onChange={e=>setContext({...context,goal:e.target.value})}/></label><label className="field">My budget<input value={context.budget} maxLength={1000} onChange={e=>setContext({...context,budget:e.target.value})}/></label><label className="field">What I already own<input value={context.owned} maxLength={1000} onChange={e=>setContext({...context,owned:e.target.value})}/></label><label className="field">Why I’m saving this<textarea value={context.note} maxLength={1000} onChange={e=>setContext({...context,note:e.target.value})}/></label></div><button className="secondary small" onClick={keepContext}>Save decision notes</button>{contextNotice&&<p role="status">{contextNotice}</p>}</details>
    <div className="advice-actions"><button className="primary" onClick={toggleSave}>{isSaved?<Check size={17}/>:<Bookmark size={17}/>} {isSaved?'Saved for later':'Save for later'}</button><button className="secondary" onClick={copy}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?'Link copied':'Share this answer'}</button></div>{(error||savedRead.error)&&<p role="alert">{error||savedRead.error}</p>}{activityError&&<p role="status">Activity could not be recorded on this device. {activityError}</p>}{fallback&&<label className="field">Copy this link<input readOnly value={fallback} onFocus={e=>e.target.select()}/></label>}<FollowerFeedback key={`${current.id}:${version}`} advice={current}/>
   </>}
   <div className="advice-footnote"><span>{preview?'Check the answer before publishing.':'About this answer'}</span><p>{preview?'This is a read-only preview of the public answer. Opening it does not publish, save or share the answer.':'Exercise prototype using fictional case-file data. This is a copy of advice approved locally on '+new Date(current.publishedAt).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})+'; it does not update when the original changes. Saves stay in this browser. Links work while this app is available at the same address.'}</p></div>
   {!preview&&saved.length>0&&<section className="saved-advice"><span className="eyebrow">YOUR SAVED ANSWERS · {saved.length}</span>{saved.map(s=><button key={s.id} onClick={()=>openSaved(s)}><Bookmark size={15}/><span>{s.title}</span><ArrowUpRight size={16}/></button>)}</section>}
  </main><footer>GoodCall <span>Advice to help you decide.</span></footer>
 </div>;
}
