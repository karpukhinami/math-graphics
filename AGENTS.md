# Project rules

- Workspace image-only answer layouts share `workspace/answer-layout.ts` for eligibility and column counts in editing and preview. Why: the selected layout must remain identical across both views.
- Embedded plot SVGs pass through `plotting/standalone-svg.ts`, which includes KaTeX CSS and inline font assets. Why: SVG images cannot inherit page styles, and fractions must match the live construction.

- Number-line labels use exact rational arithmetic in `line/numeric-labels.ts`, deriving tick labels from the original minimum and step; parsed interval endpoints retain source expressions through normalization and boundary edits. Why: coordinates remain exact and fraction/decimal presentation never relies on rounded geometry or saved label layout.

- Graph captions are derived in `graph-labels.ts` and placed through the shared `label-layout.ts` engine using multiple visible curve anchors; persist only the chosen caption mode, never layout coordinates. Why: preview, embeddings and exports must share collision-aware labels that adapt to scene edits.

- The app is a math plotting tool (line / plane / space); `/` is the plotting page, `/workspace` is a demo task editor that embeds plots. Do not reintroduce infographic or style-profile code.
- The plotting UI lives in `PlotWorkbench` and is reused by `/` and the `/workspace` plot dialog (entry points in `components/workspace/PlotInsertMenu`); never fork plotting logic for the editor. Why: plotting improvements must reach every embedding.
- Configure embedded plotting through presentation props on the shared workbench, AI panel, and preview; pass source text and generation readiness back through callbacks, keeping them scoped to the dialog session. Why: the editor can simplify individual scenarios without duplicating plotting logic or leaking text between sessions.
- Keep insertion-context and normalized crop geometry helpers in `src/lib/workspace/plot-context.ts`; crop source images in the browser before passing them to the existing AI pipeline. Why: only the selected fragment is submitted and no new server or AI protocol is needed.
- All AI calls go through `src/lib/ai/client.ts` -> `/api/ai/text` and `/api/ai/image` (OpenRouter, key `OPENROUTER_API_KEY` read server-side in `openrouter.server.ts`). Why: one thin, provider-specific layer instead of scattered fetches.
- Point-defined graphs share anchors and extendEnds; preserve qualitative for saved smooth graphs and use piecewise-linear with exact sorted vertices for straight segments. Why: JSON compatibility and exact corners across rendering and point solving.
- Document parsing (PDF/DOCX) for AI source material is done in `/api/extract-document`. Why: those parsers need the server runtime.
- Scene JSON save/load lives in `src/lib/plotting/scene-json.ts` (`sceneToJson` / `sceneFromJson`, space part in `space/serialize.ts`): save only user/AI input, omit defaults and anything the builder recomputes; a missing field means "auto". Loading must keep accepting the old full format, covered by `tests/scene-json.test.ts`. Why: compact, AI-friendly files that always rebuild to the same picture.

- Subdirectories may have their own `AGENTS.md` (e.g. `src/lib/plotting/ai/`); read it before changing files there.
