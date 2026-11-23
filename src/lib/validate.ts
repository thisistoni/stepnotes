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
 * `DanceValidationError` whose message can be shown to the user as is.
 */
import { DEFAULT_START, uid } from './pattern';
import type { Dance, Foot, FootPos, FootStyle, Pattern, Role, Step, StepKind } from './types';

export class DanceValidationError extends Error {
  /** Where the problem is, e.g. "leader part, step 3". Empty for whole-document problems. */
  readonly where: string;
  constructor(message: string, where = '') {
    super(where ? `${capitalise(where)}: ${message}` : message);
    this.name = 'DanceValidationError';
    this.where = where;
  }
}

export interface ParseOptions {
  /** Keep the incoming id (loading from storage). Default false: a fresh id is generated (import). */
  keepId?: boolean;
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
const ROLE_NAME: Record<Role, string> = { leader: 'leader part', follower: 'follower part' };

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function str(v: unknown, max: number, where: string, field: string, fallback = ''): string {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v).slice(0, max);
  if (typeof v !== 'string') throw new DanceValidationError(`“${field}” should be text.`, where);
  return v.trim().slice(0, max);
}

/** Number or numeric string -> finite number, else throws. `undefined` -> fallback. */
function num(v: unknown, where: string, field: string, fallback?: number): number {
  if ((v === undefined || v === null || v === '') && fallback !== undefined) return fallback;
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) {
    throw new DanceValidationError(
      v === undefined || v === null ? `“${field}” is missing.` : `“${field}” should be a number.`,
      where,
    );
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

function footPos(v: unknown, where: string, field: string): FootPos {
  if (!isObject(v)) throw new DanceValidationError(`“${field}” (the foot position) is missing.`, where);
  const c = LIMITS.coord;
  return {
    x: clamp(num(v.x, where, `${field}.x`), -c, c),
    y: clamp(num(v.y, where, `${field}.y`), -c, c),
    rot: normRot(num(v.rot, where, `${field}.rot`, 0)),
  };
}

function foot(v: unknown, where: string): Foot {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  if (s === 'L' || s === 'LEFT') return 'L';
  if (s === 'R' || s === 'RIGHT') return 'R';
  throw new DanceValidationError('“foot” should be "L" or "R".', where);
}

function pattern(v: unknown, role: Role): Pattern {
  const where = ROLE_NAME[role];
  if (!isObject(v)) throw new DanceValidationError('is missing or not a list of steps.', where);
  const start: Record<Foot, FootPos> = isObject(v.start)
    ? {
        L: v.start.L === undefined ? { ...DEFAULT_START.L } : footPos(v.start.L, `${where}, start position`, 'L'),
        R: v.start.R === undefined ? { ...DEFAULT_START.R } : footPos(v.start.R, `${where}, start position`, 'R'),
      }
    : { L: { ...DEFAULT_START.L }, R: { ...DEFAULT_START.R } };
  if (v.steps === undefined) throw new DanceValidationError('has no steps.', where);
  if (!Array.isArray(v.steps)) throw new DanceValidationError('“steps” should be a list.', where);
  if (v.steps.length > LIMITS.steps) {
    throw new DanceValidationError(`has ${v.steps.length} steps; the maximum is ${LIMITS.steps}.`, where);
  }

  const seen = new Set<string>();
  const pos = { ...start };
  const steps = v.steps.map((raw, i): Step => {
    const w = `${where}, step ${i + 1}`;
    if (!isObject(raw)) throw new DanceValidationError('is not a step.', w);
    const kindRaw = raw.kind === undefined ? 'step' : raw.kind;
    if (typeof kindRaw !== 'string' || !KINDS.includes(kindRaw as StepKind)) {
      throw new DanceValidationError('“kind” should be "step", "tap" or "hold".', w);
    }
    const kind = kindRaw as StepKind;
    const f = foot(raw.foot, w);
    const beats = num(raw.beats, w, 'beats', 1);
    if (beats <= 0) throw new DanceValidationError('“beats” (the step length) must be greater than 0.', w);
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
  if (!isObject(input)) throw new DanceValidationError('This does not look like a StepNotes dance.');
  if (!isObject(input.roles) || input.roles.leader === undefined) {
    throw new DanceValidationError('This does not look like a StepNotes dance (it has no steps).');
  }
  const now = Date.now();
  const roles: Dance['roles'] = { leader: pattern(input.roles.leader, 'leader') };
  if (input.roles.follower !== undefined && input.roles.follower !== null) {
    roles.follower = pattern(input.roles.follower, 'follower');
  }

  const dance: Dance = {
    id: (options.keepId && safeId(input.id)) || uid('dance'),
    name: str(input.name, LIMITS.name, '', 'name') || 'Untitled dance',
    style: str(input.style, LIMITS.style, '', 'style'),
    description: str(input.description, LIMITS.description, '', 'description'),
    bpm: Math.round(clamp(num(input.bpm, '', 'bpm', 120), LIMITS.bpm[0], LIMITS.bpm[1])),
    beatsPerBar: Math.round(clamp(num(input.beatsPerBar, '', 'beatsPerBar', 4), LIMITS.beatsPerBar[0], LIMITS.beatsPerBar[1])),
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
  if (!trimmed) throw new DanceValidationError('Paste a dance first.');
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first < 0 || last <= first) {
    throw new DanceValidationError(
      'This is not a StepNotes dance. A shared dance is a block of text that starts with { and ends with }.',
    );
  }
  let data: unknown;
  try {
    data = JSON.parse(trimmed.slice(first, last + 1));
  } catch {
    throw new DanceValidationError(
      'This text could not be read. It may have been cut off or changed: copy the whole shared text again, from { to }.',
    );
  }
  return parseDance(data, options);
}
