import { useRef, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Card, Chip, Icon, IconButton, Segmented, Stepper, Text, TextField, type SegmentedOption, type TextFieldProps } from '@/components/ui';
import { colors, DEFAULT_FOOT_STYLE, radius, ROLE_COLOR, space, STYLE_COLORS, styleColor } from '@/lib/theme';
import { ROLE_LABEL, type Dance, type FootStyle, type Role } from '@/lib/types';

import { useReveal } from './reveal';

export const BPM_RANGE = [20, 300] as const;
const KNOWN_STYLES = Object.keys(STYLE_COLORS).map((k) => k.charAt(0).toUpperCase() + k.slice(1));
const BAR_OPTIONS = [3, 4, 6];

export interface DetailsCardProps {
  draft: Dance;
  expanded: boolean;
  onToggle: () => void;
  /** `group` coalesces typing into one undo entry */
  onChange: (patch: Partial<Dance>, group?: string) => void;
  /** a text field lost focus (ends the typing undo group) */
  onSeal: () => void;
  videoError: string | null;
  onVideoBlur: () => void;
}

/** "Salsa · 4/4 · 120 bpm" */
export function detailsSummary(d: Dance) {
  return [d.style.trim(), `${d.beatsPerBar}/4`, `${d.bpm} bpm`].filter(Boolean).join(' · ');
}

/**
 * Name, style, tempo, bar length, footprint style per role, description and video link.
 * Collapsed it is a one-line summary card that opens on tap.
 */
export function DetailsCard({ draft, expanded, onToggle, onChange, onSeal, videoError, onVideoBlur }: DetailsCardProps) {
  const tone = styleColor(draft.style);
  const name = draft.name.trim() || 'Untitled dance';

  if (!expanded) {
    return (
      <Card
        onPress={onToggle}
        padding={12}
        accessibilityLabel={`Details: ${name}, ${detailsSummary(draft)}`}
        accessibilityHint="Opens the dance details"
        testID="details-collapsed"
        contentStyle={s.collapsed}
      >
        <View style={[s.swatch, { backgroundColor: tone.tint }]}>
          <Icon name="footprints" size={22} color={tone.base} />
        </View>
        <View style={s.summaryText}>
          <Text variant="label" numberOfLines={2}>
            {name}
          </Text>
          <Text variant="caption" color="ink2" numberOfLines={2} style={s.summaryMeta}>
            {detailsSummary(draft)}
          </Text>
        </View>
        <View style={s.editPill}>
          <Icon name="pencil" size={17} color={colors.ink2} strokeWidth={2.4} />
        </View>
      </Card>
    );
  }

  const barOptions = BAR_OPTIONS.includes(draft.beatsPerBar) ? BAR_OPTIONS : [...BAR_OPTIONS, draft.beatsPerBar].sort((a, b) => a - b);
  const footOptions = (role: Role): SegmentedOption<FootStyle>[] => [
    { value: 'shoe', label: 'Flat', icon: 'flat-shoe', accessibilityLabel: `${ROLE_LABEL[role]}: flat shoe footprints` },
    { value: 'heel', label: 'Heel', icon: 'heel', accessibilityLabel: `${ROLE_LABEL[role]}: heel footprints` },
  ];

  return (
    <Card padding={16} contentStyle={s.form}>
      <View style={s.headRow}>
        <Text variant="cardTitle" accessibilityRole="header" style={s.flex}>
          Details
        </Text>
        <IconButton icon="chevron-up" label="Collapse details" variant="ghost" size={40} iconSize={20} onPress={onToggle} testID="details-collapse" />
      </View>

      <Field
        label="Name"
        value={draft.name}
        onChangeText={(v) => onChange({ name: v }, 'name')}
        onBlur={onSeal}
        placeholder="Untitled dance"
        maxLength={120}
        returnKeyType="done"
        testID="field-name"
      />

      <View>
        <Field
          label="Style"
          value={draft.style}
          onChangeText={(v) => onChange({ style: v }, 'style')}
          onBlur={onSeal}
          placeholder="Salsa, Tango, Line dance…"
          maxLength={60}
          returnKeyType="done"
          testID="field-style"
        />
        <View style={s.chips}>
          {KNOWN_STYLES.map((st) => (
            <Chip
              key={st}
              label={st}
              dot={styleColor(st).base}
              selected={draft.style.trim().toLowerCase() === st.toLowerCase()}
              onPress={() => onChange({ style: st })}
              testID={`style-${st.toLowerCase()}`}
            />
          ))}
        </View>
      </View>

      <View style={s.tempoRow}>
        <View>
          <Label>Tempo</Label>
          <Stepper
            label="Tempo"
            unit="bpm"
            value={draft.bpm}
            min={BPM_RANGE[0]}
            max={BPM_RANGE[1]}
            onChange={(bpm) => onChange({ bpm }, 'bpm')}
          />
        </View>
        <View style={s.barCol}>
          <Label>Beats per bar</Label>
          <Segmented
            label="Beats per bar"
            options={barOptions.map((n) => ({ value: String(n), label: String(n) }))}
            value={String(draft.beatsPerBar)}
            onChange={(v) => onChange({ beatsPerBar: Number(v) })}
            color={{ ...ROLE_COLOR.leader, base: colors.ink, lip: colors.inkLip, on: colors.onColor }}
            testID="beats-per-bar"
          />
        </View>
      </View>

      <View>
        <Label>Footprints</Label>
        <View style={s.footRows}>
          {(['leader', 'follower'] as Role[]).map((role) => (
            <View key={role} style={s.footRow}>
              <View style={[s.roleDot, { backgroundColor: ROLE_COLOR[role].base }]} />
              <Text variant="smallStrong" style={s.roleName}>
                {ROLE_LABEL[role]}
              </Text>
              <Segmented
                label={`${ROLE_LABEL[role]} footprints`}
                options={footOptions(role)}
                value={draft.footStyle?.[role] ?? DEFAULT_FOOT_STYLE[role]}
                onChange={(v) => onChange({ footStyle: { ...draft.footStyle, [role]: v } })}
                color={ROLE_COLOR[role]}
                style={s.flex}
              />
            </View>
          ))}
        </View>
      </View>

      <Field
        label="Description"
        value={draft.description}
        onChangeText={(v) => onChange({ description: v }, 'description')}
        onBlur={onSeal}
        placeholder="Technique tips, styling, what to feel…"
        multiline
        minHeight={96}
        maxLength={4000}
        testID="field-description"
      />

      <Field
        label="Video link"
        icon="video"
        value={draft.videoUrl ?? ''}
        onChangeText={(v) => onChange({ videoUrl: v || undefined }, 'video')}
        onBlur={() => {
          onSeal();
          onVideoBlur();
        }}
        placeholder="https://…"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        error={videoError}
        hint={videoError ? undefined : 'Optional: a reference video to learn from'}
        testID="field-video"
      />
    </Card>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text variant="smallStrong" color="ink2" style={s.label}>
      {children}
    </Text>
  );
}

/** TextField that scrolls itself above the keyboard on focus. */
export function Field(props: TextFieldProps) {
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const reveal = useReveal();
  return (
    <TextField
      {...props}
      ref={ref}
      onFocus={(e) => {
        reveal(ref.current);
        props.onFocus?.(e);
      }}
    />
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  collapsed: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  swatch: { width: 44, height: 44, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center' },
  summaryText: { flex: 1, minWidth: 0 },
  summaryMeta: { marginTop: 2 },
  editPill: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.track,
  },
  form: { gap: space.l },
  headRow: { flexDirection: 'row', alignItems: 'center', marginTop: -space.xs, marginBottom: -space.s, marginRight: -space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.m },
  label: { marginBottom: 6, marginLeft: 4 },
  tempoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.l, alignItems: 'flex-start' },
  barCol: { flex: 1, minWidth: 128 },
  footRows: { gap: space.s },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  roleDot: { width: 10, height: 10, borderRadius: 4 },
  roleName: { width: 72 },
});
