import { createFileRoute } from "@tanstack/react-router";
import { aiErrorResponse, openRouterChat, readAiBody } from "@/lib/ai/openrouter.server";

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === "string" ? p : ((p as { text?: string })?.text ?? "")))
      .join("");
  }
  return "";
}

export const Route = createFileRoute("/api/ai/text")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await readAiBody(request);
          const { message, finishReason } = await openRouterChat(body, { max_tokens: 16000 });
          const text = contentToText(message.content);
          if (!text) {
            return Response.json(
              { error: `Модель не вернула текст${finishReason ? ` (${finishReason})` : ""}` },
              { status: 502 },
            );
          }
          return Response.json({ text, truncated: finishReason === "length" });
        } catch (e) {
          return aiErrorResponse(e);
        }
      },
    },
  },
});
