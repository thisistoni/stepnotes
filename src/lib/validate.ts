/**
 * Hand-written, dependency-free validation for dances coming from outside the app's own
 * editor: pasted/shared JSON and whatever is found in AsyncStorage.
 *
 *   parseDance(input: unknown, options?) => Dance        // throws DanceValidationError
 *   parseDanceJson(text: string, options?) => Dance      // JSON.parse + parseDance, friendly errors
 *
 * Rules: unknown keys are dropped; strings are trimmed and length-capped; numbers must be finite
 * (numeric strings are accepted) and are clamped into sane ranges (bpm 20–300, beats/bar 1–12,
 * positions ±50); a step's length must be > 0; `videoUrl` is kept only if it is http(s);
 * missing or duplicate step ids are generated. Anything that cannot be repaired throws a
 * `DanceValidationError`; show `err.localized(t)` to the user (`message` is English, for logs).
 */
import { en, type Strings } from './i18n/en';
import { DEFAULT_START, uid } from './pattern';
import type { Dance, Foot, FootPos, FootStyle, Pattern, Role, Step, StepKind } from './types';

/** Where a problem is: e.g. { role: 'leader', step: 3 } → "Leader part, step 3". Empty = whole document. */
export interface ValidationWhere {
  role?: Role;
  start?: boolean;
  /** 1-based */
  step?: number;
}

/** A problem, written by each dictionary: `(v) => v.missing('bpm')`. */
type Issue = (v: Strings['validation']) => string;

export class DanceValidationError extends Error {
  readonly where: ValidationWhere;
  readonly issue: Issue;
  /** true when the text is not a dance at all (as opposed to one broken detail) */
  readonly notADance: boolean;
  constructor(issue: Issue, where: ValidationWhere = {}, notADance = false) {
    super(format(en, issue, where));
    this.name = 'DanceValidationError';
    this.where = where;
    this.issue = issue;
    this.notADance = notADance;
  }
  /** The message in the user's language. */
  localized(t: Strings) {
    return format(t, this.issue, this.where);
  }
}

function format(t: Strings, issue: Issue, where: ValidationWhere) {
  return t.validation.withWhere(t.validation.where(where), issue(t.validation));
}

export interface ParseOptions {
  /** Keep the incoming id (loading from storage). Default false: a fresh id is generated (import). */
  keepId?: boolean;
  /** Name for a dance without one (default: the English "Untitled dance") */
  untitled?: string;
}

export const LIMITS = {
  name: 120,
  style: 60,
  description: 4000,
  note: 500,
  count: 8,
  url: 2000,
  steps: 500,
  coord: 50,
  bpm: [20, 300],
  beatsPerBar: [1, 12],
  stepBeats: [0.125, 32],
} as const;

const KINDS: StepKind[] = ['step', 'tap', 'hold'];
const STYLES: FootStyle[] = ['shoe', 'heel'];
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function str(v: unknown, max: number, where: ValidationWhere, field: string, fallback = ''): string {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v).slice(0, max);
  if (typeof v !== 'string') throw new DanceValidationError((m) => m.notText(field), where);
  return v.trim().slice(0, max);
}

/** Number or numeric string -> finite number, else throws. `undefined` -> fallback. */
function num(v: unknown, where: ValidationWhere, field: string, fallback?: number): number {
  if ((v === undefined || v === null || v === '') && fallback !== undefined) return fallback;
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) {
    throw new DanceValidationError(v === undefined || v === null ? (m) => m.missing(field) : (m) => m.notNumber(field), where);
  }
  return n;
}

function safeId(v: unknown): string | null {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v.trim()) ? v.trim() : null;
}

/** Rotation normalised to (-180, 180]. */
function normRot(r: number) {
  let d = r % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d === 0 ? 0 : d; // no -0
}

function footPos(v: unknown, where: ValidationWhere, field: string): FootPos {
  if (!isObject(v)) throw new DanceValidationError((m) => m.positionMissing(field), where);
  const c = LIMITS.coord;
  return {
    x: clamp(num(v.x, where, `${field}.x`), -c, c),
    y: clamp(num(v.y, where, `${field}.y`), -c, c),
    rot: normRot(num(v.rot, where, `${field}.rot`, 0)),
  };
}

function foot(v: unknown, where: ValidationWhere): Foot {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  if (s === 'L' || s === 'LEFT') return 'L';
  if (s === 'R' || s === 'RIGHT') return 'R';
  throw new DanceValidationError((m) => m.badFoot, where);
}

function pattern(v: unknown, role: Role): Pattern {
  const where: ValidationWhere = { role };
  if (!isObject(v)) throw new DanceValidationError((m) => m.partMissing, where);
  const atStart: ValidationWhere = { role, start: true };
  const start: Record<Foot, FootPos> = isObject(v.start)
    ? {
        L: v.start.L === undefined ? { ...DEFAULT_START.L } : footPos(v.start.L, atStart, 'L'),
        R: v.start.R === undefined ? { ...DEFAULT_START.R } : footPos(v.start.R, atStart, 'R'),
      }
    : { L: { ...DEFAULT_START.L }, R: { ...DEFAULT_START.R } };
  if (v.steps === undefined) throw new DanceValidationError((m) => m.noSteps, where);
  if (!Array.isArray(v.steps)) throw new DanceValidationError((m) => m.stepsNotList, where);
  const count = v.steps.length;
  if (count > LIMITS.steps) throw new DanceValidationError((m) => m.tooManySteps(count, LIMITS.steps), where);

  const seen = new Set<string>();
  const pos = { ...start };
  const steps = v.steps.map((raw, i): Step => {
    const w: ValidationWhere = { role, step: i + 1 };
    if (!isObject(raw)) throw new DanceValidationError((m) => m.notAStep, w);
    const kindRaw = raw.kind === undefined ? 'step' : raw.kind;
    if (typeof kindRaw !== 'string' || !KINDS.includes(kindRaw as StepKind)) {
      throw new DanceValidationError((m) => m.badKind, w);
    }
    const kind = kindRaw as StepKind;
    const f = foot(raw.foot, w);
    const beats = num(raw.beats, w, 'beats', 1);
    if (beats <= 0) throw new DanceValidationError((m) => m.badBeats, w);
    // a hold does not move, so a missing position is harmless: keep the foot where it is
    const to = kind === 'hold' && raw.to === undefined ? { ...pos[f] } : footPos(raw.to, w, 'to');
    if (kind !== 'hold') pos[f] = to;
    let id = safeId(raw.id);
    if (!id || seen.has(id)) id = uid('step');
    seen.add(id);
    const note = str(raw.note, LIMITS.note, w, 'note');
    const step: Step = {
      id,
      count: str(raw.count, LIMITS.count, w, 'count'),
      beats: clamp(beats, LIMITS.stepBeats[0], LIMITS.stepBeats[1]),
      foot: f,
      kind,
      to,
    };
    if (note) step.note = note;
    return step;
  });
  return { start, steps };
}

function videoUrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (s.length > LIMITS.url || !/^https?:\/\/[^\s]+$/i.test(s)) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : undefined;
  } catch {
    return undefined;
  }
}

function timestamp(v: unknown, fallback: number) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
}

/** Validate and normalise anything into a `Dance`. Throws `DanceValidationError`. */
export function parseDance(input: unknown, options: ParseOptions = {}): Dance {
  if (!isObject(input)) throw new DanceValidationError((m) => m.notADance, {}, true);
  if (!isObject(input.roles) || input.roles.leader === undefined) {
    throw new DanceValidationError((m) => m.noRoles, {}, true);
  }
  const doc: ValidationWhere = {};
  const now = Date.now();
  const roles: Dance['roles'] = { leader: pattern(input.roles.leader, 'leader') };
  if (input.roles.follower !== undefined && input.roles.follower !== null) {
    roles.follower = pattern(input.roles.follower, 'follower');
  }

  const dance: Dance = {
    id: (options.keepId && safeId(input.id)) || uid('dance'),
    name: str(input.name, LIMITS.name, doc, 'name') || options.untitled || en.common.untitled,
    style: str(input.style, LIMITS.style, doc, 'style'),
    description: str(input.description, LIMITS.description, doc, 'description'),
    bpm: Math.round(clamp(num(input.bpm, doc, 'bpm', 120), LIMITS.bpm[0], LIMITS.bpm[1])),
    beatsPerBar: Math.round(clamp(num(input.beatsPerBar, doc, 'beatsPerBar', 4), LIMITS.beatsPerBar[0], LIMITS.beatsPerBar[1])),
    roles,
    createdAt: timestamp(input.createdAt, now),
    updatedAt: timestamp(input.updatedAt, now),
  };

  if (isObject(input.footStyle)) {
    const fs: Partial<Record<Role, FootStyle>> = {};
    for (const r of ['leader', 'follower'] as Role[]) {
      const v = input.footStyle[r];
      if (typeof v === 'string' && STYLES.includes(v as FootStyle)) fs[r] = v as FootStyle;
    }
    if (Object.keys(fs).length) dance.footStyle = fs;
  }
  const url = videoUrl(input.videoUrl);
  if (url) dance.videoUrl = url;
  return dance;
}

/**
 * Parse text that someone pasted. Tolerates text around the JSON (e.g. a chat message that
 * says "here's the dance: {...}") and turns JSON syntax errors into a friendly message.
 */
export function parseDanceJson(text: string, options: ParseOptions = {}): Dance {
  const trimmed = text.trim();
  if (!trimmed) throw new DanceValidationError((m) => m.empty);
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first < 0 || last <= first) throw new DanceValidationError((m) => m.noJson, {}, true);
  let data: unknown;
  try {
    data = JSON.parse(trimmed.slice(first, last + 1));
  } catch {
    throw new DanceValidationError((m) => m.badJson);
  }
  return parseDance(data, options);
}
