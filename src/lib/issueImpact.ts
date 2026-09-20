import type {Draft,Issue,Workspace} from './types';

/** A dependency is an explicit question, product or exact cited source, never just a page match. */
export function affectedAnswers(issue:Issue,workspace:Workspace):Draft[]{
 if(issue.severity==='Admin only')return [];
 return workspace.drafts.filter(d=>issue.questionIds.includes(d.questionId)||d.productIds.some(id=>issue.productIds.includes(id))||d.sourceRefs.some(s=>issue.sourceRefs.some(ref=>s.page===ref.page&&s.label===ref.label&&s.excerpt===ref.excerpt)));
}
export function updateIssueWithReview(workspace:Workspace,id:string,patch:Partial<Issue>,now=new Date().toISOString()):Workspace{
 const issue=workspace.issues.find(i=>i.id===id);if(!issue)return workspace;
 const changedStatus=patch.status!==undefined&&patch.status!==issue.status;
 const ids=new Set(changedStatus&&patch.status!=='Checking'?affectedAnswers(issue,workspace).map(d=>d.id):[]);
 return {...workspace,issues:workspace.issues.map(i=>i.id===id?{...i,...patch}:i),drafts:workspace.drafts.map(d=>ids.has(d.id)?{...d,status:'draft',approvedAt:undefined,publishedAt:undefined,updatedAt:now}:d)};
}
