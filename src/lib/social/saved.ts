/**
 * Saving someone else's dance (from a link or a class) into the library, with credit.
 *
 *   const copy = savedCopy(custom, 'share', shareId);            // saved before? → open it
 *   await save(withCredit(dance, { kind: 'share', ref, author, authorId }));
 */
import { parseDance } from '../validate';
import type { Dance, DanceSource } from '../types';

/** The copy of this link / class post that is already in the library, if any. */
export function savedCopy(custom: Dance[], kind: DanceSource['kind'], ref: string): Dance | undefined {
  return custom.find((d) => d.source?.kind === kind && d.source.ref === ref);
}

/**
 * A new library dance from a received one: a fresh id, the credit, now as created / updated.
 * `dance` must already have been through `parseDance` (it is copied again here).
 */
export function withCredit(dance: Dance, source: DanceSource): Dance {
  const now = Date.now();
  const { builtIn: _b, ...rest } = parseDance(dance);
  return { ...rest, source, createdAt: now, updatedAt: now };
}

/** A received dance (untrusted JSON) → Dance, or null when it cannot be read. */
export function readReceived(data: unknown, untitled: string): Dance | null {
  try {
    const d = parseDance(data, { keepId: true, untitled });
    delete d.source;
    delete d.builtIn;
    return d;
  } catch {
    return null;
  }
}
