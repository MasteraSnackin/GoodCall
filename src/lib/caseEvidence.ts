import type { SourceRef } from './types';

export const CASE_EVIDENCE_CATEGORIES = ['Creator', 'Audience', 'Content', 'Behaviour', 'Case clues', 'Brief'] as const;
export type CaseEvidenceCategory = typeof CASE_EVIDENCE_CATEGORIES[number];

export interface CaseEvidence {
  id: string;
  category: CaseEvidenceCategory;
  title: string;
  summary: string;
  details: string[];
  sourceRefs: SourceRef[];
  table?: { columns: string[]; rows: string[][] };
  caveat?: string;
  relatedIssueIds?: string[];
  relatedProductIds?: string[];
}

const source = (page: number, label: string, excerpt: string): SourceRef => ({ page, label, excerpt });

/** The catalogue is source material, not editable workspace state or execution instructions. */
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const CASE_EVIDENCE: CaseEvidence[] = freeze<CaseEvidence[]>([
  {
    id: 'case-creator-constraints', category: 'Creator', title: 'One creator, a growing reply burden',
    summary: 'Maya runs the business alone. Her value is specific judgement, and her pet peeve is generic automation.',
    details: [
      'The case describes Maya as a 29-year-old London beauty and skincare creator with 35K Instagram followers and 15K TikTok followers.',
      'The briefing reports 4.8K DMs and more than 70 hours of reply time per month, with one person running the business.',
      'Her business combines affiliate income, brand deals and UGC. Her community is described as high intent and high trust.',
      'Her language is dry, funny and decisive. Her reputation rests on being specific, honest and willing to say what is not worth buying.',
    ],
    sourceRefs: [
      source(2, 'Briefing 01 · Scale and team', '50K TOTAL FOLLOWERS\n4.8K DMS / MONTH\n70+ hrs REPLY TIME / MONTH\n1 PERSON RUNNING THE BUSINESS'),
      source(3, 'Subject file · Creator profile', '29 // London\n35K Instagram 15K TikTok\nBUSINESS Affiliate + brand deals + UGC\nTEAM Maya\nPET PEEVE Generic automation\nLANGUAGE Dry, funny, decisive'),
      source(3, 'Subject file · Reputation', 'Her audience follows her because she is specific, honest and willing to say what is not worth buying.'),
    ],
    caveat: 'These are case-file profile and workload figures, not live account analytics.',
  },
  {
    id: 'case-audience-emily', category: 'Audience', title: 'Emily · Confidence within a budget',
    summary: 'Emily is 22 and price sensitive. Trust does not remove her spending limit.',
    details: ['“I trust you, but I am not spending £100 on serum.”', 'The case identifies her need as confidence within a budget.'],
    sourceRefs: [source(4, 'Known associates · Emily', 'EMILY / 22 PRICE SENSITIVE\n“I trust you, but I am not spending £100 on serum.”\nNeeds confidence within a budget.')],
  },
  {
    id: 'case-audience-priya', category: 'Audience', title: 'Priya · Reassurance and compatibility',
    summary: 'Priya is 31 and describes sensitive skin. Trying something new feels risky to her.',
    details: ['“Every time I try something new my face freaks out.”', 'The case identifies her need as reassurance and compatibility.'],
    sourceRefs: [source(4, 'Known associates · Priya', 'PRIYA / 31 SENSITIVE SKIN\n“Every time I try something new my face freaks out.”\nNeeds reassurance + compatibility.')],
    caveat: 'This audience profile does not establish a diagnosis or product compatibility.',
  },
  {
    id: 'case-audience-sophie', category: 'Audience', title: 'Sophie · Maya’s personal judgement',
    summary: 'Sophie is 27 and a beauty obsessive. She wants to know what Maya would choose.',
    details: ['“Forget the brand. What would YOU buy?”', 'The case says she wants Maya’s judgement, not facts alone.'],
    sourceRefs: [source(4, 'Known associates · Sophie', 'SOPHIE / 27 BEAUTY OBSESSIVE\n“Forget the brand. What would YOU buy?”\nWants Maya’s judgement, not facts.')],
  },
  {
    id: 'case-audience-hannah', category: 'Audience', title: 'Hannah · Fewer choices',
    summary: 'Hannah is 24 and overwhelmed by the number of options.',
    details: ['“There are 500 versions of this. Just tell me.”', 'The case identifies her need as fewer choices, not more.'],
    sourceRefs: [source(4, 'Known associates · Hannah', 'HANNAH / 24 OVERWHELMED\n“There are 500 versions of this. Just tell me.”\nNeeds fewer choices, not more.')],
  },
  {
    id: 'case-audience-grace', category: 'Audience', title: 'Grace · Two things that matter',
    summary: 'Grace is 33 and busy. She wants a quick, practical decision.',
    details: ['“I have 5 mins. Give me the two things that matter.”', 'The case identifies her need as fast, practical decisions.'],
    sourceRefs: [source(4, 'Known associates · Grace', 'GRACE / 33 BUSY\n“I have 5 mins. Give me the two things that matter.”\nNeeds fast, practical decisions.')],
    caveat: 'The case does not establish whether this Grace and the @gracelee DM on page 5 are the same person.',
  },
  {
    id: 'case-audience-alex', category: 'Audience', title: 'Alex · The quiet follower',
    summary: 'Alex is 28, saves almost everything and sends almost nothing. Low visible engagement can hide intent.',
    details: ['The case describes Alex as a silent browser with high intent and low visible engagement.', 'The page suggests that the quiet profile may be especially valuable; it does not provide an individual purchase history for Alex.'],
    sourceRefs: [source(4, 'Known associates · Alex', 'ALEX / 28 SILENT BROWSER\nSaves almost everything. Sends almost nothing.\nHigh intent, low visible engagement.\nSix profiles. Only one of them is quiet, and she may be the most valuable.')],
    caveat: 'Alex’s profile is separate from the named behavioural sample on page 15.',
  },
  {
    id: 'case-inbox-intent', category: 'Audience', title: 'The question underneath the question',
    summary: 'The case frames the 12 DMs as requests for Maya’s judgement, even when they look like simple product questions.',
    details: [
      'The supplied labels cover information, recommendation, judgement, value, context, diagnosis, trust, relationship, constraint, delayed intent, transfer of trust and personalisation.',
      'The messages include a £60 budget, a two-product limit, an already-owned serum and a plan to buy on payday. These constraints belong to the individual question.',
      'Maya’s judgement is also requested outside beauty: one follower asks what she would do if it were her money.',
    ],
    sourceRefs: [
      source(5, 'E-01 · Intercepts and clue', '24 hours of DM traffic. Most of it looks simple. It is not.\nThe inbox is noisy. The language underneath it is consistent: what would Maya do?'),
      source(5, 'E-01.2, E-01.9 and E-01.10 · Constraints', 'i have dry skin + redness and £60. tell me what to buy pls\ncan you make me a routine but only 2 products bc i will not do 8 steps\nI saw the thing you recommended last week. buying it payday'),
      source(5, 'E-01.11 · Transfer of trust', 'not a beauty question but what would you do if it was your money?'),
    ],
    caveat: '“Diagnosis” is the document’s label for a message, not a diagnosis made by the app. The 12-message extract is not the full monthly inbox.',
  },
  {
    id: 'case-content-log', category: 'Content', title: 'Six posts: reach, saves and one conversion figure',
    summary: 'The five-minute routine has 18K views, 4.6K saves and 317 reported affiliate conversions. Most posts have no supplied conversion figure.',
    details: ['The highest reported view count belongs to the skin-difficulties post. The routine post has the highest reported saves in this six-post log.', 'The case uses the log to draw attention to intent beyond visible reach.'],
    table: {
      columns: ['Post', 'Views', 'Likes', 'Saves', 'Comments', 'Affiliate conversions'],
      rows: [
        ['3 things I would repurchase with £50', '48K', '4.2K', '1.9K', '812', 'Not supplied'],
        ['Things I bought because TikTok told me to', '29K', '2.1K', '1.4K', '496', 'Not supplied'],
        ['My skin has been a nightmare lately', '74K', '5.8K', '3.2K', '1.1K', 'Not supplied'],
        ['Luxury vs drugstore: where should your money go?', '51K', '4.4K', '2.7K', '702', 'Not supplied'],
        ['My 5-minute morning routine', '18K', '1.2K', '4.6K', '312', '317'],
        ['The product I would NOT rebuy', '26K', '1.9K', '3.1K', '624', 'Not supplied'],
      ],
    },
    sourceRefs: [
      source(7, 'E-03.1 · £50 repurchase post', '3 things I would repurchase with £50\n48K views 4.2K likes 1.9K saves 812 comments'),
      source(7, 'E-03.2 · TikTok purchases', 'Things I bought because TikTok told me to\n29K views 2.1K likes 1.4K saves 496 comments'),
      source(7, 'E-03.3 · Skin difficulties', 'My skin has been a nightmare lately\n74K views 5.8K likes 3.2K saves 1.1K comments'),
      source(7, 'E-03.4 · Luxury versus drugstore', 'Luxury vs drugstore: where should your money go?\n51K views 4.4K likes 2.7K saves 702 comments'),
      source(7, 'E-03.5 · Morning routine', 'My 5-minute morning routine\n18K views 1.2K likes 4.6K saves 312 comments 317 affiliate conversions'),
      source(7, 'E-03.6 · Would not rebuy', 'The product I would NOT rebuy\n26K views 1.9K likes 3.1K saves 624 comments'),
    ],
    caveat: 'Missing conversion values are not zero. The log does not establish a commercial ranking across all six posts or provide revenue and attribution methods.',
    relatedIssueIds: ['issue-conversions'],
  },
  {
    id: 'case-movement-counts', category: 'Behaviour', title: 'Questions and personal replies',
    summary: 'The movement report supplies four activity counts, including 6,219 “what should I buy?” questions and 1,847 personal answers.',
    details: ['These figures describe activity in the supplied movement report. The page does not define a reporting period, a denominator or whether the categories overlap.'],
    table: {
      columns: ['Reference', 'Measure', 'Reported count'],
      rows: [
        ['E-05.1', 'Beauty-related comments', '38,421'],
        ['E-05.2', 'Product questions', '11,804'],
        ['E-05.3', '“What should I buy?” questions', '6,219'],
        ['E-05.4', 'Maya answered personally', '1,847'],
      ],
    },
    sourceRefs: [source(9, 'E-05.1–E-05.4 · Movement report', '38,421 BEAUTY-RELATED COMMENTS\n11,804 PRODUCT QUESTIONS\n6,219 “WHAT SHOULD I BUY?” QUESTIONS\n1,847 MAYA ANSWERED PERSONALLY')],
    caveat: 'Do not combine these counts with the monthly DM figure or the later 90-day findings to calculate a reply or conversion rate.',
  },
  {
    id: 'case-tracked-journeys', category: 'Behaviour', title: 'Four journeys beyond the inbox',
    summary: 'Saving, sharing, waiting and returning appear in the four narrative journeys on page 9.',
    details: ['The report’s observation is that the visible audience and the valuable audience are not necessarily the same people.'],
    table: {
      columns: ['Person', 'Journey as supplied'],
      rows: [
        ['Rina · 26', 'Watched 3 videos → saved 2 → visited affiliate link → returned 4 days later → bought.'],
        ['Megan · 23', 'Watched “£50” post → sent to friend → friend asked Maya in comments → bought same day.'],
        ['Alice · 34', 'Never DM’d → saved 7 posts over 3 weeks → bought Cloud Cream + SPF → returned 19 days later.'],
        ['Naomi · 28', 'Asked which serum → got answer → did not buy → returned 6 weeks later after seeing routine content.'],
      ],
    },
    sourceRefs: [source(9, 'E-05.5 · Tracked journeys', 'Rina / 26 Watched 3 videos → saved 2 → visited affiliate link → returned 4 days later → bought.\nMegan / 23 Watched “£50” post → sent to friend → friend asked Maya in comments → bought same day.\nAlice / 34 Never DM’d → saved 7 posts over 3 weeks → bought Cloud Cream + SPF → returned 19 days later.\nNaomi / 28 Asked which serum → got answer → did not buy → returned 6 weeks later after seeing routine content.')],
    caveat: 'These narratives and the page 15 rows are separate records. Shared names do not establish the same order, observation window or lag definition.',
    relatedIssueIds: ['issue-alice'], relatedProductIds: ['cloud-cream', 'spf-50'],
  },
  {
    id: 'case-quiet-audience-findings', category: 'Behaviour', title: 'Quiet intent: the reported 90-day findings',
    summary: 'The intelligence drop reports that high-value customers often save, share privately and return later, including people who never message Maya.',
    details: ['Page 14 describes 90 days of audience behaviour against commerce activity.', 'Its headline says customers who DM Maya are not her best buyers. The underlying comparison dataset and value definition are not supplied.'],
    table: {
      columns: ['Reference', 'Signal label', 'Reported finding'],
      rows: [
        ['E-09.2', '0–1 DMs', '61% of repeat buyers sent no DM before purchase'],
        ['E-09.3', 'Saves', 'Top-decile savers converted 2.4x more than average'],
        ['E-09.4', 'Private shares', '41% of high-value buyers first encountered Maya through a share from a friend'],
        ['E-09.5', 'Time', 'Median purchase lag after first content exposure: 4.6 days'],
      ],
    },
    sourceRefs: [
      source(14, 'E-09.1 · Reported finding', '90 days of audience behaviour against Maya’s commerce activity.\nTHE CUSTOMERS WHO DM MAYA ARE NOT HER BESTBUYERS\nHer highest-value customers are more likely to save, privately share and return later. Many never message her at all.'),
      source(14, 'E-09.2–E-09.5 · Reported statistics', '0–1 DMS 61% of repeat buyers sent no DM before purchase\nSAVES Top-decile savers converted 2.4x more than average\nPRIVATE SHARES 41% of high-value buyers first encountered Maya through a share from a friend\nTIME Median purchase lag after first content exposure: 4.6 days'),
    ],
    caveat: 'These are reported case-file claims, not results calculated from the ten-row sample. “0–1 DMs” and “no DM” describe different groups; the definitions need clarification.',
    relatedIssueIds: ['issue-dm-definition', 'issue-buyers'],
  },
  {
    id: 'case-hidden-audience-sample', category: 'Behaviour', title: 'The ten-person behavioural sample',
    summary: 'Page 15 supplies ten example records covering DMs, saves, shares, returns, buying, lag and order value.',
    details: ['The source calls this a sample from the behavioural file released at 16:00. It does not state how the ten people were selected.', '“Return” is the source column label; the count’s definition is not supplied.'],
    table: {
      columns: ['Reference', 'User', 'DMs', 'Saves', 'Shares', 'Return', 'Buy', 'Lag', 'Order'],
      rows: [
        ['E-10.1', 'Rina', '0', '8', '3', '4', 'Yes', '4d', '£71'],
        ['E-10.2', 'Megan', '1', '2', '6', '2', 'Yes', '1d', '£38'],
        ['E-10.3', 'Alice', '0', '7', '4', '3', 'Yes', '7d', '£94'],
        ['E-10.4', 'Naomi', '2', '3', '0', '2', 'No', '—', '—'],
        ['E-10.5', 'Tara', '0', '11', '2', '5', 'Yes', '3d', '£122'],
        ['E-10.6', 'Liv', '4', '1', '0', '1', 'No', '—', '—'],
        ['E-10.7', 'Zoe', '0', '9', '5', '4', 'Yes', '6d', '£86'],
        ['E-10.8', 'Ella', '3', '2', '1', '1', 'No', '—', '—'],
        ['E-10.9', 'Mila', '0', '5', '4', '3', 'Yes', '2d', '£64'],
        ['E-10.10', 'Nora', '1', '1', '0', '1', 'No', '—', '—'],
      ],
    },
    sourceRefs: [source(15, 'E-10.1–E-10.10 · Hidden audience sample', 'A sample from the behavioural file released at 16:00.\nREF USER DM SAVES SHARES RETURN BUY LAG ORDER\nE-10.1 Rina 0 8 3 4 YES 4d £71\nE-10.2 Megan 1 2 6 2 YES 1d £38\nE-10.3 Alice 0 7 4 3 YES 7d £94\nE-10.4 Naomi 2 3 0 2 NO – –\nE-10.5 Tara 0 11 2 5 YES 3d £122\nE-10.6 Liv 4 1 0 1 NO – –\nE-10.7 Zoe 0 9 5 4 YES 6d £86\nE-10.8 Ella 3 2 1 1 NO – –\nE-10.9 Mila 0 5 4 3 YES 2d £64\nE-10.10 Nora 1 1 0 1 NO – –')],
    caveat: 'A dash means the value is not supplied, not a zero-value order or zero-day lag. This small sample does not validate the page 14 statistics or establish causation. Do not merge its timelines with page 9.',
    relatedIssueIds: ['issue-alice', 'issue-buyers'],
  },
  {
    id: 'case-voice-context', category: 'Creator', title: 'Maya’s voice note: keep the relationship',
    summary: 'Maya wants followers to receive her judgement without her personally repeating every answer.',
    details: [
      'Supplied transcript, labelled 00:52:',
      '“I genuinely do not want to stop talking to my audience. That is the best part. I just do not want to answer the same question 400 times. People follow me because they trust my taste. I want them to feel like they are still getting my recommendation, even when I am not personally typing the answer.”',
      'The page’s interpretation is that she wants leverage while preserving the relationship, judgement and trust.',
    ],
    sourceRefs: [
      source(10, 'E-06.1 · Full supplied transcript', 'I genuinely do not want to stop talking to my audience. That is the best part. I just do not want to answer the same question 400 times. People follow me because they trust my taste. I want them to feel like they are still getting my recommendation, even when I am not personally typing the answer.'),
      source(10, 'E-06.2–E-06.3 · Audio and interpretation', 'QR PLACEHOLDER\nShe is not asking for less relationship.\nShe is asking for leverage.\nThe audience wants judgement, not a catalogue.\nThe product has to preserve trust.'),
    ],
    caveat: 'The PDF provides a transcript and a QR placeholder, not an accessible recording. Its stated duration, vocal delivery and timing have not been checked against audio.',
    relatedIssueIds: ['issue-audio'],
  },
  {
    id: 'case-notebook-details', category: 'Case clues', title: 'Notebook details that still need context',
    summary: 'The notebook contains useful questions and routing clues, but does not identify “the good one” or supply all the products it mentions.',
    details: [
      'Maya asks about skin type, current products, what someone hates about them, budget and preferred finish. She also asks whether they care about skincare or mainly want to look good tomorrow.',
      'The routing notes say dry → Cloud Cream + Barrier Oil; oily → Daily Gel; sensitive → avoid fragrance; redness → Red Reset; shade questions → ask current foundation.',
      'Her margin note asks for something people can use without her answering 200 questions a day.',
      'The unrelated to-do list says: call Sarah about the September campaign; buy more brown lip liner; do not recommend retinol to everyone.',
      'Her favourite moisturiser is saved in her phone as “the good one”, a name her audience has adopted. The product’s identity is not supplied.',
    ],
    sourceRefs: [
      source(6, 'E-02.1 · Questions', 'Skin type?\nWhat are you using now?\nWhat do you hate about it?\nBudget?\nWhat finish do you like?\n“Do you actually care about skincare or do you just want to look hot tomorrow?”'),
      source(6, 'E-02.2–E-02.3 · Routing and margin note', 'DRY → Cloud Cream + Barrier Oil\nOILY → Daily Gel\nSENSITIVE → avoid fragrance\nREDNESS → Red Reset\nshade questions = ask current foundation\nNeed to turn all this into something people can use without me answering 200 questions a day.'),
      source(6, 'E-02.4–E-02.5 · To-do list and nickname', 'CALL SARAH / SEPTEMBER CAMPAIGN\nBUY MORE BROWN LIP LINER\nDO NOT RECOMMEND RETINOL TO EVERYONE\nHer favourite moisturiser is saved in her phone as the good one. Her audience has started calling it that too.'),
      source(8, 'E-04.8 · Listed balm', 'Oil Balm 29 Balm Dry Glow 7.7'),
    ],
    caveat: 'Barrier Oil is not identified in the inventory and must not be silently replaced with Oil Balm. “The good one” must not be assigned to Cloud Cream or another product without confirmation. The notebook is source context, not proof of medical suitability.',
    relatedIssueIds: ['issue-barrier-oil'], relatedProductIds: ['cloud-cream', 'daily-gel', 'red-reset'],
  },
  {
    id: 'case-seized-items', category: 'Case clues', title: 'Four seized items, limited material',
    summary: 'The beauty-bag clues point towards speed, confidence and understanding the user, while the actual images and receipt contents are absent.',
    details: ['The page records organiser custody and a return time of 20:00.'],
    table: {
      columns: ['Reference', 'Item', 'Supplied description'],
      rows: [
        ['E-07.1', 'Brown lip liner', 'The shade Maya wears when she has “5 minutes.”'],
        ['E-07.2', 'Receipt', 'Three items, one crossed out twice.'],
        ['E-07.3', 'Mini mirror', 'Back says: “You are not the user.”'],
        ['E-07.4', 'Sticky note', '“People do not need more products. They need confidence.”'],
      ],
    },
    sourceRefs: [source(11, 'E-07.1–E-07.4 · Seized items', 'BROWN LIP LINER\nThe shade Maya wears when she has “5 minutes.”\nRECEIPT\nThree items, one crossed out twice.\nMINI MIRROR\nBack says: You are not the user.\nSTICKY NOTE\n“People do not need more products. They need confidence.”\nITEM PHOTO\nCHAIN OF CUSTODY Logged by organiser. Returned to subject at 20:00.')],
    caveat: '“ITEM PHOTO” placeholders do not supply the photographs. The lip-liner shade, receipt products and crossed-out item remain unknown.',
    relatedIssueIds: ['issue-photos'],
  },
  {
    id: 'case-discounted-leads', category: 'Case clues', title: 'Five leads the case warns against overvaluing',
    summary: 'The document distinguishes high message volume, reach and price from personal judgement and meaningful audience behaviour.',
    details: ['These are the document’s interpretations. They are useful design prompts, but do not establish commercial outcomes for GoodCall.'],
    table: {
      columns: ['Reference', 'Lead', 'Case-file interpretation'],
      rows: [
        ['E-08.1', 'Build a DM bot', 'Too literal: it handles volume, not judgement.'],
        ['E-08.2', 'The biggest post: 74K views', 'Not the strongest commerce signal.'],
        ['E-08.3', 'The £62 serum', 'Maya likes it, but would not recommend paying £62.'],
        ['E-08.4', 'A 14-minute voice note', 'High emotional demand does not necessarily mean high commercial value.'],
        ['E-08.5', 'A silent customer who saves and returns', 'Potentially more valuable than a loud customer.'],
      ],
    },
    sourceRefs: [source(12, 'E-08.1–E-08.5 · Discounted leads', 'The obvious answer: build a DM bot. Too literal. It handles volume, not judgement.\nThe biggest post: 74K views. Not the strongest commerce signal.\nThe most expensive product: £62 serum. Maya likes it. She would not recommend paying £62.\nThe noisiest customer: 14-minute voice note. High emotional demand. Not necessarily high commercial value.\nThe silent customer: never comments, saves everything, returns later. Potentially more valuable than the loud customer.')],
    caveat: 'The 14-minute voice note is a separate described lead from Maya’s 00:52 transcript. Its audio is not supplied. Cross-post commercial comparisons and full buyer-value data are also missing.',
    relatedIssueIds: ['issue-conversions', 'issue-buyers'], relatedProductIds: ['glass-drop'],
  },
  {
    id: 'case-brief-and-judging', category: 'Brief', title: 'What the exercise asks you to demonstrate',
    summary: 'The case asks for one working product that reduces Maya’s reply burden while preserving a personal audience experience.',
    details: [
      'The page 2 deliverable is a working demo that can be shown in under a minute, not a deck. It says an LLM is not required and complexity earns no extra points.',
      'Judging criteria on page 2: value to a real audience member; fidelity to Maya’s voice; use of the evidence; whether it works.',
      'Page 16 proposes questions about use, audience trust, sharing, what feels like work and what feels like Maya. It asks for observed behaviour rather than whether someone likes the app.',
      'Page 2 lists a 16:00 intelligence drop, Maya arriving at 17:00 and a 20:00 pitch. Page 16 says judges take their stand at 18:00.',
      'Page 17 says “90 seconds” but allocates 30 seconds to the target, 90 to the demonstration and 60 to the outcome. Those section durations total three minutes.',
      'The final prompt asks what changes for Maya, with time, confidence, conversion and trust offered as possible outcomes. Actual results would require measurement.',
    ],
    sourceRefs: [
      source(2, 'Briefing 01 · Assignment and judging', 'BUILD ONE WORKING PRODUCT THAT GETS MAYA OUT OF THE REPLY LOOP WITHOUT MAKING HER AUDIENCE FEEL HANDED TO A MACHINE.\nA working demo you can show in under a minute. Not a deck.\nValue to a real audience member. Fidelity to Maya’s voice. Use of the evidence. Does it work.\nYou do not need to use an LLM. You do not get extra points for complexity.'),
      source(2, 'Briefing 01 · Checkpoints', '16:00 intelligence drop. 17:00 Maya walks in. 20:00 you pitch.'),
      source(16, 'Briefing 04 · Judging questions', 'At 18:00 the Judges take their stand.\nWOULD YOU USE THIS?\nWOULD YOU TRUST THIS WITH YOUR AUDIENCE?\nWOULD YOU SHARE THIS?\nWHAT FEELS LIKE WORK?\nWHAT FEELS LIKE YOU?\nDO NOT ASK “Do you like our app?” Ask about the behaviour you observed instead.'),
      source(17, 'The getaway · Presentation outline', '90 seconds. Product first. No deck.\n30 sec THE TARGET\n90 sec THE HEIST\n60 sec THE SCORE\nWhat changed? Time, confidence, conversion, trust?'),
    ],
    caveat: 'These requirements come from the supplied brief. Its presentation timings conflict, and it does not give a submission route. Confirm the current arrangements with the organisers.',
    relatedIssueIds: ['issue-pitch', 'issue-schedule'],
  },
]);

export function findCaseEvidence(id: string): CaseEvidence | undefined {
  return CASE_EVIDENCE.find(evidence => evidence.id === id);
}

/** Plain-text representation used for searching, canvas notes and export. */
export function caseEvidenceText(evidence: CaseEvidence): string {
  const lines = [evidence.title, `Category: ${evidence.category}`, evidence.summary];
  if (evidence.details.length) lines.push('Details:', ...evidence.details.map(detail => `• ${detail}`));
  if (evidence.table) {
    lines.push('Source table:');
    for (const row of evidence.table.rows) {
      lines.push(evidence.table.columns.map((column, index) => `${column}: ${row[index] ?? 'Not supplied'}`).join(' | '));
    }
  }
  if (evidence.caveat) lines.push(`Evidence limit: ${evidence.caveat}`);
  lines.push('Sources:', ...evidence.sourceRefs.map(ref => `Page ${ref.page} · ${ref.label}`));
  return lines.join('\n');
}
