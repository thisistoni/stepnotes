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

export interface RoleTheme {
  /** Foot carrying the weight */
  solid: string;
  /** Free foot */
  light: string;
  /** Numbers / highlights */
  label: string;
}

export const ROLE_THEME: Record<Role, RoleTheme> = {
  leader: { solid: '#0E9F6E', light: '#7CCBB0', label: '#0B7A55' },
  follower: { solid: '#EE8A6E', light: '#F7C3A4', label: '#E2735A' },
};

export const DEFAULT_FOOT_STYLE: Record<Role, FootStyle> = {
  leader: 'shoe',
  follower: 'heel',
};
