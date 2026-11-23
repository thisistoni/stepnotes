import type { FootStyle, Role } from './types';

export const colors = {
  bg: '#F7F5F2',
  card: '#FFFFFF',
  text: '#1F2328',
  muted: '#6B7280',
  border: '#E5E1DA',
  arrow: '#8E8E8E',
  accent: '#0E9F6E',
  danger: '#D14343',
};

/**
 * Every colour the step diagram draws with. The diagram never hard-codes a colour: pass a full
 * theme (or spread `ROLE_THEME[role]` and override what you need) to restyle it.
 */
export interface RoleTheme {
  /** Foot carrying the weight */
  solid: string;
  /** Free foot */
  light: string;
  /** Step numbers / highlights (chart labels, current-count text) */
  label: string;
  /** Dashed outlines of every position, drawn behind the animated feet */
  ghost: string;
  /** Chart arrows (printed "Chart" view) */
  arrow: string;
  /** The current step's arrow while animating */
  activeArrow: string;
  /** L / R letter on a `solid` foot */
  letterOnSolid: string;
  /** L / R letter on a `light` foot */
  letterOnLight: string;
  /** Editor grid lines */
  grid: string;
  /** Editor grid axis lines (x = 0, y = 0) */
  gridAxis: string;
}

const NEUTRAL = {
  arrow: colors.arrow,
  letterOnSolid: '#FFFFFF',
  grid: '#ECE8E1',
  gridAxis: '#D6D0C6',
};

export const ROLE_THEME: Record<Role, RoleTheme> = {
  leader: {
    ...NEUTRAL,
    solid: '#0E9F6E',
    light: '#7CCBB0',
    label: '#0B7A55',
    ghost: '#7CCBB08C',
    activeArrow: '#0B7A55',
    letterOnLight: '#0A5A40',
  },
  follower: {
    ...NEUTRAL,
    solid: '#EE8A6E',
    light: '#F7C3A4',
    label: '#E2735A',
    ghost: '#F7C3A48C',
    activeArrow: '#E2735A',
    letterOnLight: '#A84B33',
  },
};

export const DEFAULT_FOOT_STYLE: Record<Role, FootStyle> = {
  leader: 'shoe',
  follower: 'heel',
};
