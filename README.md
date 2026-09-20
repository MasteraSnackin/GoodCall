# GoodCall

GoodCall is a local working prototype for the Operation Shade / Tano Creator Heist exercise. It turns the supplied audience questions, product inventory and creator notes into a movable evidence canvas, reviewed answers and follower advice cards.

## Open and run

The development server uses **http://127.0.0.1:4341/**. Use this same address consistently: browser storage is separate for `localhost` and `127.0.0.1`.

Use **Node.js 26** (tested with 26.8.1 and npm 11.19.0). Install the locked dependency versions:

```sh
npm ci
npm run dev
```

`npm run build` creates the production bundle. `npm run preview` serves it on the same address once the development server is stopped. All servers are bound to the local machine; this is not an internet deployment.

## Pitch deck

The five-slide presentation includes a 60-second pitch with speaker notes:

- [View the pitch as a PDF](docs/pitch/GoodCall-60-Second-Pitch.pdf)
- [Download the editable PowerPoint](docs/pitch/GoodCall-60-Second-Pitch.pptx)

## First demo

1. Click **Demo guide → Start the demo**, or **Draft answer** on Sarah’s Cloud Cream question.
2. Read the question, product evidence and suggested wording. The case-file price is £38.
3. Click **Approve answer**, then **Publish advice card**. Check the follower preview and choose **Publish this version**.
4. Choose **Share approved answer → Open follower view**. Save the answer and copy its link.
5. Return to the workspace and draft an answer to Jessica’s Barrier Cream question. Its missing product information prevents approval.
6. Open **Evidence & issues**. Expand the Barrier Cream finding to see source excerpts, the needed clarification and resolution controls. Download the report with **Export report**.

## Implemented

- Movable React Flow cards and evidence connections; position and connection persistence.
- All 12 sample questions, 10 products and four notebook/voice-transcript summaries.
- Local keyword grouping that preserves each original question and its context.
- Clearly labelled evidence-template drafts, editable titles and wording, explicit review/approval/publication states.
- Missing product, budget, shade/context, unsupported ingredient/clinical claim, attributed quote and known-price checks. These are bounded rules for this dataset, not comprehensive semantic fact checking.
- Product corrections with a recorded source. Changed product revisions require affected drafts to be regenerated and reviewed.
- Question clarification with the original source preserved. Clarifying a question regenerates its existing draft and removes previous approval.
- Ten case-file checks covering missing materials, inconsistent values, weakly supported statistics and event administration. Resolution notes require an explanation and a source reference; a resolved report does not bypass answer validation.
- Downloadable Markdown report with page references, affected records and follow-up actions.
- Follower advice pages with local saves and portable, encoded snapshot links. Raw follower questions and private workspace source notes are excluded from generated public payloads.
- Three visible appearance choices under **Workspace preferences**: Warm studio, Beauty editorial and Case-file desk.

## Finding your way around the canvas

- Choose **Expand canvas** for more working space. **Exit expanded view** restores the full workspace.
- Use **Find a card** to search the cards already on the board by follower, product, question or evidence text. Select a result to open its details and bring it into view.
- Select a card, then choose **Focus connections** to show its related question, answer and supporting evidence. **Show all cards** or **Fit** restores the whole board. Filtering does not remove cards or change their saved positions.
- The bottom controls zoom in and out, reset to **100%**, fit the board, focus the selected card and toggle a pannable minimap.
- Close card details with the close button or **Escape**. The card stays selected; **Show card details** reopens the panel. On narrower screens, details appear over the board to preserve the canvas width.

## Chat with Maya

Use **Chat with Maya** in the header for a conversation about the case-file products, the selected canvas card or missing evidence. Try “Is Cloud Cream worth £38?”, then “My budget is £30”, or ask “What’s missing?”. Replies carry supporting page references when available.

- Type and press **Enter** or **Send message**. **Shift + Enter** adds a line.
- Use the microphone button for **Start dictation**, stop when finished, review the transcript and send it explicitly.
- Enable **Speak replies** to hear new replies, or choose **Read aloud** on an individual response. Choose an available browser voice; stop playback at any time.
- Chat history keeps the latest 60 messages on this device. **Clear history** removes it. Old messages do not start speaking when the chat reopens.
- **Add to audience questions** explicitly copies the reviewed question into the workspace. Chat itself does not create drafts, approve answers or publish anything.

The conversation uses bounded local rules and current workspace evidence, not a live language model. It asks for clarification when context conflicts or falls outside its supported patterns. Recognition and speech playback depend on browser support; typing remains available. The browser's speech services may process audio online. No audio is stored by this app, and the voice is synthetic rather than a recording or clone of Maya.

## Reusable decisions

New drafts include **Maya’s call**, **Who this is for**, **When to skip it** and **What still needs checking**. Review these alongside the answer; editing any part returns it to draft. The canvas prepares product and notebook connections automatically.

**Approved advice** is now a searchable library. Add a new question on the same product and decision topic to see a reviewed starting point. Reusing it creates an unapproved draft with the new follower’s evidence and context checks. A published follower card includes the decision details. Older cards remain unchanged until explicitly updated. See [DECISIONS.md](DECISIONS.md).

## Voice controls

Open **Voice** in the header, choose **Start listening**, then review or edit the transcript before choosing **Use as question** or **Run command**. Commands can navigate the workspace or draft an answer for a selected question or an exact follower handle. They cannot approve or publish answers. Select a canvas card and choose **Read selected card** to hear its text.

Speech recognition depends on browser support and permission; some browsers process speech remotely. This app does not store audio. Real microphone capture and speaker playback have not been verified.

## Maya persona

The persona applies to both new answer drafts and voice-companion replies. Open **Maya persona** in the sidebar for its source-backed traits and page references: dry, funny, decisive, specific and honest about value. New copy is identified as suggested wording; the persona does not rewrite previously approved answers or shared snapshots. Use **Regenerate from evidence** deliberately when you want a fresh persona draft.

In **Voice**, try **What’s missing?**, **Explain this card** or **What is your approach?**. Review the transcript and choose **Run command**. Responses use the current canvas records and evidence checks. Choose **Read Maya’s reply** to hear one, or enable **Speak replies** for subsequent responses. Synthetic speech uses the chosen browser voice; the supplied PDF contains only a transcript and QR placeholder, so it cannot establish Maya’s original vocal sound. This is a bounded local persona, not a live conversational model.

See [PERSONA.md](PERSONA.md) for the source profile, implementation choices and examples.

## Boundaries

- **No Tano or social media accounts are connected.** No real follower messages are read or sent.
- **No live AI service is connected.** Grouping and drafting use local rules and evidence templates. No question or source is submitted to an AI provider.
- The source is a fictional case-file exercise. Local approval is a prototype state, not a verified action by a real creator.
- Share links are snapshots. Editing or withdrawing an original answer does not update a shared copy. The receiving device needs access to the same app host. This local server is not accessible to other devices or the internet.
- This is a single-user browser prototype. There is no authentication, production permission model, signed publication, multi-user database or immutable audit log. Do not deploy this version for real private messages without adding those controls.
- Checks cannot establish product safety, ingredient compatibility or diagnose skin conditions. The catalogue does not include the necessary evidence.
- Reports contain focused, reviewed case-file checks. They do not automatically audit arbitrary uploaded documents.
- Browser storage keeps the workspace and follower saves. Clearing site data removes these local records. No credentials are stored.
- Original PDF and synced `sources/` files are unchanged. A read-only copy of the PDF is served locally for page references.

## Verification

```sh
npm test
npm run build
```

Tests cover card search and connection filtering, expanded view and details-panel keyboard behaviour, voice command parsing and mocked speech lifecycles, question clarification and evidence disconnection, evidence gates, edited prices/quotes, budget parsing, source revisions, private-source exclusion, share validation, and the creator/follower UI workflow. UI integration tests run in a simulated DOM with the graph renderer replaced by a small callback adapter; they do not prove canvas dragging, visual layout or browser permissions.

Browser inspection through Codex was blocked by an administrator-enforced policy verification failure. No alternative browser automation was used to bypass that block. Visual layout, real pointer dragging and clipboard behaviour still require a manual check in the running app.

## Main files

- `src/App.tsx`: workspace, inspector, questions, knowledge, issue reporting and approval flow.
- `src/components/AnswerCanvas.tsx`: movable graph and card rendering.
- `src/components/AdvicePage.tsx`: follower-facing saved advice.
- `src/lib/seed.ts`: page-referenced case-file data.
- `src/lib/engine.ts`: bounded grouping, draft and evidence rules.
- `src/lib/share.ts`: validated public snapshots.
- `src/lib/storage.ts`: local workspace persistence.

The visual direction uses the case file’s cream paper and muted rust in a readable workspace, with blue question cards, green product evidence, warm notebook cards and amber findings.

## Draft history, recovery and follower feedback

- **Regenerate from evidence** now compares the existing wording with the updated suggestion. Keep the wording while refreshing evidence, or use the suggestion. Either choice requires review. **Saved draft versions** retains up to 20 earlier versions; restoring wording keeps current evidence and never restores an old approval.
- **Backup & restore** in the sidebar downloads a private workspace JSON backup. Imported backups are validated and previewed before replacement. Recovery copies preserve the previous save and the workspace from before a restore. Backups include questions, evidence, answers, history, reports and canvas layout; chat, follower saves, feedback and visual preferences are separate.
- Follower cards offer **That helped**, **Too expensive**, **I already own something similar** and **Still unsure**. Relevant clarifications stay in local browser storage. Maya can inspect **Follower feedback** and explicitly add a follow-up question; feedback never changes a reviewed answer automatically. This prototype does not deliver feedback from other devices or send messages.
- **Publish advice card** opens the same public content in a read-only preview. **Publish this version** is the final action. Possible contact details are highlighted for review; the check is bounded and does not establish that wording contains no private information.

See [USABILITY-CHECKS.md](USABILITY-CHECKS.md) for the six case-file persona scenarios and pending physical-device checks. Simulated-interface tests do not establish visual layout, microphone capture or audible playback.
