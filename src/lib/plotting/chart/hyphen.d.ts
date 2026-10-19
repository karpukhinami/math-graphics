declare module "hyphen/ru" {
  export function hyphenateSync(text: string, options?: { hyphenChar?: string }): string;
}