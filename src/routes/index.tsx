import { createFileRoute, Link } from "@tanstack/react-router";
import { PenLine, FileText } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plotting — чертежи и задания по математике" },
      {
        name: "description",
        content:
          "Инструмент для математических построений: постройте чертёж на числовой прямой, плоскости или в пространстве, либо соберите задание с чертежами и формулами.",
      },
      { property: "og:title", content: "Plotting — чертежи и задания по математике" },
      {
        property: "og:description",
        content:
          "Постройте математический чертёж или создайте задание с чертежами, формулами и вариантами ответов.",
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
          <h1 className="text-3xl font-semibold tracking-tight">Plotting</h1>
          <p className="mt-2 text-muted-foreground">
            Математические чертежи и задания — выберите, что хотите сделать.
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
          <Link
            to="/plot"
            className="group flex aspect-square flex-col items-center justify-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PenLine className="h-14 w-14 text-primary transition-transform group-hover:scale-110" />
            <span className="text-xl font-semibold">Построить чертёж</span>
            <span className="text-sm text-muted-foreground">
              Числовая прямая, координатная плоскость, пространственные фигуры и ИИ-построение
            </span>
          </Link>
          <Link
            to="/workspace"
            className="group flex aspect-square flex-col items-center justify-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileText className="h-14 w-14 text-primary transition-transform group-hover:scale-110" />
            <span className="text-xl font-semibold">Создать задание</span>
            <span className="text-sm text-muted-foreground">
              Конструктор заданий с чертежами, формулами, вопросами и выгрузкой в Word
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
