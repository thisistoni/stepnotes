/**
 * Plural forms without a library. Each language has a rule that picks a CLDR category for a count;
 * a dictionary entry lists the forms it needs, `#` stands for the formatted number:
 *
 *   plural(RULES.de, n, { one: '# Schritt', other: '# Schritte' }, formatDe)
 *
 * German and English only need `one` / `other`; a language with more forms (Polish: one, few,
 * many) adds its rule here and writes those forms in its dictionary.
 */
import type { Language } from './languages';

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export type PluralForms = Partial<Record<PluralCategory, string>> & { other: string };
export type PluralRule = (n: number) => PluralCategory;

export const RULES: Record<Language, PluralRule> = {
  // "1 Schritt" but "0 Schritte", "½ Schlag" is handled by the caller (fractions are not counts)
  de: (n) => (n === 1 ? 'one' : 'other'),
  en: (n) => (n === 1 ? 'one' : 'other'),
};

export function plural(rule: PluralRule, n: number, forms: PluralForms, format: (n: number) => string = String): string {
  const form = forms[rule(n)] ?? forms.other;
  return form.replace(/#/g, format(n));
}
