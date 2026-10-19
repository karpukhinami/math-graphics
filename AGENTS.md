# Project rules

- Embedded plot SVGs pass through `plotting/standalone-svg.ts` with KaTeX CSS and inline fonts. Why: SVG images cannot inherit page styles.

- Number-line labels use exact rational arithmetic in `line/numeric-labels.ts`, deriving tick labels from the original minimum and step; parsed interval endpoints retain source expressions through normalization and boundary edits. Why: coordinates remain exact and fraction/decimal presentation never relies on rounded geometry or saved label layout.

- Graph captions are derived in `graph-labels.ts`, sized/wrapped and rendered with KaTeX in `graph-caption-layout.ts`, and placed through `label-layout.ts` using visible curve anchors; persist only caption mode and user text, never layout coordinates. Why: preview, embeddings and exports must share mathematical typography and collision-aware labels that adapt to scene edits.

- The app is a math plotting tool (line / plane / space); `/` is the landing page with links to the two tools, `/plot` is the plotting page, `/workspace` is the task editor that embeds plots. Do not reintroduce infographic or style-profile code.
- The plotting UI lives in `PlotWorkbench` and is reused by `/plot` and the `/workspace` plot dialog (entry points in `components/workspace/PlotInsertMenu`); never fork plotting logic for the editor. Why: plotting improvements must reach every embedding.
- Share task/reproduce flows; entry points reset sessions before importing originals, never on workbench unmount. Guard async results by mount/sessionVersion; key previews by version. Why: old dialog teardown must not erase a reopened editor.
- Pass beautification result and busy state through the workbench to insertion dialogs; validate against committed SVG or chart input, ignoring point drafts, and batch via `workspace/plot-insertion.ts`, with scene only on the original. Why: insert both images without losing artwork to temporary input or retaining artwork after chart edits.
- Beautification uses a versioned template selected in `plotting/beautify.ts`, retaining the legacy file unchanged; charts use native PNG export and plots use preview PNG capture, both through the same image client. Why: reliable canvas input and a one-value prompt rollback without forked generation flows.
- All AI calls go through `src/lib/ai/client.ts` -> `/api/ai/text` and `/api/ai/image` (OpenRouter, key `OPENROUTER_API_KEY` read server-side in `openrouter.server.ts`). Why: one thin, provider-specific layer instead of scattered fetches.
- Plotting analysis and verbal construction plans share one structure template injected by prompt builders into existing text fields. Why: text generation, task generation and image reproduction must list future constructions consistently without changing JSON contracts.
- Point-defined graphs share anchors and extendEnds; preserve qualitative for saved smooth graphs and use piecewise-linear with exact sorted vertices for straight segments. Why: JSON compatibility and exact corners across rendering and point solving.
- Document parsing (PDF/DOCX) for AI source material is done in `/api/extract-document`. Why: those parsers need the server runtime.
- Scene JSON save/load lives in `src/lib/plotting/scene-json.ts` (`sceneToJson` / `sceneFromJson`, space part in `space/serialize.ts`): save only user/AI input, omit defaults and anything the builder recomputes; a missing field means "auto". Loading must keep accepting the old full format, covered by `tests/scene-json.test.ts`. Why: compact, AI-friendly files that always rebuild to the same picture.
- Plane axis intersection targets use reserved `axis:x=0` / `axis:y=0` references resolved only for solving, never added to scene graphs; separate intersection cards persist an optional solution index. Why: axis points stay dependent and rebuild without duplicate solutions or extra rendered lines.
- Axis intersections of analytic/smooth point-defined graphs solve the source equation with residual-checked sign roots and local minima in `axis-intersections.ts`; other pairs keep segment solving. Why: tangencies between vertices must not be missed or confused with nearby curves.

- Read subdirectory `AGENTS.md` before edits.
- Workspace inline-image editing uses presentation-only Markdown ranges in `workspace/text-segments.ts` and a selection handle mapping local text offsets to the full source. Why: images appear in place without changing stored plot tokens, formulas or generation input.
- Line batch building assigns completed sets after boundary synchronization updates the scene. Why: reassigning the scene inside a map must not discard built sets while preserving their boundary points.
- Store input actions rebuild committed constructions and dependencies; spatial vertex text commits on blur, with drafts excluded. Why: every workbench updates geometry without a build-all button or premature draft insertion.
- Plane axes split `name` (variable used in formulas) from optional `label` (verbal caption drawn on the axis); AI drafts use xName/yName + xCaption/yCaption, and `axisLabelText` prefers the caption. Why: equations stay correct while the axis can read «время».
- Point labels render `A_1` as A with a subscript via `pointLabelTspans` in render.ts; measurement uses the underscore-stripped plain form. Why: SVG text has no KaTeX, so subscripts are explicit tspans.
