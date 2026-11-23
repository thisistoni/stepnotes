/**
 * Editor state: the draft dance, the selection and an undo stack.
 *
 *   const d = useDanceDraft(initial);
 *   d.draft, d.role, d.sel (-1 = start position), d.startFoot, d.canUndo, d.dirty
 *   d.addStep(), d.updateStep(i, patch, group?), d.beginDrag(foot) / d.dragTo(x, y) / d.endDrag(), d.undo() …
 *
 * Every mutation is undoable and restores the selection that went with it. Rules:
 *   - A drag is ONE undo entry (pushed on the first real move; a grab without a move adds none).
 *   - Typing is coalesced: consecutive edits with the same `group` (e.g. 'name') are one entry
 *     until `seal()` (field blur) or any other action.
 *   - `dirty` = the draft differs from what was loaded (undoing everything clears it).
 */
import { useCallback, useMemo, useReducer } from 'react';

import type { Strings } from './i18n/en';
import { computeStates, nextCount, otherFoot, toPartner, uid } from './pattern';
import type { Dance, Foot, FootPos, Pattern, Role, Step, StepKind } from './types';

const MAX_UNDO = 100;

interface Snapshot {
  draft: Dance;
  role: Role;
  sel: Record<Role, number>;
  startFoot: Foot;
}

export interface DraftState extends Snapshot {
  initial: Dance;
  past: Snapshot[];
  /** increases with every change to the draft (edits, drags, undo); never wraps or caps */
  rev: number;
  /** coalescing key of the last edit (typing) */
  group: string | null;
  /** drag in progress: the snapshot to push on the first real move */
  pending: Snapshot | null;
  dragging: boolean;
}

type Edit = (s: DraftState) => Partial<Snapshot> | null;

type Action =
  | { type: 'edit'; edit: Edit; group?: string }
  | { type: 'select'; index: number }
  | { type: 'role'; role: Role }
  | { type: 'startFoot'; foot: Foot }
  | { type: 'dragStart'; foot: Foot }
  | { type: 'dragMove'; foot: Foot; x: number; y: number }
  | { type: 'dragEnd' }
  | { type: 'undo' }
  | { type: 'seal' };

const snap = (s: DraftState): Snapshot => ({ draft: s.draft, role: s.role, sel: s.sel, startFoot: s.startFoot });
const push = (past: Snapshot[], s: Snapshot) => (past.length >= MAX_UNDO ? [...past.slice(1), s] : [...past, s]);

function withPattern(d: Dance, role: Role, p: Pattern): Dance {
  return { ...d, roles: { ...d.roles, [role]: p } };
}

function reducer(state: DraftState, a: Action): DraftState {
  switch (a.type) {
    case 'edit': {
      const next = a.edit(state);
      if (!next || (next.draft === undefined && next.role === undefined && next.sel === undefined)) return state;
      if (next.draft === state.draft && next.role === undefined && next.sel === undefined) return state;
      const coalesce = !!a.group && a.group === state.group;
      return {
        ...state,
        ...next,
        past: coalesce ? state.past : push(state.past, snap(state)),
        rev: state.rev + 1,
        group: a.group ?? null,
        pending: null,
      };
    }
    case 'select':
      if (state.sel[state.role] === a.index) return state;
      return { ...state, sel: { ...state.sel, [state.role]: a.index }, group: null };
    case 'role':
      return state.role === a.role ? state : { ...state, role: a.role, group: null };
    case 'startFoot':
      return state.startFoot === a.foot ? state : { ...state, startFoot: a.foot };
    case 'dragStart': {
      const atStart = state.sel[state.role] < 0;
      const base = atStart ? { ...state, startFoot: a.foot } : state;
      return { ...base, pending: snap(state), dragging: true, group: null };
    }
    case 'dragMove': {
      const p = state.draft.roles[state.role];
      if (!p || !state.dragging) return state;
      const i = state.sel[state.role];
      let np: Pattern;
      if (i < 0) {
        const old = p.start[a.foot];
        if (old.x === a.x && old.y === a.y) return state;
        np = { ...p, start: { ...p.start, [a.foot]: { x: a.x, y: a.y, rot: old.rot } } };
      } else {
        const st = p.steps[i];
        if (!st || st.kind === 'hold' || st.foot !== a.foot) return state;
        if (st.to.x === a.x && st.to.y === a.y) return state;
        np = { ...p, steps: p.steps.map((s, k) => (k === i ? { ...s, to: { x: a.x, y: a.y, rot: s.to.rot } } : s)) };
      }
      return {
        ...state,
        draft: withPattern(state.draft, state.role, np),
        past: state.pending ? push(state.past, state.pending) : state.past,
        rev: state.rev + 1,
        pending: null,
      };
    }
    case 'dragEnd':
      return state.dragging || state.pending ? { ...state, dragging: false, pending: null } : state;
    case 'undo': {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return { ...state, ...prev, past: state.past.slice(0, -1), rev: state.rev + 1, group: null, pending: null, dragging: false };
    }
    case 'seal':
      return state.group ? { ...state, group: null } : state;
  }
}

function init(initial: Dance): DraftState {
  return {
    initial,
    draft: initial,
    role: 'leader',
    sel: { leader: -1, follower: -1 },
    startFoot: 'L',
    past: [],
    rev: 0,
    group: null,
    pending: null,
    dragging: false,
  };
}

const normRot = (r: number) => {
  let d = r % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d === 0 ? 0 : d;
};

export function useDanceDraft(initial: Dance) {
  const [state, dispatch] = useReducer(reducer, initial, init);

  const edit = useCallback((e: Edit, group?: string) => dispatch({ type: 'edit', edit: e, group }), []);

  /** Edit the current role's pattern; `sel` (optional) is the new selection for that role. */
  const editPattern = useCallback(
    (fn: (p: Pattern, s: DraftState) => { p: Pattern; sel?: number } | null, group?: string) =>
      edit((s) => {
        const p = s.draft.roles[s.role];
        if (!p) return null;
        const r = fn(p, s);
        if (!r) return null;
        return {
          draft: r.p === p ? s.draft : withPattern(s.draft, s.role, r.p),
          ...(r.sel !== undefined && r.sel !== s.sel[s.role] ? { sel: { ...s.sel, [s.role]: r.sel } } : {}),
        };
      }, group),
    [edit],
  );

  const actions = useMemo(
    () => ({
      select: (index: number) => dispatch({ type: 'select', index }),
      setRole: (role: Role) => dispatch({ type: 'role', role }),
      setStartFoot: (foot: Foot) => dispatch({ type: 'startFoot', foot }),
      undo: () => dispatch({ type: 'undo' }),
      /** End a coalesced typing run (call on blur). */
      seal: () => dispatch({ type: 'seal' }),

      beginDrag: (foot: Foot) => dispatch({ type: 'dragStart', foot }),
      dragTo: (foot: Foot, x: number, y: number) => dispatch({ type: 'dragMove', foot, x, y }),
      endDrag: () => dispatch({ type: 'dragEnd' }),

      /** Name, style, bpm… `group` coalesces typing into one undo entry. */
      setDetails: (patch: Partial<Dance>, group?: string) =>
        edit((s) => {
          const changed = (Object.keys(patch) as (keyof Dance)[]).some((k) => s.draft[k] !== patch[k]);
          return changed ? { draft: { ...s.draft, ...patch } } : null;
        }, group),

      updateStep: (index: number, patch: Partial<Step>, group?: string) =>
        editPattern((p) => {
          const st = p.steps[index];
          if (!st) return null;
          const changed = (Object.keys(patch) as (keyof Step)[]).some((k) => st[k] !== patch[k]);
          if (!changed) return null;
          return { p: { ...p, steps: p.steps.map((x, k) => (k === index ? { ...x, ...patch } : x)) } };
        }, group),

      /** Insert a step after the selection (opposite foot, next count, in place) and select it. */
      addStep: () =>
        editPattern((p, s) => {
          const sel = s.sel[s.role];
          const at = sel + 1;
          const prev = sel >= 0 ? p.steps[sel] : null;
          const nextStep = p.steps[at];
          const foot: Foot = prev
            ? prev.kind === 'hold'
              ? prev.foot
              : otherFoot(prev.foot)
            : nextStep
              ? otherFoot(nextStep.foot)
              : 'L';
          const before = computeStates({ ...p, steps: p.steps.slice(0, at) });
          const step: Step = {
            id: uid('step'),
            count: nextCount(p.steps.slice(0, at), s.draft.beatsPerBar),
            beats: prev?.beats === 0.5 ? 0.5 : 1,
            foot,
            kind: 'step',
            to: { ...before[before.length - 1].pos[foot] },
          };
          const steps = [...p.steps];
          steps.splice(at, 0, step);
          return { p: { ...p, steps }, sel: at };
        }),

      deleteStep: (index: number) =>
        editPattern((p) => {
          if (!p.steps[index]) return null;
          return { p: { ...p, steps: p.steps.filter((_, k) => k !== index) }, sel: index - 1 };
        }),

      moveStep: (index: number, dir: -1 | 1) =>
        editPattern((p) => {
          const j = index + dir;
          if (!p.steps[index] || j < 0 || j >= p.steps.length) return null;
          const steps = [...p.steps];
          [steps[index], steps[j]] = [steps[j], steps[index]];
          return { p: { ...p, steps }, sel: j };
        }),

      /** Change which foot moves; it starts from where that foot is at that moment. */
      setFoot: (index: number, foot: Foot) =>
        editPattern((p) => {
          const st = p.steps[index];
          if (!st || st.foot === foot) return null;
          const before = computeStates({ ...p, steps: p.steps.slice(0, index) });
          const to: FootPos = { ...before[before.length - 1].pos[foot] };
          return { p: { ...p, steps: p.steps.map((x, k) => (k === index ? { ...x, foot, to } : x)) } };
        }),

      setKind: (index: number, kind: StepKind) =>
        editPattern((p) => {
          const st = p.steps[index];
          if (!st || st.kind === kind) return null;
          let to = st.to;
          if (kind === 'hold') {
            const before = computeStates({ ...p, steps: p.steps.slice(0, index) });
            to = { ...before[before.length - 1].pos[st.foot] };
          }
          return { p: { ...p, steps: p.steps.map((x, k) => (k === index ? { ...x, kind, to } : x)) } };
        }),

      /** Rotate the foot being edited (start: the chosen foot; step: its moving foot). */
      rotate: (delta: number) =>
        editPattern((p, s) => {
          const sel = s.sel[s.role];
          if (sel < 0) {
            const f = s.startFoot;
            return { p: { ...p, start: { ...p.start, [f]: { ...p.start[f], rot: normRot(p.start[f].rot + delta) } } } };
          }
          const st = p.steps[sel];
          if (!st || st.kind === 'hold') return null;
          const to = { ...st.to, rot: normRot(st.to.rot + delta) };
          return { p: { ...p, steps: p.steps.map((x, k) => (k === sel ? { ...x, to } : x)) } };
        }),

      /** Create (or regenerate) the follower part and switch to it. */
      createFollower: (mode: 'mirror' | 'empty') =>
        edit((s) => {
          const mirrored = toPartner(s.draft.roles.leader);
          const follower: Pattern = mode === 'mirror' ? mirrored : { start: mirrored.start, steps: [] };
          return {
            draft: withPattern(s.draft, 'follower', follower),
            role: 'follower',
            sel: { ...s.sel, follower: -1 },
          };
        }),

      removeFollower: () =>
        edit((s) => {
          if (!s.draft.roles.follower) return null;
          return {
            draft: { ...s.draft, roles: { leader: s.draft.roles.leader } },
            role: 'leader',
            sel: { ...s.sel, follower: -1 },
          };
        }),
    }),
    [edit, editPattern],
  );

  const pattern = state.draft.roles[state.role];
  const sel = state.sel[state.role];
  return {
    ...actions,
    draft: state.draft,
    role: state.role,
    pattern,
    /** -1 = start position */
    sel: pattern && sel < pattern.steps.length ? sel : -1,
    startFoot: state.startFoot,
    dragging: state.dragging,
    canUndo: state.past.length > 0,
    /** change counter: compare to know whether anything changed since (e.g. a toast's Undo) */
    rev: state.rev,
    dirty: state.draft !== state.initial,
  };
}

/**
 * A new, unsaved copy of a dance ("Make my own version"): deep copy, fresh ids,
 * " (my version)" name in the app's language, not built in. A starter dance is copied with the
 * texts of the language it is shown in.
 */
export function copyForEditing(d: Dance, t: Strings): Dance {
  const clone = JSON.parse(JSON.stringify(d)) as Dance;
  const freshIds = (p: Pattern): Pattern => ({ ...p, steps: p.steps.map((s) => ({ ...s, id: uid('step') })) });
  const now = Date.now();
  const { builtIn: _builtIn, ...rest } = clone;
  return {
    ...rest,
    id: uid('dance'),
    name: t.common.myVersion(d.name.trim() || t.common.untitled),
    roles: {
      leader: freshIds(clone.roles.leader),
      ...(clone.roles.follower ? { follower: freshIds(clone.roles.follower) } : {}),
    },
    createdAt: now,
    updatedAt: now,
  };
}
