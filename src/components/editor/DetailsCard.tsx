import { useRef, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Card, Chip, Icon, IconButton, Segmented, Stepper, Text, TextField, type SegmentedOption, type TextFieldProps } from '@/components/ui';
import { useT, type Strings } from '@/lib/i18n';
import { colors, DEFAULT_FOOT_STYLE, radius, ROLE_COLOR, space, styleColor } from '@/lib/theme';
import type { Dance, FootStyle, Role } from '@/lib/types';

import { useReveal } from './reveal';

export const BPM_RANGE = [20, 300] as const;
const BAR_OPTIONS = [3, 4, 6];

export interface DetailsCardProps {
  draft: Dance;
  expanded: boolean;
  onToggle: () => void;
  /** `group` coalesces typing into one undo entry */
  onChange: (patch: Partial<Dance>, group?: string) => void;
  /** a text field lost focus (ends the typing undo group) */
  onSeal: () => void;
  /** the video link is not a web address */
  videoError: boolean;
  onVideoBlur: () => void;
}

/** "Salsa · 4/4 · 120 bpm" */
export function detailsSummary(d: Dance, t: Strings) {
  return [d.style.trim(), t.units.meter(d.beatsPerBar), t.units.bpm(d.bpm)].filter(Boolean).join(' · ');
}

/**
 * Name, style, tempo, bar length, footprint style per role, description and video link.
 * Collapsed it is a one-line summary card that opens on tap.
 */
export function DetailsCard({ draft, expanded, onToggle, onChange, onSeal, videoError, onVideoBlur }: DetailsCardProps) {
  const t = useT();
  const tone = styleColor(draft.style);
  const name = draft.name.trim() || t.common.untitled;

  if (!expanded) {
    return (
      <Card
        onPress={onToggle}
        padding={12}
        accessibilityLabel={t.details.summaryA11y(name, detailsSummary(draft, t))}
        accessibilityHint={t.details.openHint}
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
            {detailsSummary(draft, t)}
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
    { value: 'shoe', label: t.details.flat, icon: 'flat-shoe', accessibilityLabel: t.details.flatA11y(t.roles[role]) },
    { value: 'heel', label: t.details.heel, icon: 'heel', accessibilityLabel: t.details.heelA11y(t.roles[role]) },
  ];

  return (
    <Card padding={16} contentStyle={s.form}>
      <View style={s.headRow}>
        <Text variant="cardTitle" accessibilityRole="header" style={s.flex}>
          {t.details.title}
        </Text>
        <IconButton icon="chevron-up" label={t.details.collapse} variant="ghost" size={40} iconSize={20} onPress={onToggle} testID="details-collapse" />
      </View>

      <Field
        label={t.details.name}
        value={draft.name}
        onChangeText={(v) => onChange({ name: v }, 'name')}
        onBlur={onSeal}
        placeholder={t.common.untitled}
        maxLength={120}
        returnKeyType="done"
        testID="field-name"
      />

      <View>
        <Field
          label={t.details.style}
          value={draft.style}
          onChangeText={(v) => onChange({ style: v }, 'style')}
          onBlur={onSeal}
          placeholder={t.details.stylePlaceholder}
          maxLength={60}
          returnKeyType="done"
          testID="field-style"
        />
        <View style={s.chips} accessibilityRole="radiogroup" accessibilityLabel={t.details.commonStyles}>
          {t.styles.map((st) => (
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
          <Label>{t.details.tempo}</Label>
          <Stepper
            label={t.details.tempo}
            unit={t.units.bpmUnit}
            value={draft.bpm}
            min={BPM_RANGE[0]}
            max={BPM_RANGE[1]}
            onChange={(bpm) => onChange({ bpm }, 'bpm')}
          />
        </View>
        <View style={s.barCol}>
          <Label>{t.details.beatsPerBar}</Label>
          <Segmented
            label={t.details.beatsPerBar}
            options={barOptions.map((n) => ({ value: String(n), label: String(n) }))}
            value={String(draft.beatsPerBar)}
            onChange={(v) => onChange({ beatsPerBar: Number(v) })}
            color={{ ...ROLE_COLOR.leader, base: colors.ink, lip: colors.inkLip, on: colors.onColor }}
            testID="beats-per-bar"
          />
        </View>
      </View>

      <View>
        <Label>{t.details.footprints}</Label>
        <View style={s.footRows}>
          {(['leader', 'follower'] as Role[]).map((role) => (
            <View key={role} style={s.footRow}>
              <View style={[s.roleDot, { backgroundColor: ROLE_COLOR[role].base }]} />
              <Text variant="smallStrong" style={s.roleName}>
                {t.roles[role]}
              </Text>
              <Segmented
                label={t.details.footprintsOf(t.roles[role])}
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
        label={t.details.description}
        value={draft.description}
        onChangeText={(v) => onChange({ description: v }, 'description')}
        onBlur={onSeal}
        placeholder={t.details.descriptionPlaceholder}
        multiline
        minHeight={96}
        maxLength={4000}
        testID="field-description"
      />

      <Field
        label={t.details.video}
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
        error={videoError ? t.editor.badVideo : undefined}
        hint={videoError ? undefined : t.details.videoHint}
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
