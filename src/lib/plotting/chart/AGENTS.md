# Chart mode (stat-deco) rules

- Chart mode (sceneType "chart") lives in `src/lib/plotting/chart/`: the model returns table + chartType in analysis `stageData.chart` (no second LLM stage); colors come only from PLOT_PALETTE via `chart/colors.ts`, ECharts option is built in `chart/echarts-option.ts`, preview is `ChartPreview.tsx`, PNG via `chart/chart-png.ts`; chart JSON is stored in the plot store field `chart`, not in PlotScene. Why: diagrams are data-driven, not scene-driven, and must share the math palette.
- Do not port the archive's palette wheel, design profiles, or artistic beautification instructions for charts. Why: charts use our palette and the shared "Сделать красиво" flow.
