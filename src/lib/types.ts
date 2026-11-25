/**
 * Coordinate system
 * -----------------
 * Units are roughly "one foot width". A foot is ~1 unit wide and ~2.6 units long.
 * The dancer faces UP the screen: negative y = forward, positive y = backward,
 * negative x = dancer's left, positive x = dancer's right.
 * `rot` is the foot's rotation in degrees (0 = toes pointing forward / up, positive = clockwise).
 */
export type Foot = 'L' | 'R';

export interface FootPos {
  x: number;
  y: number;
  rot: number;
}

/**
 * step  – foot moves (or stays) and takes the weight
 * tap   – foot touches the floor without taking weight
 * hold  – nobody moves, a pause on this count
 */
export type StepKind = 'step' | 'tap' | 'hold';

export interface Step {
  id: string;
  /** What the dancer says on this step: "1", "2", "&", "a", "slow"… */
  count: string;
  /** Duration in beats until the next step (1 = one beat, 0.5 = an "&"). */
  beats: number;
  foot: Foot;
  kind: StepKind;
  /** Where the moving foot ends up. Ignored for `hold`. */
  to: FootPos;
  /**
   * Optional: degrees the OTHER foot (the one carrying the weight) swivels on the spot while this
   * step is taken (positive = clockwise), e.g. the pivot of a spin or a New Yorker. It can exceed
   * 180°, and its sign also says which way a half turn (exactly 180°) of the moving foot goes.
   * Ignored for `hold`. Missing = no swivel.
   */
  pivot?: number;
  note?: string;
}

export interface Pattern {
  start: Record<Foot, FootPos>;
  steps: Step[];
}

export type Role = 'leader' | 'follower';
export type FootStyle = 'shoe' | 'heel';

export interface Dance {
  id: string;
  name: string;
  style: string;
  description: string;
  bpm: number;
  beatsPerBar: number;
  roles: {
    leader: Pattern;
    follower?: Pattern;
  };
  footStyle?: Partial<Record<Role, FootStyle>>;
  /** Optional link to a reference video (YouTube, Instagram…) */
  videoUrl?: string;
  builtIn?: boolean;
  /** Set on a dance that was saved from someone else's link or class (credit). Not part of a JSON export. */
  source?: DanceSource;
  createdAt: number;
  updatedAt: number;
}

/** Where a saved dance came from: a shared link (`ref` = share id) or a class (`ref` = class code). */
export interface DanceSource {
  kind: 'share' | 'class';
  ref: string;
  /** the author's display name at the time it was saved */
  author: string;
  authorId: string;
}
