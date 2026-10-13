# Project rules

- The app is a single-purpose math plotting tool (line / plane / space); `/` is the plotting page. Do not reintroduce infographic, workspace or style-profile code.
- All AI calls go through `src/lib/ai/client.ts` -> `/api/ai/text` and `/api/ai/image` (OpenRouter, key `OPENROUTER_API_KEY` read server-side in `openrouter.server.ts`). Why: one thin, provider-specific layer instead of scattered fetches.
- Plotting AI prompts live as `.txt` templates in `src/lib/plotting/ai/templates/`, imported with `?raw`. Why: prompts stay editable without touching code.
- «Нарисовать по заданию» for line/plane: stage 1 returns `reasoning` + explicit `drawPlan` + `sceneType`; stage 2 gets only `drawPlan` and fills a reduced draft (`generate-draw-line.txt` / `generate-draw-plane.txt`), which `draft-line.ts` / `draft-plane.ts` expand into the full scene (colors, widths, steps, ids are set in code, never by the model). Prefer tool-side relations (intersection / onGraph / graphPoint) over model-computed coordinates. Space still uses the old full-schema path. Why: the model decides only content; the app owns technical and visual values.
- Point-defined graphs share anchors and extendEnds; preserve qualitative for saved smooth graphs and use piecewise-linear with exact sorted vertices for straight segments. Why: JSON compatibility and exact corners across rendering and point solving.
- Document parsing (PDF/DOCX) for AI source material is done in `/api/extract-document`. Why: those parsers need the server runtime.
