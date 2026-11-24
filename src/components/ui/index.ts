/**
 * Waltzy UI kit ("Playful Pop"). Import everything from '@/components/ui'.
 *
 * Rules: never set fontFamily/fontWeight (use <Text variant>), never hard-code colours (tokens
 * in '@/lib/theme'), build tappable surfaces on PressableLip, ≥44pt targets, haptics via
 * './feedback' (never on web), animations respect reduced motion.
 */

// --- foundations ---
/** Text with variants: display · title · heading · cardTitle · body · bodyStrong · label · small · smallStrong · caption · overline · numeralSm · numeral. `color` takes a token. */
export { Text, resolveColor, type TextProps, type TextVariant } from './Text';
/** Our SVG icon set (`<Icon name="play" size={24} color={colors.ink} />`). */
export { Icon, type IconName, type IconProps } from '../Icon';
/** Haptics helpers (no-ops on web) and `useReducedMotion`. */
export { hapticNotify, hapticPress, hapticSelect, hapticStep, useReducedMotion } from './feedback';
/** Staggered fade-up on first mount (`<Entrance index={i}>`); Screen provides the scope. */
export { Entrance, EntranceScope, type EntranceProps } from './Entrance';

// --- surfaces & buttons ---
/** THE primitive: face on a solid lip; press slides the face down (spring + haptic). `LipSurface` = static version. */
export { CARD_LIP, DISABLED_LIP, LipSurface, PressableLip, type LipColors, type PressableLipProps } from './PressableLip';
/** Lip button: primary / secondary / tinted / danger / ghost, sizes lg 56 / md 48 / sm 40, icons, loading. */
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button';
/** Icon-only lip button (header actions, transport). card / primary / tinted / ghost, square or round. */
export { IconButton, type IconButtonProps } from './IconButton';
/** Floating action button; pass to `<Screen fab={…}>`. */
export { Fab, FAB_HEIGHT, type FabProps } from './Fab';
/** White card with border + lip; pressable when `onPress` is set. */
export { Card, type CardProps } from './Card';
/** Onboarding choice card: icon tile, title, subtitle, radio → popped check. */
export { ChoiceRow, type ChoiceRowProps } from './ChoiceRow';

// --- selection ---
/** Filter chip (colour dot; on = ink) or toggle chip (icon; on = tinted + coloured lip). */
export { Chip, type ChipProps } from './Chip';
/** StyleBadge ("SALSA"), CountBadge ("6"), FootBadge (L/R in the role colour). */
export { CountBadge, FootBadge, StyleBadge } from './Badge';
/** Segmented control with a sliding lip thumb (default) or the compact white pill (stage overlays). */
export { Segmented, type SegmentedOption, type SegmentedProps } from './Segmented';

// --- inputs ---
/** Text input: label, icon, clear button, error / hint, multiline, mono. `SearchField` preset. */
export { SearchField, TextField, type TextFieldProps } from './TextField';
/** − value + with hold-to-repeat. */
export { Stepper, type StepperProps } from './Stepper';
/** Snapping slider (drag / tap, haptic tick per snap, arrow keys on web). Controlled. */
export { Slider, type SliderProps } from './Slider';

// --- progress ---
/** Onboarding pills (SegmentedProgress) and the SVG ring driven by a shared value (ProgressRing). */
export { ProgressRing, SegmentedProgress, type ProgressRingProps, type SegmentedProgressProps } from './Progress';
/** Pulsing placeholder block. */
export { Skeleton, type SkeletonProps } from './Skeleton';

// --- layout ---
/** Screen scaffold: safe areas, 480 column, scroll + keyboard avoidance, pinned `footer`, `fab`. */
export { Screen, type ScreenProps } from './Screen';
/** Header: back/close (falls back to `/`), title + subtitle, right actions; `large` home title. */
export { goBackOrHome, Header, type HeaderProps } from './Header';

// --- overlays & feedback ---
/** Modal bottom sheet (backdrop, spring, drag handle, Escape / back button). */
export { Sheet, type SheetProps } from './Sheet';
/** Action list in a Sheet; actions run after the sheet has closed. */
export { Menu, type MenuItem, type MenuProps } from './Menu';
/** Confirmation dialog (component) + `useConfirm()` promise API (host mounted at the root). */
export { ConfirmDialog, ConfirmHost, useConfirm, type ConfirmDialogProps, type ConfirmOptions } from './ConfirmDialog';
/** `useToast().show({ message, action: { label: 'Undo', onPress } })`; host mounted at the root. */
export { ToastHost, useToast, type ToastOptions } from './Toast';

// --- illustration ---
/** Friendly empty / no-results card: art, title, body, one action. */
export { EmptyState, type EmptyStateProps } from './EmptyState';
/** Footprint sticker avatar + speech bubble. */
export { CoachBubble, type CoachBubbleProps } from './CoachBubble';
/** A single sticker footprint for illustrations. */
export { FootSticker, type FootStickerProps } from './FootSticker';

// --- diagram ---
/** Stage tile (style tint + dot grid) hosting a StepDiagram, with corner overlay slots. */
export { Stage, type StageProps } from '../Stage';
/** Memoised miniature diagram for cards (feet + arrows, no labels). */
export { DiagramThumb, type DiagramThumbProps } from '../DiagramThumb';
