import { createFileRoute, Link } from "@tanstack/react-router";
import { PenLine, FileText } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "«Плотник» — чертежи и задания по математике" },
      {
        name: "description",
        content:
          "Инструмент для математических построений: постройте диаграмму, чертёж на числовой прямой, плоскости или в пространстве, либо соберите задание с чертежами и формулами.",
      },
      { property: "og:title", content: "«Плотник» — чертежи и задания по математике" },
      {
        property: "og:description",
        content: "Постройте математический чертёж или создайте задание с чертежами, формулами и вариантами ответов.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 p-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight"></h1>
          <p className="mt-2 text-muted-foreground">Выберите, что хотите создать:</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
          <Link
            to="/plot"
            className="group flex aspect-square flex-col items-center justify-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PenLine className="h-14 w-14 text-primary transition-transform group-hover:scale-110" />
            <span className="text-xl font-semibold">Чертёж или диаграмма</span>
            <span className="text-sm text-muted-foreground">
              Графики функций, числовые прямые, геометрические чертежи и диаграммы — вручную или с помощью ИИ
            </span>
          </Link>
          <Link
            to="/workspace"
            className="group flex aspect-square flex-col items-center justify-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileText className="h-14 w-14 text-primary transition-transform group-hover:scale-110" />
            <span className="text-xl font-semibold">Задание с графикой</span>
            <span className="text-sm text-muted-foreground">
              Задания с формулами, чертежами и диаграммами, генерация аналогов и экспорт в Word
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
