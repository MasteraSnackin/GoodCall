import type { CanvasCard, Question, SourceRef, Workspace } from './types';
import { detectQuestionProducts, draftAnswer, groupQuestion, runEvidenceChecks, validateDraft } from './engine';
import { mayaNotes } from './seed';
import { findCaseEvidence, caseEvidenceText } from './caseEvidence';
import { MAYA_PERSONA } from './persona';

export interface ChatMessage {
  origin?: 'local' | 'ai';
  aiModel?: string;
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  sourceRefs?: SourceRef[];
  questionText?: string;
  kind?: 'answer' | 'clarification' | 'help';
}
type Reply = Omit<ChatMessage, 'id' | 'role' | 'createdAt'>;
const HELP = 'I can explain a product, help draft an audience answer, review the selected canvas card, or summarise missing evidence. Try “Is Cloud Cream worth £38?” or “What is missing?” This chat uses local rules and the supplied evidence; no live AI service is connected.';
const clean = (text:string) => text.toLowerCase().replace(/[’']/g,'');
const sourceKey = (s:SourceRef) => `${s.page}:${s.label}:${s.excerpt}`;
const refs = (sources:SourceRef[]) => sources.filter((s,i)=>s.page>0 && !/^E-01\./.test(s.label) && sources.findIndex(x=>sourceKey(x)===sourceKey(s))===i);

function findingsSummary(holds:string[]):string {
  const displayed=holds.slice(0,4).map(h=>`• ${h.length<=1000?h:'This finding is too long to reproduce here; open the full canvas review.'}`);
  const remaining=holds.length-displayed.length;
  return `${displayed.join('\n')}${remaining?`\n\n${remaining} further finding${remaining===1?'':'s'} require review. Open this answer on the canvas to see the full validation list.`:''}`;
}

function boundedReply(reply:Reply):Reply {
  if (reply.questionText && reply.questionText.length>2000) return {kind:'clarification',text:'Please restate the current product, budget and preferences below 2,000 characters. The combined context was not added to a question or used to approve an answer.'};
  const originalRefs=reply.sourceRefs??[];
  const sourceRefs=originalRefs.filter(s=>Number.isInteger(s.page)&&s.page>0&&s.page<=999&&s.label.length<=300&&s.excerpt.length<=2000).slice(0,20);
  let result:Reply={...reply,...(reply.sourceRefs?{sourceRefs}:{})};
  if (result.text.length>7600) result={...result,kind:'clarification',text:'This response contains more detail than the chat can reliably retain. Open the selected card or Evidence & issues on the canvas for the complete wording and findings. No approval or publication has changed.'};
  if (sourceRefs.length<originalRefs.length) result.text+='\n\nAdditional supporting references are available in the full canvas review; they have not all been reproduced in chat.';
  return result;
}

function selectedQuestion(workspace:Workspace, selected?:CanvasCard):string|undefined {
  if (selected?.kind==='question') return workspace.questions.find(q=>q.id===selected.entityId)?.text;
  if (selected?.kind==='product') {
    const p=workspace.products.find(p=>p.id===selected.entityId);
    return p?`Tell me about ${p.name}.`:undefined;
  }
  if (selected?.kind==='draft') {
    const d=workspace.drafts.find(d=>d.id===selected.entityId);
    return workspace.questions.find(q=>q.id===d?.questionId)?.text;
  }
  return undefined;
}

function clarify(holds:string[]):string {
  const all=holds.join(' ');
  if (/Barrier (?:Oil|Cream)/.test(all)) return 'Which exact Barrier product do you mean? Its product record is missing.';
  if (/supported numeric format/.test(all)) return 'What is the spending limit in pounds, using digits?';
  if (/above the|exceed.*budget/.test(all)) return 'Would you like to choose within that budget, or clarify the amount? The linked product is above the stated limit.';
  if (/preference mismatch|explicitly.*(?:dislike|wants)|Clarify.*preference/.test(all)) return 'The product label conflicts with the stated skin or finish preference. Which preference should the answer address?';
  if (/shade ranges/.test(all)) return 'Which foundation and shade does the follower currently wear? The supplied file has no shade range to verify a match.';
  if (/age-specific|eye-area/.test(all)) return 'Can you provide the official age or eye-area usage instructions? The supplied case file does not answer that.';
  if (/Ingredient|clinical|ingredients|irritation/.test(all)) return 'Can you provide the official ingredient list or usage guidance? I cannot establish compatibility or clinical suitability from this case file.';
  if (/skin type/.test(all)) return 'What does the follower already use, and what would they like to change? I cannot diagnose a skin type.';
  if (/product or purchase information/.test(all)) return 'Which product page or retailer can supply that information? It is missing from the case file.';
  if (/combination|routine/.test(all)) return 'What is already in the routine, and what change is the follower looking for?';
  return 'Which product or decision do you mean? Include the budget and any relevant preferences.';
}

function answerQuestion(questionText:string,workspace:Workspace):Reply {
  if (questionText.length>2000) return {kind:'clarification',text:'The combined question and follow-ups are now too long. Please restate the product, current budget and relevant preferences in one question below 2,000 characters. I have not truncated the context or made a recommendation.'};
  const q:Question={id:'__local_chat_question__',handle:'@chat',text:questionText,intent:groupQuestion(questionText),productIds:detectQuestionProducts(questionText,workspace.products),source:{page:0,label:'Current chat question',excerpt:questionText}};
  const temporary:Workspace={...workspace,questions:[...workspace.questions.filter(x=>x.id!==q.id),q]};
  const draft=draftAnswer(q,workspace.products), holds=validateDraft(draft,temporary);
  const sourceRefs=refs(draft.sourceRefs);
  if (holds.length) return {kind:'clarification',questionText,sourceRefs,text:`${clarify(holds)}\n\nEvidence to resolve:\n${findingsSummary(holds)}\n\nThis remains a draft; no answer has been approved.`};
  return {kind:'answer',questionText,sourceRefs,text:`${draft.text}\n\nSuggested wording from the current evidence. Maya still reviews and approves it on the canvas.`};
}

/** Carry only explicit, narrowly recognised constraints into a simple alternative-product follow-up. */
function explicitConstraints(previous:string):string[] {
  const constraints:string[]=[];
  const budget=previous.match(/\b(?:my\s+)?budget(?:\s+(?:is|of))?\s*(?:£\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s+pounds?)/i)
    ?? previous.match(/\b(?:i\s+)?can\s+(?:only\s+)?spend\s*(?:£\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s+pounds?)/i);
  if (budget) constraints.push(budget[0]);
  const skin=previous.match(/\bi have\s+(dry|oily|sensitive|combination|combo)\s+skin\b/i) ?? previous.match(/\bmy skin is\s+(dry|oily|sensitive|combination|combo)\b/i);
  if (skin) constraints.push(skin[0]);
  const finish=previous.match(/\b(?:i\s+)?(?:prefer|hate|dislike|want)\s+(?:a\s+)?(?:rich|light|dewy|matte)\s+(?:finish|creams?|texture)\b/i);
  if (finish) constraints.push(finish[0]);
  return constraints;
}

function changedConstraint(previous:string,followup:string):boolean {
  const old=explicitConstraints(previous), next=explicitConstraints(followup);
  const budget=(values:string[])=>values.find(x=>/budget|spend/i.test(x))?.match(/£\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s+pounds?/i)?.slice(1).find(Boolean);
  const skin=(values:string[])=>values.find(x=>/skin/i.test(x))?.match(/\b(dry|oily|sensitive|combination|combo)\b/i)?.[1].toLowerCase();
  const a=budget(old), b=budget(next), c=skin(old), d=skin(next);
  return !!((a!==undefined&&b!==undefined&&Number(a)!==Number(b))||(c&&d&&c!==d));
}

function explainCard(workspace:Workspace,selected?:CanvasCard):Reply {
  if (!selected) return {kind:'clarification',text:'Select a question, product, note, answer or issue card on the canvas, then ask me to explain it.'};
  if (selected.kind==='issue') {
    const issue=workspace.issues.find(i=>i.id===selected.entityId);
    if (issue) return {kind:'answer',text:issue.status==='Resolved'?`${issue.title}\n\nHistorical finding: ${issue.description}\n\nStatus: Resolved.\nResolution recorded: ${issue.resolution||'No resolution detail was recorded.'}\n\nA recorded resolution does not independently approve an audience answer.`:`${issue.title}\n\n${issue.description}\n\nStatus: ${issue.status}.\nNext step: ${issue.nextAction}`,sourceRefs:refs(issue.sourceRefs)};
  }
  if (selected.kind==='evidence') {
    const evidence=findCaseEvidence(selected.entityId);
    if (evidence) return {kind:'answer',text:`${evidence.title}\n\n${caseEvidenceText(evidence)}`,sourceRefs:refs(evidence.sourceRefs)};
  }
  if (selected.kind==='note') {
    const note=mayaNotes.find(n=>n.id===selected.entityId);
    if (note) return {kind:'answer',text:`${note.title}\n\n${note.text}`,sourceRefs:refs([note.source])};
  }
  if (selected.kind==='draft') {
    const d=workspace.drafts.find(d=>d.id===selected.entityId);
    if (d) {
      const holds=validateDraft(d,workspace);
      return {kind:holds.length?'clarification':'answer',questionText:workspace.questions.find(q=>q.id===d.questionId)?.text,sourceRefs:refs(d.sourceRefs),text:`${d.title}\n\nStatus: ${d.status}.${holds.length?`\n\n${clarify(holds)}\n${findingsSummary(holds)}`:`\n\n${d.text}\n\nThe local checks found no listed issue. Maya’s review is still required; this chat changes no approval or publication state.`}`};
    }
  }
  const question=selectedQuestion(workspace,selected);
  return question?answerQuestion(question,workspace):{kind:'clarification',text:'That card is no longer available. Select a current card and try again.'};
}

/** A local, bounded conversation router. No network, workspace writes or approval/publication actions. */
export function respondToChat(text:string,workspace:Workspace,history:ChatMessage[],selected?:CanvasCard):Reply {
  return boundedReply(routeChat(text,workspace,history,selected));
}

function routeChat(text:string,workspace:Workspace,history:ChatMessage[],selected?:CanvasCard):Reply {
  const input=text.trim(), t=clean(input);
  if (!input || /^(?:hi|hello|hey|help|what can you do|how does this work)[!?.\s]*$/.test(t)) return {kind:'help',text:HELP};
  if (input.length>2000) return {kind:'clarification',text:'Please keep the question below 2,000 characters and focus on one decision.'};
  if (/\byour approach\b|\bmayas approach\b|\byour writing style\b/.test(t)) return {kind:'answer',text:`${MAYA_PERSONA.approach}\n\nThat approach comes from Maya’s case-file notes. This is a local evidence helper; Maya still reviews the final wording.`,sourceRefs:refs(mayaNotes.filter(n=>n.id==='notebook-questions'||n.id==='maya-judgement').map(n=>n.source))};
  if (/^(?:(?:can|could|will) you\s+|please\s+)?(?:publish|approve|post|email|delete|place an order|purchase)\b/.test(t)) return {kind:'help',text:'This chat can explain evidence and suggest wording. Use the canvas review controls to approve or publish an answer; chat does not change the workspace or send messages.'};
  if (/(?:whats|what is|show|summarise|summarize|list).*(?:missing|issues|inconsistenc|evidence report)|\bmissing materials\b|\bevidence report\b/.test(t)) {
    const issues=runEvidenceChecks(workspace),open=issues.filter(i=>i.status!=='Resolved');
    return {kind:'answer',sourceRefs:refs(open.flatMap(i=>i.sourceRefs)).slice(0,12),text:open.length?`There are ${open.length} open or checking findings in the supplied records.\n\n${open.map(i=>`• ${i.title} — ${i.nextAction}`).join('\n')}\n\nThese are the case-file checks, not a general document audit. Open Evidence & issues to review or export them.`:'The current case-file checks are marked resolved. Those statuses do not independently verify product suitability or approve an answer.'};
  }
  if (/\b(?:selected|this) (?:card|question|product|draft|answer|issue|note)\b|^explain (?:this|selection)[?.!]*$/.test(t)) return explainCard(workspace,selected);
  if (/^(?:thanks|thank you|cheers)[!?.\s]*$/.test(t)) return {kind:'help',text:'Keep the evidence attached and make the call on the canvas. What needs a closer look next?'};

  const lastAssistant=[...history].reverse().find(m=>m.role==='assistant');
  // A help/report/unrelated turn ends the active question context instead of searching older private messages.
  const previous=lastAssistant?.questionText;
  const named=detectQuestionProducts(input,workspace.products);
  if (named.length) {
    const previousProducts=previous?detectQuestionProducts(previous,workspace.products):[];
    if (previous && named.length===1 && !previousProducts.includes(named[0]) && /^(?:and\s+)?(?:what|how) about\s+/i.test(input) && input.replace(/[?!.]/g,'').trim().split(/\s+/).length<=7) {
      const constraints=explicitConstraints(previous);
      return answerQuestion([input,...constraints].join('\n'),workspace);
    }
    // A distinct standalone named question starts fresh; no old free text is copied across topics.
    return answerQuestion(input,workspace);
  }
  const followup=/^(?:and\s+|but\s+|also\s+|actually\s+)?(?:my budget\b|i (?:can|have|already|prefer|hate|dislike|dont|do not)\b|my skin\b|£\s*\d|\d+\s+pounds?\b|(?:dry|oily|sensitive|combination) skin\b|what about it\b|is it\b|does it\b|can i use it\b)/.test(t);
  if (followup) {
    const selectionContext=selectedQuestion(workspace,selected);
    if (previous && selectionContext) {
      const activeIds=detectQuestionProducts(previous,workspace.products), selectedIds=detectQuestionProducts(selectionContext,workspace.products);
      if (activeIds.length && selectedIds.length && (activeIds.length!==selectedIds.length||activeIds.some(id=>!selectedIds.includes(id)))) return {kind:'clarification',text:'The selected card and the previous chat question concern different products. Which product should this follow-up apply to? Name it with the current budget or preference so I use the right evidence.'};
    }
    const base=previous??selectedQuestion(workspace,selected);
    if (!base) return {kind:'clarification',text:'Which product is this about? Give its name so I can keep the budget and preferences attached to the right question.'};
    const priorIds=detectQuestionProducts(base,workspace.products);
    if (priorIds.length>1) return {kind:'clarification',text:'Which of the products are you continuing with? Name one so I do not mix their evidence or treat alternatives as a basket.'};
    if (changedConstraint(base,input)) return {kind:'clarification',text:'That changes a budget or skin preference from the earlier question. Please restate the product and current preferences together so I can replace the earlier context rather than combine conflicting details.'};
    return answerQuestion(`${base}\nFollow-up: ${input}`,workspace);
  }
  if (/barrier (?:oil|cream)|\b(?:shade|routine|skincare|moisturiser|skin|redness)\b/.test(t)) return answerQuestion(input,workspace);
  return {kind:'help',text:'I do not have evidence to answer that question. I can help with the supplied product catalogue, audience questions, selected canvas cards and missing-material reports. Which of those would you like to explore?'};
}
