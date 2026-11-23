/**
 * Playful Pop design tokens — the ONLY file in `src/` that may contain colour literals.
 *
 *   colors.ink, colors.primary, colors.cardLip …   semantic colours (light theme only)
 *   styleColor('Salsa')                          → { base, lip, tint, on, deep } for a dance style
 *   ROLE_COLOR.leader / .follower                → the role colour sets (green / pink)
 *   roleTheme('follower')                        → full RoleTheme for <StepDiagram>
 *   radius / space / lip / typography / motion        → shape, rhythm and animation constants
 *   withAlpha(colors.ink, 0.3)                   → rgba() string from a token
 */
import type { FootStyle, Role } from './types';

// --- raw palette (port of the mock's CSS variables) -------------------------------------------

const P = {
  cream: '#FFF8F0',
  white: '#FFFFFF',
  ink: '#2A2140',
  inkLip: '#120C1F',
  ink2: '#6B6280',
  ink3: '#A59DB4',
  line: '#F0E4D5',
  lineLip: '#E6D6C2',
  well: '#F4EADD',
  wellDeep: '#F0E5D7',
  radio: '#E2D5C5',
  handle: '#E8DED2',

  green: '#21C17C',
  greenLip: '#169A60',
  greenTint: '#DDF7EA',
  greenLight: '#A3E8C6',
  greenLightLip: '#7DD3AA',
  greenBorder: '#B9EDD3',
  greenInk: '#127A4C',
  greenDeep: '#0F6B42',
  greenWash: '#F2FCF7',
  greenRing: '#E9F8F0',

  pink: '#FF5E8A',
  pinkLip: '#D93F6B',
  pinkTint: '#FFE3EC',
  pinkLight: '#FFB3C8',
  pinkLightLip: '#F590AE',
  pinkBorder: '#FFC9D8',
  pinkInk: '#B8325A',
  pinkDeep: '#9E2148',
  pinkWash: '#FFF4F7',

  red: '#F0453A',
  redLip: '#C9302A',
  redTint: '#FFE5E2',
  redInk: '#B3261E',

  salsa: '#FF6B4D',
  salsaLip: '#DB4E31',
  salsaTint: '#FFE7DF',
  salsaDeep: '#B23A20',
  bachata: '#8E6CF5',
  bachataLip: '#6C4BD6',
  bachataTint: '#EEE8FF',
  bachataDeep: '#5236B0',
  ballroom: '#3AA6F2',
  ballroomLip: '#1F86CF',
  ballroomTint: '#E1F1FD',
  ballroomDeep: '#146AA8',
  latin: '#FFC22E',
  latinLip: '#E3A10C',
  latinTint: '#FFF2CC',
  latinDeep: '#946500',

  teal: '#14B8A6',
  tealLip: '#0E8F82',
  tealTint: '#D7F6F1',
  tealDeep: '#0B6E64',
  indigo: '#5B6CF0',
  indigoLip: '#3F4FD1',
  indigoTint: '#E4E8FF',
  indigoDeep: '#3240A8',
  rose: '#E8559E',
  roseLip: '#C23A80',
  roseTint: '#FCE4F1',
  roseDeep: '#9C2A66',
  lime: '#7CC63A',
  limeLip: '#5EA21F',
  limeTint: '#EAF7DB',
  limeDeep: '#3F7512',
  amber: '#FF9F1C',
  amberLip: '#DB7F00',
  amberTint: '#FFEDD3',
  amberDeep: '#9A5800',

  neutral: '#A59DB4',
  neutralLip: '#857C97',
  neutralTint: '#F4EADD',
} as const;

/** `withAlpha('#2A2140', 0.3)` → `rgba(42,33,64,0.3)`. Use with tokens only. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// --- semantic colours ------------------------------------------------------------------------

export const colors = {
  /** Page background (warm cream) */
  bg: P.cream,
  /** Card / sheet / input face */
  card: P.white,
  /** Card border (2px) */
  cardBorder: P.line,
  /** Solid lip under white cards, inputs, secondary buttons */
  cardLip: P.lineLip,
  /** Muted wells: segmented track, count chips, disabled faces */
  track: P.well,
  /** Slightly deeper well: progress pills, slider track */
  trackDeep: P.wellDeep,
  /** Unselected radio ring */
  radio: P.radio,
  /** Sheet drag handle */
  handle: P.handle,

  /** Primary text */
  ink: P.ink,
  /** Secondary text */
  ink2: P.ink2,
  /** Tertiary text / placeholders (not for essential text: low contrast) */
  ink3: P.ink3,
  /** Lip under ink-coloured surfaces (selected filter chip) */
  inkLip: P.inkLip,
  /** Text / icons on vivid fills */
  onColor: P.white,

  /** Primary (= leader green) */
  primary: P.green,
  primaryLip: P.greenLip,
  primaryTint: P.greenTint,
  /** Light green: leader free foot, lip of tinted toggles */
  primaryLight: P.greenLight,
  /** Border of tinted (on) toggles */
  primaryBorder: P.greenBorder,
  /** Readable green text on tint / cream */
  primaryInk: P.greenInk,
  /** Selected choice-row face */
  primaryWash: P.greenWash,
  /** Progress-ring track around the play button */
  primaryRing: P.greenRing,

  follower: P.pink,
  followerLip: P.pinkLip,
  followerTint: P.pinkTint,
  followerLight: P.pinkLight,
  followerBorder: P.pinkBorder,
  followerInk: P.pinkInk,
  followerWash: P.pinkWash,

  danger: P.red,
  dangerLip: P.redLip,
  dangerTint: P.redTint,
  dangerInk: P.redInk,

  /** Modal backdrop */
  scrim: withAlpha(P.ink, 0.42),
  /** Colour of soft floating shadows (FAB, sheet, toast) */
  shadow: P.ink,
  /** Toast background */
  toast: P.ink,

  /** @deprecated legacy alias (old screens) → use `ink` */
  text: P.ink,
  /** @deprecated legacy alias → use `ink2` */
  muted: P.ink2,
  /** @deprecated legacy alias → use `cardBorder` */
  border: P.line,
  /** @deprecated legacy alias → use `primary` */
  accent: P.green,
  /** @deprecated legacy alias */
  arrow: P.ink2,
} as const;

export type ColorToken = keyof typeof colors;

/**
 * A colour family: `base` (vivid face), `lip` (darker bottom edge), `tint` (pale background),
 * `on` (readable text/icon on `base`), `deep` (readable text on `tint`).
 */
export interface ColorSet {
  base: string;
  lip: string;
  tint: string;
  on: string;
  deep: string;
}

export const ROLE_COLOR: Record<Role, ColorSet & { light: string; border: string; wash: string }> = {
  leader: {
    base: P.green,
    lip: P.greenLip,
    tint: P.greenTint,
    on: P.white,
    deep: P.greenInk,
    light: P.greenLight,
    border: P.greenBorder,
    wash: P.greenWash,
  },
  follower: {
    base: P.pink,
    lip: P.pinkLip,
    tint: P.pinkTint,
    on: P.white,
    deep: P.pinkInk,
    light: P.pinkLight,
    border: P.pinkBorder,
    wash: P.pinkWash,
  },
};

/** Colour sets for generic tones (buttons, chips, icon tiles). */
export const TONE: Record<'primary' | 'follower' | 'danger' | 'ink' | 'neutral', ColorSet> = {
  primary: ROLE_COLOR.leader,
  follower: ROLE_COLOR.follower,
  danger: { base: P.red, lip: P.redLip, tint: P.redTint, on: P.white, deep: P.redInk },
  ink: { base: P.ink, lip: P.inkLip, tint: P.well, on: P.white, deep: P.ink },
  neutral: { base: P.neutral, lip: P.neutralLip, tint: P.neutralTint, on: P.white, deep: P.ink2 },
};

// --- dance-style colours -----------------------------------------------------------------------

const set = (base: string, lip: string, tint: string, deep: string, on: string = P.white): ColorSet => ({
  base,
  lip,
  tint,
  on,
  deep,
});

/** Styles from the spec, by lower-case name. */
export const STYLE_COLORS: Record<string, ColorSet> = {
  salsa: set(P.salsa, P.salsaLip, P.salsaTint, P.salsaDeep),
  bachata: set(P.bachata, P.bachataLip, P.bachataTint, P.bachataDeep),
  ballroom: set(P.ballroom, P.ballroomLip, P.ballroomTint, P.ballroomDeep),
  // yellow is too light for white text: ink on it
  latin: set(P.latin, P.latinLip, P.latinTint, P.latinDeep, P.ink),
};

/** Other names for the same styles (German labels of the starter dances), by lower-case name. */
const STYLE_ALIASES: Record<string, keyof typeof STYLE_COLORS> = {
  standard: 'ballroom',
  latein: 'latin',
};

/** Fallback colours for any other style name (picked by a stable hash of the name). */
export const EXTRA_STYLE_COLORS: ColorSet[] = [
  set(P.teal, P.tealLip, P.tealTint, P.tealDeep),
  set(P.indigo, P.indigoLip, P.indigoTint, P.indigoDeep),
  set(P.rose, P.roseLip, P.roseTint, P.roseDeep),
  set(P.lime, P.limeLip, P.limeTint, P.limeDeep, P.ink),
  set(P.amber, P.amberLip, P.amberTint, P.amberDeep, P.ink),
];

/** Colour of a dance with no style. */
export const NEUTRAL_STYLE: ColorSet = TONE.neutral;

/**
 * Colour set for a dance style: case-insensitive, known styles first (also by their German names:
 * "Standard" is the ballroom colour, "Latein" the latin one), any other name gets a
 * deterministic colour from `EXTRA_STYLE_COLORS`, an empty name gets `NEUTRAL_STYLE`.
 */
export function styleColor(styleName: string | undefined | null): ColorSet {
  const key = (styleName ?? '').trim().toLowerCase();
  if (!key) return NEUTRAL_STYLE;
  const known = STYLE_COLORS[STYLE_ALIASES[key] ?? key];
  if (known) return known;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return EXTRA_STYLE_COLORS[h % EXTRA_STYLE_COLORS.length];
}

// --- diagram themes ----------------------------------------------------------------------------

/**
 * Every colour the step diagram draws with. The diagram never hard-codes a colour: pass a full
 * theme (`roleTheme(role)`) or spread one and override what you need.
 */
export interface RoleTheme {
  /** Foot carrying the weight */
  solid: string;
  /** Sticker lip under a solid foot */
  solidLip: string;
  /** Free foot */
  light: string;
  /** Sticker lip under a free foot */
  lightLip: string;
  /** Sticker outline around feet */
  outline: string;
  /** Step numbers / highlights (chart labels) */
  label: string;
  /** Dashed outlines of positions */
  ghost: string;
  /** Faint fill inside ghost outlines */
  ghostFill: string;
  /** Chart arrows (printed "Chart" view) */
  arrow: string;
  /** The current step's arrow while animating */
  activeArrow: string;
  /** Round count badge on the live arrow */
  badge: string;
  /** Number inside the badge */
  badgeText: string;
  /** L / R letter on a `solid` foot */
  letterOnSolid: string;
  /** L / R letter on a `light` foot */
  letterOnLight: string;
  /** Editor grid lines */
  grid: string;
  /** Editor grid axis lines (x = 0, y = 0) */
  gridAxis: string;
  /** Live view: every other position of the pattern, barely visible (context only). Default `ghost`. */
  ghostRest?: string;
  /** Live view: where the moving foot came from (very faint). Default `ghost`. */
  ghostOrigin?: string;
  /** Live view: the next step's destination outline (faint, role tinted). Default `label`. */
  ghostNext?: string;
}

const DIAGRAM_NEUTRAL = {
  outline: P.white,
  ghost: withAlpha(P.ink, 0.3),
  ghostFill: withAlpha(P.white, 0.4),
  arrow: withAlpha(P.ink, 0.45),
  badgeText: P.white,
  letterOnSolid: P.white,
  grid: withAlpha(P.ink, 0.08),
  gridAxis: withAlpha(P.ink, 0.18),
  ghostRest: withAlpha(P.ink, 0.16),
  ghostOrigin: withAlpha(P.ink, 0.3),
};

export const ROLE_THEME: Record<Role, RoleTheme> = {
  leader: {
    ...DIAGRAM_NEUTRAL,
    solid: P.green,
    solidLip: P.greenLip,
    light: P.greenLight,
    lightLip: P.greenLightLip,
    label: P.greenLip,
    activeArrow: P.greenLip,
    badge: P.green,
    letterOnLight: P.greenDeep,
    ghostNext: withAlpha(P.greenLip, 0.55),
  },
  follower: {
    ...DIAGRAM_NEUTRAL,
    solid: P.pink,
    solidLip: P.pinkLip,
    light: P.pinkLight,
    lightLip: P.pinkLightLip,
    label: P.pinkLip,
    activeArrow: P.pinkLip,
    badge: P.pink,
    letterOnLight: P.pinkDeep,
    ghostNext: withAlpha(P.pinkLip, 0.55),
  },
};

/** Diagram theme for a role (leader green, follower pink). */
export function roleTheme(role: Role): RoleTheme {
  return ROLE_THEME[role];
}

export const DEFAULT_FOOT_STYLE: Record<Role, FootStyle> = {
  leader: 'shoe',
  follower: 'heel',
};

// --- shape, rhythm, type, motion -------------------------------------------------------------

/** Corner radii. */
export const radius = {
  /** Stage tiles, hero areas, sheets */
  xl: 28,
  /** Cards */
  card: 24,
  /** Large buttons, inputs, segmented track */
  lg: 20,
  md: 18,
  /** Chips, icon buttons */
  sm: 16,
  chip: 14,
  /** Badges */
  xs: 10,
  pill: 999,
} as const;

/** Spacing scale (vertical rhythm 8 / 12 / 16 / 24 / 32). */
export const space = {
  xxs: 4,
  xs: 6,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  /** Screen side gutter */
  gutter: 24,
} as const;

/** Lip depths (the solid darker bottom edge). */
export const lip = {
  /** Primary buttons, cards, FAB */
  lg: 5,
  /** Chips, inputs, icon buttons */
  md: 4,
  /** Small toggles, segmented thumb */
  sm: 3,
} as const;

/** Loaded font families (one per weight — never use fontWeight with these). */
export const fonts = {
  display500: 'Fredoka_500Medium',
  display600: 'Fredoka_600SemiBold',
  display700: 'Fredoka_700Bold',
  body600: 'Nunito_600SemiBold',
  body700: 'Nunito_700Bold',
  body800: 'Nunito_800ExtraBold',
  body900: 'Nunito_900Black',
} as const;

/** Type scale, used by `<Text variant>`. */
export const typography = {
  display: { fontFamily: fonts.display600, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: fonts.display600, fontSize: 26, lineHeight: 31, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.display600, fontSize: 20, lineHeight: 25, letterSpacing: -0.1 },
  cardTitle: { fontFamily: fonts.display600, fontSize: 18, lineHeight: 22 },
  body: { fontFamily: fonts.body600, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.body800, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fonts.body900, fontSize: 15, lineHeight: 19 },
  small: { fontFamily: fonts.body700, fontSize: 14, lineHeight: 19 },
  smallStrong: { fontFamily: fonts.body800, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fonts.body700, fontSize: 12.5, lineHeight: 16 },
  overline: { fontFamily: fonts.body900, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
  button: { fontFamily: fonts.display600, fontSize: 18, lineHeight: 22, letterSpacing: 0.2 },
  numeralSm: { fontFamily: fonts.display600, fontSize: 15, lineHeight: 18 },
  numeral: { fontFamily: fonts.display700, fontSize: 56, lineHeight: 62 },
} as const;

export type TypeVariant = keyof typeof typography;

/** Motion constants (Reanimated). */
export const motion = {
  /** Lip press: face goes down fast… */
  pressIn: { duration: 90, dampingRatio: 1 },
  /** …and springs back slightly bouncy */
  pressOut: { duration: 260, dampingRatio: 0.55 },
  /** Segmented thumb, toggles */
  slide: { duration: 320, dampingRatio: 0.78 },
  /** Pop-ins (checks, chips) */
  pop: { duration: 300, dampingRatio: 0.5 },
  /** Sheets / toasts entering */
  sheet: { duration: 380, dampingRatio: 0.86 },
  /** Progress fills with an overshoot */
  fill: { duration: 520, dampingRatio: 0.62 },
  /** Fades and exits */
  fast: 160,
  base: 240,
  /** Staggered entrance */
  enterDuration: 260,
  enterStagger: 40,
  enterOffset: 12,
  /** Items mounting later than this after their screen do not play the entrance */
  enterWindow: 700,
} as const;

/** Layout constants. */
export const layout = {
  /** Content column max width on wide screens */
  maxWidth: 480,
  /** Minimum tap target */
  minTap: 44,
} as const;
