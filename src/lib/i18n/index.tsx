/**
 * Tiny typed i18n: one dictionary per language (`en.ts` defines the type), the language lives in
 * prefs, and a context hands every component the current dictionary.
 *
 *   const t = useT();                 // re-renders this component when the language changes
 *   <Text>{t.library.title}</Text>     t.count.stepOf(3, 8)     t.library.cardMeta(8, 180)
 *   describeStep(step, before, t)      // non-React code takes the dictionary as an argument
 *   toast.show({ message: (t) => t.editor.saved })   // lazy text: re-resolved on a switch
 *
 * Switching: `I18nProvider` reads `prefs.language`; its context value changes only when the
 * language does, and React re-renders every consumer (also inside memo() and on screens further
 * down the navigation stack). Nothing is cached in module state except `getStrings()`, the
 * fallback for code that may render outside the providers (the root error screen).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { PersistError } from '../persist';
import { usePrefs } from '../prefs';
import { DanceValidationError } from '../validate';

import { de } from './de';
import { en, type Strings } from './en';
import { DEFAULT_LANGUAGE, type Language } from './languages';

export type { Strings } from './en';
export { DEFAULT_LANGUAGE, LANGUAGE_NAME, LANGUAGES, isLanguage, type Language } from './languages';

export const STRINGS: Record<Language, Strings> = { de, en };

/** Text that is resolved when it is shown (toasts, dialogs): a string, or a function of the dictionary. */
export type Localized = string | ((t: Strings) => string);
export const resolveText = (text: Localized, t: Strings) => (typeof text === 'function' ? text(t) : text);

let current: Language = DEFAULT_LANGUAGE;
/** The dictionary of the current language, for code that cannot use the hook (error boundary). */
export const getStrings = (): Strings => STRINGS[current];

interface I18n {
  language: Language;
  t: Strings;
  setLanguage: (language: Language) => void;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { prefs, set } = usePrefs();
  const language = prefs.language;
  const setLanguage = useCallback((l: Language) => void set({ language: l }), [set]);
  const value = useMemo(() => ({ language, t: STRINGS[language], setLanguage }), [language, setLanguage]);

  useEffect(() => {
    current = language;
    // the page's language (screen readers, hyphenation, translation prompts)
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = STRINGS[language].code;
  }, [language]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/** The current dictionary. */
export const useT = () => useI18n().t;

/** Splits "Leaders start on the **left foot**." into plain and emphasised parts. */
export function emphasis(text: string): { text: string; strong: boolean }[] {
  return text
    .split('**')
    .map((part, i) => ({ text: part, strong: i % 2 === 1 }))
    .filter((p) => p.text);
}

/** Speech language tag for this platform (see `speech` in the dictionaries). */
export function speechLanguage(t: Strings) {
  return Platform.OS === 'android' ? t.speech.android : Platform.OS === 'ios' ? t.speech.ios : t.speech.web;
}

/** The dictionary, also outside the provider (falls back to the last known language). */
export function useOptionalT(): Strings {
  return useContext(Ctx)?.t ?? getStrings();
}

/** A user-facing message for a caught error: validation and storage errors explain themselves. */
export function errorText(e: unknown, t: Strings, fallback: string): string {
  if (e instanceof DanceValidationError) return e.localized(t);
  if (e instanceof PersistError) return t.persist[e.reason];
  return fallback;
}
