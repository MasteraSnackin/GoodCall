# GoodCall design review

Reviewed 20 September 2026 against the rendered desktop and phone-width app, [DESIGN.md](../../DESIGN.md) and the current plan. The visual lane changed CSS/readability only; publication, storage, provider and modal lifecycle logic were handled in the functionality lane.

## Direction

Retain the warm editorial case-file canvas: cream surfaces, charcoal text, muted rust actions and labelled source colours. This fits the exercise's evidence-review task and Maya's documented judgement. The principal dashboard improvement is more usable space and clearer reading, not a change of visual identity.

The attached template suggests Tailwind, Framer Motion, bento grids, glassmorphism and kinetic typography. Those are design options, not current project dependencies or accessibility requirements. Introducing them would expand scope without fixing the observed problems. The implemented app keeps its existing React/CSS system and movable graph.

## Completed visual improvements

| Change | Reason and acceptance evidence |
| --- | --- |
| Remove the desktop flex basis from the phone introduction | Prevents an accidental 345 px introduction; measured 86 px after repair at 390 × 844. |
| Anchor the graph viewport below its controls | The library's inline root rules previously overrode the intended placement. The graph now fits its board, with approximately 293.6 px of graph height in the inspected phone state. |
| Darken issue, search placeholder and result count text | Retains the palette while addressing previously measured normal-text contrast below 4.5:1 on the sampled pale canvas surface. |
| Preserve readable inspector fields and source descriptions | Desktop 1440 × 1000 and phone 390 × 844 captures show readable full answers; the phone inspector's document has no horizontal overflow. |
| Clarify review, recovery and follower copy | Concurrent design work made action descriptions more direct, without changing workflow gates. DESIGN.md passed its source-aligned design lint with zero errors and warnings. |

The contrast changes use issue `#86631f`, placeholder `#6b6f60` and count `#626758` in place of the lighter colours. The cited 4.5:1 threshold is for normal text; actual conformance must consider every rendered text/background pairing, focus indicator and interaction state. This was not a complete accessibility certification. Guidance: [WCAG contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

## Captures and interaction evidence

- [Desktop canvas](screenshots/02-desktop-canvas.jpg): calm navigation, visible work stages and source types.
- [Desktop answer inspector](screenshots/03-answer-inspector.jpg): focused reading and editing surface alongside the source graph.
- [Phone answer inspector](screenshots/04-mobile-inspector.jpg): full answer fields and a visible close control.
- [Phone canvas before](screenshots/05-mobile-canvas.jpg) and [after](screenshots/06-mobile-canvas-after.jpg): restored graph space.
- [Case-evidence library](screenshots/07-mobile-case-evidence.jpg) and [empty search](screenshots/08-evidence-empty-state.jpg): source browsing and clear recovery.

The actual audit clicked Fit, opened answer review, searched/reset the evidence library and exercised Enter/Escape dialog exit. A shared modal focus defect was passed to the functionality lane and repaired there. See [AUDIT.md](AUDIT.md) for the numbered journey and [DEBUG.md](DEBUG.md) for the cause.

## Next design decisions

The zoomed-out canvas is an overview; it is not intended for reading every long answer simultaneously. Continue testing whether creators discover focus/inspector controls easily. Keep source labels and review status visible when considering future card-density changes. Evaluate physical phone touch targets, screen-reader order and complete keyboard navigation with users before claiming broad accessibility or measured time savings.

No further visual refactor is required for the inspected local demo. No functional behaviour, data model or infrastructure was changed by the visual lane.
