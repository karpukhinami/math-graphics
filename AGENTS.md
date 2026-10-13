# Project rules

- The app is a single-purpose math plotting tool (line / plane / space); `/` is the plotting page. Do not reintroduce infographic, workspace or style-profile code.
- All AI calls go through `src/lib/ai/client.ts` -> `/api/ai/text` and `/api/ai/image` (OpenRouter, key `OPENROUTER_API_KEY` read server-side in `openrouter.server.ts`). Why: one thin, provider-specific layer instead of scattered fetches.
- Plotting AI prompts live as `.txt` templates in `src/lib/plotting/ai/templates/`, imported with `?raw`. Why: prompts stay editable without touching code.
- Document parsing (PDF/DOCX) for AI source material is done in `/api/extract-document`. Why: those parsers need the server runtime.
