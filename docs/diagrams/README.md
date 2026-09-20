# GoodCall diagrams

These maps explain GoodCall's local workspace, optional services and review workflow. They were built with the Archify skill from the project documentation and source code. They describe an exercise prototype, not a cloud deployment.

[Download all four interactive maps](GoodCall-diagrams.zip). Extract the ZIP and open `index.html` in a browser. Each map is a self-contained HTML file with embedded fonts. The viewer includes zoom, search, focus, route tracing and theme controls. Source-code links need an internet connection.

## Choose a view

| View | Preview | Interactive file | Editable source |
| --- | --- | --- | --- |
| System overview | [SVG](system-overview.preview.svg) | [HTML](system-overview.html) | [JSON](system-overview.architecture.json) |
| Browser workspace detail | [SVG](workspace-detail.preview.svg) | [HTML](workspace-detail.html) | [JSON](workspace-detail.json) |
| Draft and review | [SVG](review-drafting.preview.svg) | [HTML](review-drafting.html) | [JSON](review-drafting.sequence.json) |
| Preview and publish | [SVG](review-publication.preview.svg) | [HTML](review-publication.html) | [JSON](review-publication.sequence.json) |

GitHub shows the SVG previews directly. It displays HTML as source, so use the download for the interactive versions.

## What the maps show

The overview follows a creator through the browser workspace to a reviewed public snapshot and follower view. Local evidence and storage sit beside that path. Dashed branches show optional AI and speech dependencies. AI calls use one selected provider; suggestions still need local checks and human review.

The workspace detail separates browser modules, persistence, private backups, public snapshots, source references and Google Fonts. The app uses bundled records for its rules. It opens PDF page links but does not parse the PDF at runtime. Workspace records and follower saves/feedback use separate browser storage keys; feedback does not travel between devices.

The sequence is split at local approval. Evidence holds stop approval. An approved answer then needs a follower preview, confirmation, revalidation and a successful save before a new publication becomes visible. A failed publication save leaves the answer approved.

These are component dependencies and explicit workflow calls. They do not measure live traffic, latency or service health. The maps do not add Tano, social inboxes, accounts or a shared database.

## Source and verification

The architecture maps link to reviewed source files at [commit 34c5f15](https://github.com/MasteraSnackin/GoodCall/tree/34c5f15ba3838f608657ca647b65849b07d37957). The sequence maps were checked against the same implementation. The later canvas editing release is preserved in the repository; these diagrams cover the broader runtime and review flow rather than each canvas tool.

All four final HTML files pass Archify's nine showcase checks with zero errors and zero warnings. The checks cover SVG structure, routing, crossings, label clearance, legend spacing and related layout constraints. Delivery receipts bind each HTML file to the exact source JSON with SHA-256 hashes.

| Final HTML | Deterministic checks | Automated browser evidence | Visual review |
| --- | --- | --- | --- |
| System overview | 9/9, no errors or warnings | Passed | Light and dark captures inspected |
| Workspace detail | 9/9, no errors or warnings | Passed | Light and dark captures inspected |
| Draft and review | 9/9, no errors or warnings | Not run after the final browser-role correction | Final static preview inspected; final HTML not re-opened |
| Preview and publish | 9/9, no errors or warnings | Not run after the final browser-role correction | Final static preview inspected; final HTML not re-opened |

For the two architecture views, the automated browser checks measured containment at 1440 × 900, 1600 × 1000, 1920 × 1080 and 2048 × 1320. Light and dark captures were inspected at the smallest and largest sizes. The final files fit those viewports without page overflow.

The two sequence views also passed browser checks before a final semantic correction changed the local rule functions' role from backend to frontend. Their corrected HTML was validated again, but not opened in a browser: the in-app browser's URL policy blocked the local HTML page. Earlier screenshots are not presented as evidence for the corrected files. Search, focus, route and manual export interactions are not claimed as tested.

The GitHub previews are declarative SVGs extracted from the final generated diagrams without running HTML scripts, opening a browser or fetching assets. Their geometry and labels come from the checked HTML. Sequence previews use the viewer's READ presentation; fine annotations remain in the SVG source and interactive HTML. See [export-static.py](export-static.py) for the conversion and [handoff.json](handoff.json) for file hashes, receipts and review scope. The previews are communication assets; they do not replace the HTML delivery receipts.

## Edit and regenerate

Edit the appropriate typed JSON, then use the installed Archify package. Set `ARCHIFY_SKILL_DIR` to its directory. From the repository root, an architecture map can be regenerated with:

```sh
node "$ARCHIFY_SKILL_DIR/bin/archify.mjs" validate architecture docs/diagrams/system-overview.architecture.json --quality showcase --repo-root . --json
node "$ARCHIFY_SKILL_DIR/bin/archify.mjs" deliver architecture docs/diagrams/system-overview.architecture.json docs/diagrams/system-overview.html --quality showcase --repo-root . --json > docs/diagrams/system-overview.delivery.json
```

For sequence maps, use the `sequence` type and omit `--repo-root`. Preserve the source revision unless you have reviewed the replacement commit and its file references. After changing an artifact, regenerate its preview and collect fresh browser evidence where permitted; old hashes do not validate new output.

The static exporter checks the HTML against its delivery receipt before copying its diagram:

```sh
python3 docs/diagrams/export-static.py
```

## Viewer licensing

The generated viewer includes Archify code under its [MIT licence](vendor/ARCHIFY-LICENSE.txt), with [third-party notices](vendor/THIRD-PARTY-NOTICES.md) and the [JetBrains Mono font licence](vendor/JetBrainsMono-OFL.txt). These notices apply to the included viewer components and font. They do not grant a licence to the GoodCall project or supplied exercise material.
