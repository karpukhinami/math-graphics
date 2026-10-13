import { createFileRoute } from "@tanstack/react-router";
import { aiErrorResponse, openRouterChat, readAiBody } from "@/lib/ai/openrouter.server";

export const Route = createFileRoute("/api/ai/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await readAiBody(request);
          const { message } = await openRouterChat(body, { modalities: ["image", "text"] });
          const first = message.images?.[0]?.image_url;
          const url = typeof first === "string" ? first : (first?.url ?? "");
          if (!url) {
            return Response.json({ error: "Модель не вернула изображение" }, { status: 502 });
          }
          return Response.json({ image: url });
        } catch (e) {
          return aiErrorResponse(e);
        }
      },
    },
  },
});
