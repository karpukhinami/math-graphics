# src/lib/workspace rules

- Workspace image-only answer layouts share `workspace/answer-layout.ts` for eligibility and column counts in editing and preview. Why: the selected layout must remain identical across both views.
- Keep insertion-context, selected-text generation source and normalized crop geometry helpers in `src/lib/workspace/plot-context.ts`; read the text area's selection for text blocks and crop source images in the browser before passing them to the existing AI pipeline. Why: only the selected fragment is submitted and no new server or AI protocol is needed.
- Workspace Word export is built in the browser by `workspace/docx-export.ts` (docx + temml + mathml2omml; images rasterized to PNG). Why: LaTeX becomes native Word equations without a server round-trip.
- Import Word (.docx) in the workspace runs client-side in `workspace/docx-import.ts` (OMML → LaTeX, images → plot tokens) into one text block. Why: formulas must survive as editable LaTeX, which server text extraction drops.
