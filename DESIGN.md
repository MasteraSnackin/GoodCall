---
version: alpha
name: GoodCall — Warm studio
description: Current design contract for Maya's question, evidence and answer workspace.
colors:
  primary: "#963f31"
  primary-hover: "#7e3328"
  primary-text: "#fffaf6"
  paper: "#f6f4ef"
  surface: "#fffefa"
  sidebar: "#eeece5"
  ink: "#30312c"
  muted: "#64685a"
  source-text: "#6f6858"
  helper-text: "#6e6959"
  secondary-text: "#656b5d"
  advice-paper: "#f6f3ed"
  advice-ink: "#272c2a"
  advice-deck: "#697064"
typography:
  interface:
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  display:
    fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.6px"
  button-base:
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.3
  source:
    fontSize: "11px"
    lineHeight: 1.6
  helper:
    fontSize: "12px"
    lineHeight: 1.85
  save-status:
    fontSize: "11px"
  advice-answer:
    fontSize: "16px"
    lineHeight: 1.9
rounded:
  control: "6px"
  modal: "12px"
  advice-card: "14px"
spacing:
  control-y: "10px"
  control-x: "13px"
components:
  workspace:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.interface}"
  sidebar:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.ink}"
  page-heading:
    textColor: "{colors.ink}"
    typography: "{typography.display}"
  button-primary-base:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-text}"
    typography: "{typography.button-base}"
    rounded: "{rounded.control}"
    padding: "{spacing.control-y} {spacing.control-x}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-text}"
  button-secondary-base:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary-text}"
    typography: "{typography.button-base}"
    rounded: "{rounded.control}"
    padding: "{spacing.control-y} {spacing.control-x}"
  source-link:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.source-text}"
    typography: "{typography.source}"
  helper:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.helper-text}"
    typography: "{typography.helper}"
  save-status:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.muted}"
    typography: "{typography.save-status}"
  modal:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.modal}"
  advice-page:
    backgroundColor: "{colors.advice-paper}"
    textColor: "{colors.advice-ink}"
  advice-deck:
    backgroundColor: "{colors.advice-paper}"
    textColor: "{colors.advice-deck}"
  advice-answer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.advice-ink}"
    typography: "{typography.advice-answer}"
    rounded: "{rounded.advice-card}"
---

## Overview

GoodCall helps Maya turn repeated follower questions into useful, reviewed advice. The workspace keeps the question, personal circumstances, supporting material, unresolved issues and draft close enough to compare. A follower's budget and existing products matter as much as the topic of their question.

The established visual direction is **Warm studio**: cream paper, off-white surfaces, rust actions, restrained borders and serif headings. Keep the feeling of an organised working notebook. The canvas should make a decision easier to inspect; decoration should not compete with its evidence.

### Authority and status

This is a current-state capture of the application source on 20 September 2026, including the copy and readability refinements in this task. It is not a new theme proposal or a claim that every screen has passed a visual or accessibility audit. Runtime font loading, actual viewport composition and device voice behaviour require separate checks.

The source of truth for implementation is [styles.css](src/styles.css), followed by the canvas overrides in [CanvasShell.css](src/components/CanvasShell.css) loaded from [main.tsx](src/main.tsx), and the individual component styles. [AdvicePage.css](src/components/AdvicePage.css) defines the follower reading surface. The YAML records shared default values and explicitly named base variants. It does not flatten responsive overrides into a single universal value.

Use the case files as factual reference material. Keep their quotations, prices, counts, page references and unknowns intact. Interface copy may be edited for clarity; source material and approved answers need their own review.

## Colors

The default palette uses `--paper` for the workspace, `--surface` for panels and `--sidebar` for navigation. `--ink` carries primary text. Rust `--accent` identifies primary actions, selection and focus; it is not a generic decoration colour. `--line: #e0ddd4` separates surfaces without adding heavy outlines. `--accent-soft: #f0e3dc` supports selection, and `--green: #54735a` supports positive states where used.

Keep supporting text readable. Save status uses `--muted: #64685a`; source links use `--source-text: #6f6858`; helper copy uses `--helper-text: #6e6959`. Source links remain visible as actionable references rather than fading into the background. The canvas review prompt uses `#626957` on `#f1f3e8`, and the summary tail uses `#656b5b` on the workspace paper.

The existing preference themes change the shared surface and accent variables:

| Role | Warm studio | Beauty editorial | Case-file desk |
| --- | --- | --- | --- |
| Paper | `#f6f4ef` | `#f8f2ef` | `#efede4` |
| Surface | `#fffefa` | `#fffcfa` | `#fcfbf3` |
| Sidebar | `#eeece5` | `#efe6e2` | `#e7e3d7` |
| Border | `#e0ddd4` | `#e8dcd6` | `#d8d3c4` |
| Accent | `#963f31` | `#904c62` | `#8e3528` |
| Accent hover | `#7e3328` | `#793c51` | `#74281f` |
| Accent soft | `#f0e3dc` | `#f2e1e8` | `#e9dcd0` |

These themes are existing variants, not alternative status meanings. Some component palettes, including the follower page, remain fixed. Never rely on colour alone to explain a missing source, a blocked action or an approval state; retain the visible status text.

## Typography

DM Sans is the interface face. Instrument Serif is used for the wordmark, headings, selected quotations, monograms and display numbers. Both are requested through the Google Fonts import; keep the system sans-serif and Georgia/Times fallbacks usable when the fonts cannot load.

Base workspace headings use `clamp(30px, 2.8vw, 43px)`. The active canvas heading uses `clamp(29px, 2.4vw, 37px)`, with 29px in compact layouts. Keep form labels, source references and dense controls in the interface face.

The base primary and secondary buttons use 10px type. Canvas variants increase this to 11px, with a 38px minimum height for inspector buttons and the page action, and 36px for top actions and the review-start button. Source links and save status use 11px; helper text uses 12px. Base field labels use 12px; nested hints and base inputs use 11px. Canvas field inputs increase to 13px, then 16px on narrow screens. These are recorded implementation values, not a blanket recommendation to use small text elsewhere.

The follower page is a reading view: a Georgia heading, 16px answer text with a 1.9 line height, and a 14px deck in `#697064`. At its narrow breakpoint, answer text becomes 14px. Preserve readable line lengths and paragraph spacing when adding longer material.

## Layout

The desktop workspace has a 218px sidebar, a top bar, a short page introduction and the working area. The canvas shell uses the viewport height without the base shell's 700px minimum. The canvas must retain room for both cards and the selected card's details.

The canvas top bar is 58px high. Its working area uses 24px side margins in the standard desktop layout and 10px in the narrow layout. The details panel shares the desktop working area; at 1100px and below it becomes a right-hand overlay, bounded by `min(380px, calc(100% - 32px))`. Keep its close control and the selected card's context available.

At 960px and below, navigation condenses to icons while preserving accessible names. At 720px and below, top actions can scroll horizontally, the question action condenses and canvas spacing shrinks. At short heights, explanatory chrome is reduced to preserve the board. The body currently has a 360px minimum width; do not claim support below that width without changing and testing it.

Expanded canvas mode hides the sidebar, page introduction, summary, footer and start prompt. It retains the workspace actions and access to details. Do not hide essential review or evidence controls merely to make the canvas look empty.

The follower view has a 760px maximum content width, generous reading space and wrapping actions on small screens. Revision comparisons use two columns where space allows and stack below 700px. Feedback controls wrap and then stack below 650px.

## Elevation & Depth

Use borders before shadows to separate content. The base work area has a barely visible `0 2px 5px #322c1903` shadow. Primary buttons use `0 1px 2px #612a1221`. Modal overlays and selected canvas elements may need stronger separation, but a static evidence card should not look like a floating promotional tile.

Existing button colour and shadow transitions last 0.15 seconds. Keep interface motion brief and tied to state changes. Preserve the global reduced-motion rule and component-specific reduced-motion handling. Do not add animation to evidence or draft text while Maya is comparing it.

## Shapes

Use 6px corners for primary and secondary controls, 5px for base fields, 12px for modal shells and 14px for follower answer cards. The active canvas work area has a 12px radius on desktop and 9px at 720px and below. Circles identify avatars and small status dots; pills carry compact state labels. These shapes should help distinguish roles without introducing a new visual language in every panel.

## Components

### Questions, evidence and drafts

Keep the question's circumstances visible alongside its draft. Similar questions can share a group without losing the follower's budget, existing products or intended use. Evidence cards should retain their source and caveats. A missing material or inconsistency report should explain what is missing or conflicting and what would resolve it.

Use task names for navigation and headings: “Audience questions”, “Evidence that needs checking”, “Follower feedback” and “Approved advice”. Avoid abstract slogans where Maya needs to choose an action. “Browse approved advice” opens the collection; “Open follower view” opens a specific shared answer.

Drafting, review, approval and publication are separate states. Use “Review required before publishing” rather than suggesting Maya has already reviewed every generated answer. A restored or refreshed draft must still reflect the current evidence and review state. Keep the existing revision limit and restore explanations explicit.

### Chat and voice

Keep reply origin and connection state visible. A local template, an AI draft and an approved answer make different claims. Provider configuration alone does not establish a successful live response. Surface an unavailable connection or request failure in plain language, with a usable local path where supported.

Voice controls need clear listening, stopped and speaking states. Label speech output as synthetic, retain text as the usable equivalent and keep review separate from generation. Never imply the fictional persona recorded the voice or personally wrote an unreviewed draft.

### Sharing, feedback and recovery

The follower preview and shared page use the same answer content component. Preview should expose the follower's reading experience while keeping private workspace controls out of it. Explain snapshot and update behaviour where an answer is shared.

Feedback saved on this device is local feedback. Do not imply it was sent to Maya or synchronised across followers. Recovery copy should say what a backup includes and excludes, and explain replacement before an import changes the workspace. Preserve the existing corruption and validation safeguards.

### Controls and focus

Keep labels short and specific: name the action and object when that prevents ambiguity. Explain a consequence near the relevant control rather than adding a generic warning elsewhere. Unknown values should say they are unknown; do not fill them with plausible copy.

Preserve the 2px accent `:focus-visible` outline with its 4px offset for buttons, links and summaries. Fields use a 2px accent/white mixed focus outline, a 1px offset and an accent border. Canvas and chat controls retain their own focus rules. Contrast calculations and static token linting are useful checks, but they do not establish accessibility conformance or keyboard usability on their own.

## Do's and Don'ts

- Keep the cream, rust and serif identity while making the next decision easier to find.
- Use natural UK English, concrete task names and short explanations of what happens next.
- Preserve the distinction between evidence, Maya's quoted judgement, generated wording and a reviewed answer.
- Keep source links, unresolved issues and review state legible near the decision they affect.
- Retain keyboard focus, accessible control names, responsive fallbacks and reduced-motion support.
- Do not invent prices, availability, capabilities, approvals or missing case-file details to make the interface read more smoothly.
- Do not label a local interaction as delivered, synchronised or connected without the corresponding successful operation.
- Do not turn Maya's specific, dry tone into a catchphrase on every control. Keep functional copy direct and preserve authentic quotations exactly.
