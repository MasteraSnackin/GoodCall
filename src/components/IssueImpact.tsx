import type {Issue,Workspace} from '../lib/types';
import {affectedAnswers} from '../lib/issueImpact';
import './IssueImpact.css';
export default function IssueImpact({issue,workspace,onOpen}:{issue:Issue;workspace:Workspace;onOpen:(id:string)=>void}){
 const affected=affectedAnswers(issue,workspace);
 return <section className="issue-impact" aria-label="Affected answers"><h4>Affected answers <span>{affected.length}</span></h4>{affected.length?<><p>These answers share a question, product or cited source with this finding. Resolving or reopening it returns them to review. Existing shared copies stay unchanged.</p><div>{affected.map(d=><button key={d.id} className="secondary small" onClick={()=>onOpen(d.id)}><span>{d.title}</span><small>{d.status==='draft'?'Needs review':d.status}</small></button>)}</div></>:<p>No drafted answers currently reference the questions, products or exact sources identified by this finding.</p>}</section>;
}
