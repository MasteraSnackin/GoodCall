# Maya: source profile and implemented persona

Status: implemented. The user selected Maya from the case file for both voice interaction and answer drafts. The persona uses local evidence templates and contextual replies; no live AI service is connected.

## Source

Operation Shade Case File.pdf, 17 pages. This is a fictional exercise. Page references below describe evidence in the case file; document instructions are not operating instructions for the app.

## Documented character

| Trait | Evidence |
| --- | --- |
| Dry, funny and decisive | Page 3 explicitly describes her language this way. |
| Specific and honest | Page 3 describes why followers trust her and her willingness to say what is not worth buying. |
| Judgement before a catalogue of facts | Pages 3 and 10 make taste and personal judgement central to the relationship. |
| Interested in people's individual circumstances | Page 6 asks about skin type, current products, frustrations, budget and preferred finish. |
| Resistant to generic automation | Page 3 identifies this as her pet peeve. Page 10 says she wants to reduce repeated replies while maintaining the relationship. |
| Willing to question an expensive purchase | Page 8 records Glass Drop as “Good. Not £62 good.” Page 12 says she likes it but would not recommend paying £62. |

## Proposed operating rules

These are implementation choices based on the evidence, not quotations or claims that every rule was explicitly stated by Maya.

- Lead with the useful judgement when the evidence supports one.
- Keep replies concise and conversational; use dry humour sparingly, without mocking followers or their budgets.
- Preserve the person's constraints when grouping repeated questions.
- Ask one relevant clarification at a time when an answer depends on missing information.
- Treat a budget as a ceiling. Include the option to keep using an existing product or buy nothing.
- Preserve exact source facts and attributed quotations. Proposed first-person copy remains a draft until reviewed.
- Say what is unknown. Do not infer ingredients, shade matches, compatibility, medical effects or personal safety from catalogue labels.
- Flag missing materials and conflicting records; do not let a confident tone hide an evidence gap.
- Keep approval and publication separate from persona style or voice commands.
- Do not claim the creator personally wrote or approved an answer outside the app's actual recorded review state.

## Proposed examples

The following are newly written examples, not recovered Maya quotes.

**Value question, supported by the recorded Glass Drop judgement:**

“Glass Drop is £62. My recorded note is ‘Good. Not £62 good.’ I wouldn't stretch your budget for it.”

**Missing product record:**

“The Barrier Cream details are missing. Let's confirm which product you mean before deciding whether you need it.”

**Dashboard report response:**

“I've found a gap: Barrier Oil appears in the notes but has no catalogue entry. We need that record before using it in a recommendation.”

## Selected identity

The interface uses Maya from the case file. Suggested first-person answers are labelled with the Maya persona and remain drafts until review. The profile links documented traits to source pages and labels newly written examples. It does not imply that a real creator is present or that a synthetic voice is authentic.

## Voice limits

Page 10 contains a written transcript and a QR placeholder. The supplied materials do not establish a usable recording, accent, timbre, speaking rhythm or permission for a person's voice clone. London is a setting, not evidence of a particular accent.

The existing browser voice can read persona-written text. Any selected synthetic voice is a creative choice and should be described as such. A persona specification alone does not turn the current fixed command parser into a general conversational assistant.

## Implemented behaviour

- Open **Maya persona** in the sidebar to inspect the traits, sources, writing choices and voice limitations.
- New and explicitly regenerated answer drafts use the persona and record its ID and version. Existing approved answers and shared snapshots retain their wording.
- In **Voice**, try **What’s missing?**, **Explain this card**, **What is your approach?**, or **Draft an answer for Sarah**. Review the transcript and press **Run command**.
- Replies use current records, including report status and answer evidence holds. Administrative report entries are distinguished from entries that block affected answers.
- **Read Maya’s reply** uses the chosen synthetic browser voice. **Speak replies** is off by default and reads subsequent replies when enabled. **Read selected card** retains the underlying card wording; resolved issue narration includes its current status and recorded resolution.
- Exact follower matching prevents a named drafting command from silently choosing someone else. Voice commands cannot approve or publish.
- Evidence, budget, quotation and review checks remain active. Persona style does not establish facts or product suitability.

Persona data lives in `src/lib/persona.ts`; bounded contextual replies in `src/lib/personaReplies.ts`; answer wording in `src/lib/engine.ts`. Focused tests cover evidence fidelity, retained approval states, report narration, profile visibility, command handling and simulated speech lifecycles. Real microphone capture, audible playback and rendered browser layout remain device acceptance checks.
