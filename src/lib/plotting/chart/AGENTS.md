# Chart mode (stat-deco) rules

- Category-axis labels automatically tilt when measured text exceeds the available slot; preview recomputes on resize and PNG uses its export width through the same option builder. Why: label layout must follow actual image dimensions without persisting presentation state.

- Chart mode (sceneType "chart") lives in `src/lib/plotting/chart/`: the model returns table + chartType in analysis `stageData.chart` (no second LLM stage); colors come only from PLOT_PALETTE via `chart/colors.ts`, ECharts option is built in `chart/echarts-option.ts`, preview is `ChartPreview.tsx`, PNG via `chart/chart-png.ts`; chart JSON is stored in the plot store, not in PlotScene. Why: diagrams are data-driven, not scene-driven, and must share the math palette.
- Do not port the archive's palette wheel, design profiles, or artistic beautification instructions for charts. Why: charts use our palette and the shared "Сделать красиво" flow.
- Charts are stored as an array `charts: StatDecoJson[]` in the plot store, edited manually via `ChartManualPanel` (tab «Диаграмма») and filled by AI through `setCharts`, which runs `normalizeChart` to add defaults for fields AI did not send (`chart/editor.ts`). Why: manual and AI charts share one format, so AI output needs no conversion.

- Value-axis bounds and intervals are derived from plotted data by `grid-scale.ts`; legacy headroom never affects a visible grid. Why: manual and AI charts must use the same scale without model-chosen bounds.
- Horizontal category labels use measured bounded width and Russian hyphenation in `category-labels.ts`; value-axis captions sit below the axis at its center. Why: labels must not create unused margins or clipped captions.
- Volume bars use custom ECharts series with explicit prism faces; volume pies use elliptical sectors with extruded walls in `volume.ts`, shared by preview and PNG. Why: geometry must preserve the flat chart's data and palette rather than substitute gradients.
