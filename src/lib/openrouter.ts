// Ключ хранится в секретах проекта (OPENROUTER_API_KEY). Читать только на сервере, внутри обработчиков.
export function getOpenRouterKey(): string {
  return process.env.OPENROUTER_API_KEY ?? "";
}
