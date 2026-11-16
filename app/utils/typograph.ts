// Russian typography: one- and two-letter words (и, в, с, на, не…) must not hang at a line end.
export function glueShortWords(text: string): string {
  return text.replace(/(?<=^|[\s(«])([а-яёА-ЯЁ]{1,2}) +/g, '$1 ')
}
