/** The app's languages. Adding one: add its code here, a dictionary next to `en.ts`, a plural rule and a speech tag. */
export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

// Preview default for the Austrian test users: German until the app follows the device language.
export const DEFAULT_LANGUAGE: Language = 'de';

export const isLanguage = (v: unknown): v is Language => typeof v === 'string' && (LANGUAGES as readonly string[]).includes(v);

/** Each language's own name, written in that language (the language sheet shows these, never translated). */
export const LANGUAGE_NAME: Record<Language, string> = { de: 'Deutsch', en: 'English' };
