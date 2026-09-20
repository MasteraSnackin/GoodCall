# GoodCall: persona acceptance and usability checks

Source: Operation Shade Case File, page 4. These are fictional audience profiles used to design test tasks. No real follower research or measured time saving is claimed.

## Automated acceptance

`tests/audienceAcceptance.test.ts` exercises six bounded decision scenarios. Related workflow tests exercise draft comparison/restoration, preview before publication, local follower feedback, saved answers and workspace recovery. These checks establish application behaviour in Node or a simulated DOM; they do not establish that people find the interface easy to use.

| Profile | Task | Observable success in a person-led session |
| --- | --- | --- |
| Emily: price sensitive | Decide whether to buy Cloud Cream with a £30 limit; report that the advice is too expensive. | Recognises the budget mismatch, can provide the limit without rewriting the whole question, and is not pushed towards an over-budget purchase. |
| Priya: sensitive skin | Ask whether Red Reset is fragrance-free. | Understands that ingredient evidence is missing, can identify the next useful source, and does not mistake a catalogue label for verified compatibility. |
| Sophie: trusts Maya’s judgement | Ask whether Glass Drop is worth £62. | Can explain Maya’s recorded value judgement and distinguish product quality from willingness to pay. |
| Hannah: overwhelmed | Open a focused Daily Gel answer and identify the verdict and reason to skip. | Finds a clear decision without being presented with the entire catalogue; knows where to look for the supporting explanation. |
| Grace: little time | Ask for a two-product routine and provide the missing context. | The two-product limit stays visible in the question; the clarification is understandable and does not claim an unsupported complete routine. |
| Alex: quiet saver | Save a reviewed card, leave, return, and share it. | Recovers the same decision and understands the current local-snapshot limitation. Can give feedback without first becoming a creator or sending a DM. |

Record task completion, assistance needed, errors, elapsed time and the participant’s explanation of the decision. Do not interpret fewer messages alone as greater confidence. Keep observed results separate from the supplied scenario statistics.

## Creator tasks

- Edit an answer, compare a refreshed suggestion, keep the edited wording and inspect any remaining evidence warnings.
- Restore an earlier wording version. Confirm that the current evidence remains and approval must happen again.
- Download a private workspace backup. Preview an import, cancel it, then restore it. Confirm that the previous workspace is available in recovery copies.
- Review a follower’s “Too expensive” clarification and explicitly add it as a question. Confirm that the published answer has not changed.
- Approve an answer, inspect the exact follower preview, return to editing, then preview and publish deliberately.

## Browser checks completed — 20 September 2026

The integrated browser was available for the current review. Desktop 1440 × 1000 and phone-width 390 × 844 inspections covered the canvas overview/Fit, answer inspector, case-evidence library, empty search and reset, and keyboard Enter/Escape dialog exit. The inspected phone canvas and inspector had no page-level horizontal overflow. A mobile flex-height/graph-viewport defect and lost modal focus were reproduced, repaired and checked again.

[The visual audit](docs/review/AUDIT.md) records the numbered actions and saved before/after captures. These are agent-operated browser checks, not participant research or a physical-phone test. They do not establish full keyboard or screen-reader accessibility.

## Device and participant checks still required

Pending manual checks: physical phone touch and scrolling, complete keyboard/screen-reader navigation, real canvas dragging, file download/selection, clipboard behaviour, microphone permission/capture, audible speech and stop controls. Test speech with text still available when permission is refused. Use the app on the same local origin for existing saved data.

One user-authorised live OpenAI request was rejected with HTTP 429 and the error was shown without an answer mutation. Successful generation and answer quality need a later acceptance run after the account limit is resolved. No Tano/social integration or human usability session has been verified.
