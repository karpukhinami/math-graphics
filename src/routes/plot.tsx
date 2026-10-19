import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { PlotWorkbench } from "@/components/plotting/PlotWorkbench";
import { useEffect, useState } from "react";
import { usePlotStore } from "@/lib/plotting/store";
import { OnboardingTour } from "@/components/OnboardingTour";

export const Route = createFileRoute("/plot")({
  head: () => ({
    meta: [
      { title: "Построить чертёж — конструктор математических чертежей" },
      {
        name: "description",
        content:
          "Конструктор математических чертежей: числовая прямая, координатная плоскость, пространственные фигуры, ИИ-построение и экспорт в SVG или PNG.",
      },
      { property: "og:title", content: "Построить чертёж — конструктор математических чертежей" },
      {
        property: "og:description",
        content:
          "Постройте числовую прямую или координатную плоскость, затем выгрузите чертёж в SVG или PNG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlottingPage,
});

function PlottingPage() {
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    usePlotStore.getState().startSession("ai");
    setSessionReady(true);
  }, []);
  if (!sessionReady) return null;
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <OnboardingTour id="plot" steps={[
        { target: "mode", title: "Два способа", text: "ИИ нарисует сам, а в ручном режиме можно задать всё точно." },
        { target: "scenario", title: "Текст или картинка", text: "Вставьте условие задачи или скриншот чертежа, который нужно повторить." },
        { target: "draw", title: "Нажмите «Нарисовать»", text: "Через несколько секунд справа появится чертёж — его можно поправить и скачать." },
      ]} />
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col p-4 lg:p-6">
        <PlotWorkbench
          title={
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <Home className="size-4" />
                На главную
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
