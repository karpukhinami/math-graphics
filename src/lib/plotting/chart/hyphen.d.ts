declare module "hyphen/ru" {
  const russianHyphenation: { hyphenateSync(text: string, options?: { hyphenChar?: string }): string };
  export default russianHyphenation;
}