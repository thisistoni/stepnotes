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
  createdAt: number;
  updatedAt: number;
}
