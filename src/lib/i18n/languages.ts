/** The app's languages. Adding one: add its code here, a dictionary next to `en.ts`, a plural rule and a speech tag. */
export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const isLanguage = (v: unknown): v is Language => typeof v === 'string' && (LANGUAGES as readonly string[]).includes(v);

/** Each language's own name, written in that language (the language sheet shows these, never translated). */
export const LANGUAGE_NAME: Record<Language, string> = { de: 'Deutsch', en: 'English' };

/**
 * The device's language as one of ours: German if the device (or browser) is set to German,
 * otherwise English. Uses `Intl` (Hermes and browsers) and `navigator.languages` on the web, so no
 * native module is needed. On iOS the app declares both languages (CFBundleLocalizations in
 * app.json), so the system reports German for a German device.
 */
export function deviceLanguage(): Language {
  const tags: string[] = [];
  try {
    const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } }).navigator;
    if (nav?.languages?.length) tags.push(...nav.languages);
    else if (nav?.language) tags.push(nav.language);
  } catch {}
  try {
    tags.push(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {}
  const first = tags.find((t) => typeof t === 'string' && t.length >= 2);
  return first?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

/** Used until the user picks a language (intro DE | EN, or the language sheet on the Me tab). */
export const DEFAULT_LANGUAGE: Language = deviceLanguage();
