import type { Issue, Product, Question, SourceRef, Workspace } from './types';

const source = (page: number, label: string, excerpt: string): SourceRef => ({ page, label, excerpt });
export const mayaNotes = [
  { id: 'notebook-routing', title: 'Maya’s recommendation notes', text: 'Dry → Cloud Cream + Barrier Oil. Oily → Daily Gel. Sensitive → avoid fragrance. Redness → Red Reset. Shade questions → ask current foundation. Barrier Oil is not in the supplied catalogue; ingredient and shade data are also missing.', source: source(6, 'E-02.2 · Recovered notebook', 'DRY →  Cloud Cream + Barrier\nOil\nOILY →  Daily Gel\nSENSITIVE →  avoid fragrance\nREDNESS →  Red Reset\nshade questions = ask current\nfoundation') },
  { id: 'notebook-questions', title: 'Ask before recommending', text: 'Skin type, current products, what they dislike, budget and preferred finish. Keep these individual constraints when grouping similar questions.', source: source(6, 'E-02.1 · What Maya asks', 'Skin type?\nWhat are you using now?\nWhat do you hate about it?\nBudget?\nWhat finish do you like?') },
  { id: 'maya-voice', title: 'Keep the relationship', text: 'Maya wants to stop repeating the same answer while keeping her personal judgement and relationship with followers. A written transcript is supplied; the recording itself is missing.', source: source(10, 'E-06.1 · Voice-note transcript', 'I just do\nnot want to answer the same question 400\ntimes. People follow me because they trust my\ntaste.') },
  { id: 'maya-judgement', title: 'Specific, honest, decisive', text: 'Maya’s voice is dry, funny and decisive. Her judgement includes saying what is not worth buying. Draft wording is a suggested template until she reviews it.', source: source(3, 'Subject file · Reputation', 'Her audience follows her\nbecause she is specific, honest and\nwilling to say what is not worth\nbuying.') },
];

export function seedProducts(): Product[] {
  const rows: [string,string,number,string,string,string,number,string][] = [
    ['cloud-cream','Cloud Cream',38,'Moisturiser','Dry','Rich',9.2,'My winter skin saviour.'],
    ['daily-gel','Daily Gel',24,'Moisturiser','Oily / Combo','Light',8.1,'Easy. No drama.'],
    ['red-reset','Red Reset',32,'Serum','Sensitive','Calm',9.5,'For angry skin days.'],
    ['night-serum','Night Serum',42,'Serum','All','Glow',8.8,'Best for texture.'],
    ['spf-50','SPF 50',26,'SPF','All','Invisible',9.6,'Non-negotiable.'],
    ['glass-drop','Glass Drop',62,'Serum','All','Dewy',8.1,'Good. Not £62 good.'],
    ['soft-clean','Soft Clean',22,'Cleanser','All','Cream',8.6,'Boring in the best way.'],
    ['oil-balm','Oil Balm',29,'Balm','Dry','Glow',7.7,'Beautiful, but too much for me.'],
    ['clear-wash','Clear Wash',20,'Cleanser','Oily','Foam',8.0,'Great after gym.'],
    ['tint-veil','Tint Veil',34,'Base','All','Skin-like',9.0,'Best on camera.'],
  ];
  return rows.map(([id,name,price,type,skin,finish,score,note], i) => ({ id,name,price,type,skin,finish,score,note, revision: 1,
    source: source(8, `E-04.${i + 1} · Product inventory`, `${name} ${price} ${type}`),
  }));
}

export function seedQuestions(): Question[] {
  const rows: [string,string,Question['intent'],string[]][] = [
    ['@ellie.mp','what shade are u wearing in todays video???','Missing context',[]],
    ['@gracelee','i have dry skin + redness and £60. tell me what to buy pls','Routine & budget', ['cloud-cream','red-reset']],
    ['@ameliaxo','okay but if u could only keep ONE of these which one','Personal recommendation',[]],
    ['@sarah','is the cloud cream actually worth £38 or am i being influenced','Product value',['cloud-cream']],
    ['@jessica','i already have the night serum. do i need the barrier cream too???','Routine & budget',['night-serum']],
    ['@niamh','i dont even know what my skin type is lol','Missing context',[]],
    ['@olivia','i trust you more than Sephora tbh','Relationship & trust',[]],
    ['@kate','Maya I have a first date Friday HELP','Relationship & trust',[]],
    ['@joanna','can you make me a routine but only 2 products bc i will not do 8 steps','Routine & budget',[]],
    ['@mia','I saw the thing you recommended last week. buying it payday','Missing context',[]],
    ['@lucy','not a beauty question but what would you do if it was your money?','Personal recommendation',[]],
    ['@roisin','can you send me the one you would buy if you were me','Personal recommendation',[]],
  ];
  return rows.map(([handle,text,intent,productIds],i) => ({id: `q-${String(i+1).padStart(2,'0')}`,handle,text,intent,productIds,
    source: source(5,`E-01.${i+1} · Audience question`,text),
  }));
}

/** These are bounded case-file checks, not an automatic audit of arbitrary uploads. */
export function createCaseIssues(products: Product[]): Issue[] {
  const exists = (name: string) => products.some(p => p.name.toLowerCase() === name.toLowerCase());
  const base = (issue: Omit<Issue,'status'>): Issue => ({...issue,status:'Open'});
  const issues: Issue[] = [];
  if (!exists('Barrier Oil')) issues.push(base({id:'issue-barrier-oil',title:'Barrier Oil is missing from the catalogue',kind:'Missing material',area:'Audience advice',severity:'Blocks affected answer',description:'Maya’s dry-skin route names Barrier Oil. The ten-product inventory does not identify it. Oil Balm is listed separately; treating the two as the same product would be an assumption.',sourceRefs:[source(6,'E-02.2 · Dry-skin route','DRY →  Cloud Cream + Barrier\nOil'),source(8,'E-04.8 · Different listed product','Oil Balm 29 Balm Dry Glow 7.7')],nextAction:'Ask Maya to identify Barrier Oil and provide a verified product record. Do not substitute Oil Balm.',questionIds:['q-02'],productIds:[]}));
  if (!exists('Barrier Cream')) issues.push(base({id:'issue-barrier-cream',title:'Barrier Cream has no product record',kind:'Missing material',area:'Audience advice',severity:'Blocks affected answer',description:'A follower asks whether they need Barrier Cream alongside Night Serum, but Barrier Cream is absent from the supplied inventory. Its identity and the relationship between the products are unknown.',sourceRefs:[source(5,'E-01.5 · Audience question','i already have the night serum.\ndo i need the barrier cream\ntoo???'),source(8,'E-04.4 · Known product','Night Serum 42 Serum All Glow 8.8')],nextAction:'Confirm which Barrier Cream the follower means and obtain evidence for the proposed combination.',questionIds:['q-05'],productIds:['night-serum']}));
  issues.push(base({id:'issue-audio',title:'The original voice recording is missing',kind:'Missing material',area:'Case-file report',severity:'Needs review',description:'The PDF supplies a transcript but its QR area is a placeholder. Voice or timing analysis cannot be verified against an original audio file.',sourceRefs:[source(10,'E-06 · Recording reference','Scan the case QR to hear the original recording. Transcript\nbelow.'),source(10,'E-06.2 · Placeholder','QR\nPLACEHOLDER')],nextAction:'Request the recording or a working link. Use the supplied transcript as text evidence meanwhile.',questionIds:[],productIds:[]}));
  issues.push(base({id:'issue-photos',title:'Item photographs and receipt details are unavailable',kind:'Missing material',area:'Case-file report',severity:'Needs review',description:'The four seized-item images are labelled ITEM PHOTO. The receipt is described as containing a crossed-out item, but its actual contents are not supplied.',sourceRefs:[source(11,'E-07 · Image placeholder','ITEM PHOTO'),source(11,'E-07.2 · Receipt','RECEIPT\nThree items, one crossed out twice.')],nextAction:'Request the four images, including a legible receipt, before drawing conclusions from them.',questionIds:[],productIds:[]}));
  const cloud=products.find(p=>p.id==='cloud-cream'), spf=products.find(p=>p.id==='spf-50');
  if (cloud && spf && cloud.price+spf.price!==94) issues.push(base({id:'issue-alice',title:'Alice’s basket and order value need reconciliation',kind:'Needs clarification',area:'Case-file report',severity:'Needs review',description:`The named Cloud Cream + SPF basket totals £${cloud.price+spf.price}; the behavioural sample records £94. This is a discrepancy only if both entries describe the same order. The three-week saving history and seven-day purchase lag also lack a shared definition.`,sourceRefs:[source(9,'E-05.5 · Tracked journey','Alice / 34 Never DM’d →  saved 7 posts over 3 weeks →  bought Cloud Cream +\nSPF →  returned 19 days later.'),source(15,'E-10.3 · Behavioural sample','E-10.3 Alice 0 7 4 3 YES 7d £94'),cloud.source,spf.source],nextAction:'Confirm the order identity, basket contents and starting point used to measure purchase lag.',questionIds:[],productIds:['cloud-cream','spf-50']}));
  issues.push(base({id:'issue-dm-definition',title:'The DM category and statistic use different groups',kind:'Conflicting information',area:'Case-file report',severity:'Needs review',description:'The category is labelled 0–1 DMs, while the statistic describes buyers who sent no DM. Zero messages and zero-to-one messages are different groups.',sourceRefs:[source(14,'E-09.2 · DM category','E-09.2 0–1 DMS 61% of repeat buyers sent no DM before purchase')],nextAction:'Confirm whether the intended category includes one DM, then align the label and statistic.',questionIds:[],productIds:[]}));
  issues.push(base({id:'issue-buyers',title:'The best-buyer claim needs its comparison data',kind:'Needs clarification',area:'Case-file report',severity:'Needs review',description:'The 61% repeat-buyer statistic and ten-person sample do not establish comparative purchase rates or value for the full DM and non-DM audiences. The headline is a case-file claim, not a calculation validated here.',sourceRefs:[source(14,'E-09.1 · Headline','THE CUSTOMERS WHO DM MAYA ARE NOT HER BESTBUYERS'),source(14,'E-09.2 · Reported statistic','61% of repeat buyers sent no DM before purchase'),source(15,'E-10 · Sample scope','A sample from the behavioural file released at 16:00.')],nextAction:'Request group sizes, value definitions and comparable spend and conversion data. Treat the quiet-follower opportunity as a hypothesis.',questionIds:[],productIds:[]}));
  issues.push(base({id:'issue-conversions',title:'Comparable conversion figures are missing',kind:'Missing material',area:'Case-file report',severity:'Needs review',description:'Only the morning-routine post includes an affiliate-conversion figure. The commercial ranking of all six posts cannot be checked from the supplied table.',sourceRefs:[source(7,'E-03.5 · Morning routine','18K views 1.2K likes 4.6K saves 312 comments 317 affiliate conversions'),source(12,'E-08.2 · Commercial claim','The biggest post: 74K views. Not the strongest commerce\nsignal.')],nextAction:'Request comparable conversion, revenue and attribution figures for each post.',questionIds:[],productIds:[]}));
  issues.push(base({id:'issue-pitch',title:'The presentation durations disagree',kind:'Conflicting information',area:'Case-file report',severity:'Admin only',description:'The brief asks for a demo under one minute; the final page says 90 seconds and then allocates 30 + 90 + 60 seconds, which totals three minutes.',sourceRefs:[source(2,'Deliverable','A working demo you can\nshow in under a minute.'),source(17,'The getaway','90 seconds. Product first. No deck.'),source(17,'Timed sections','30 sec THE TARGET\nWhat were you stealing?\n90 sec THE HEIST\nShow what you built.\n60 sec THE SCORE')],nextAction:'Ask the organiser to confirm the total pitch duration and the product-demo allowance.',questionIds:[],productIds:[]}));
  issues.push(base({id:'issue-schedule',title:'The judging schedule needs clarification',kind:'Needs clarification',area:'Case-file report',severity:'Admin only',description:'The checkpoints set Maya’s arrival at 17:00 and the pitch at 20:00. The page headed 17:00 says judges take their stand at 18:00. These may be separate stages, but their relationship is not explained.',sourceRefs:[source(2,'Checkpoints','16:00 intelligence\ndrop. 17:00 Maya walks\nin. 20:00 you pitch.'),source(16,'Judging','At 18:00 the Judges take their stand.')],nextAction:'Confirm whether 17:00, 18:00 and 20:00 are separate review, judging and pitch stages.',questionIds:[],productIds:[]}));
  return issues;
}

export function createWorkspace(): Workspace {
  const products=seedProducts(), questions=seedQuestions(), at=new Date().toISOString();
  return {version:1,products,questions,issues:createCaseIssues(products),drafts:[],
    cards:[
      {id:'card-q-04',kind:'question',entityId:'q-04',x:40,y:40},
      {id:'card-q-05',kind:'question',entityId:'q-05',x:40,y:350},
      {id:'card-cloud-cream',kind:'product',entityId:'cloud-cream',x:410,y:40},
      {id:'card-routing',kind:'note',entityId:'notebook-routing',x:410,y:350},
      {id:'card-barrier-issue',kind:'issue',entityId:'issue-barrier-cream',x:800,y:350},
    ],links:[
      {id:'link-cloud-evidence',source:'card-q-04',target:'card-cloud-cream'},
      {id:'link-barrier-missing',source:'card-q-05',target:'card-barrier-issue'},
    ],activity:[{id:'activity-start',text:'Loaded the 12 questions, 10 products and case-file evidence. No external account is connected.',at}]};
}
