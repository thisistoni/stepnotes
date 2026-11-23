import { useMemo } from 'react';

import type { Dance } from '@/lib/types';

export interface StyleFilter {
  /** lower-case key */
  key: string;
  /** label as first written in the data */
  label: string;
}

/** Styles present in the data (first spelling wins), in order of first appearance. Empty styles skipped. */
export function useStyleFilters(dances: Dance[]): StyleFilter[] {
  return useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of dances) {
      const label = d.style.trim();
      const key = label.toLowerCase();
      if (key && !seen.has(key)) seen.set(key, label);
    }
    return [...seen].map(([key, label]) => ({ key, label }));
  }, [dances]);
}

/** Case-insensitive match on name and style; every word of the query must match. */
export function matches(d: Dance, query: string, styleKey: string | null) {
  if (styleKey && d.style.trim().toLowerCase() !== styleKey) return false;
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${d.name} ${d.style}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}
