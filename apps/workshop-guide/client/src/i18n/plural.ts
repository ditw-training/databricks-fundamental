/** Plural forms. Polish: 1 krok, 2–4 kroki, 5+ kroków (12–14 too), 22 kroki. */
const plRules = new Intl.PluralRules('pl');

export function plPlural(n: number, one: string, few: string, many: string): string {
  const rule = plRules.select(n);
  return rule === 'one' ? one : rule === 'few' ? few : many;
}

export const enPlural = (n: number, one: string, other: string) => (n === 1 ? one : other);
