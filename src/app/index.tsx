import { Link, Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { StepDiagram } from '@/components/StepDiagram';
import { Button, SectionTitle } from '@/components/ui';
import { useDances } from '@/lib/store';
import { DEFAULT_FOOT_STYLE, ROLE_THEME, colors } from '@/lib/theme';
import type { Dance } from '@/lib/types';

export default function Library() {
  const { dances, ready } = useDances();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dances;
    return dances.filter((d) => `${d.name} ${d.style}`.toLowerCase().includes(q));
  }, [dances, query]);

  const mine = filtered.filter((d) => !d.builtIn);
  const builtIn = filtered.filter((d) => d.builtIn);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => <Button small variant="ghost" label="Import" onPress={() => router.push('/import')} />,
        }}
      />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.lead}>Learn and write down dance steps as footprint diagrams.</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search dances or styles"
          placeholderTextColor={colors.muted}
          style={s.search}
          clearButtonMode="while-editing"
        />

        <Button label="+  Create a new dance" variant="primary" onPress={() => router.push('/edit/new')} style={{ marginTop: 12 }} />

        <SectionTitle>My dances</SectionTitle>
        {ready && mine.length === 0 && (
          <Text style={s.empty}>
            {query ? 'No matches.' : 'Nothing here yet. Create a dance, or open a starter dance and tap “Make my own version”.'}
          </Text>
        )}
        {mine.map((d) => (
          <DanceRow key={d.id} dance={d} />
        ))}

        <SectionTitle>Starter dances</SectionTitle>
        {builtIn.map((d) => (
          <DanceRow key={d.id} dance={d} />
        ))}
      </ScrollView>
    </>
  );
}

function DanceRow({ dance }: { dance: Dance }) {
  const steps = dance.roles.leader.steps.length;
  return (
    <Link href={`/dance/${dance.id}`} asChild>
      <Pressable style={s.row}>
        <View style={s.thumb} pointerEvents="none">
          <StepDiagram
            pattern={dance.roles.leader}
            theme={ROLE_THEME.leader}
            footStyle={dance.footStyle?.leader ?? DEFAULT_FOOT_STYLE.leader}
            mode="overview"
            showLetters={false}
            maxHeight={96}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>
            {dance.name || 'Untitled dance'}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            {[dance.style, `${steps} steps`, `${dance.bpm} bpm`, dance.roles.follower ? 'lead + follow' : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {!!dance.description && (
            <Text style={s.desc} numberOfLines={2}>
              {dance.description}
            </Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  lead: { fontSize: 15, color: colors.muted, marginBottom: 12 },
  search: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
  },
  empty: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  thumb: { width: 96, height: 96, justifyContent: 'center', backgroundColor: '#FBFAF8', borderRadius: 10, overflow: 'hidden' },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  desc: { fontSize: 13, color: colors.text, marginTop: 4, lineHeight: 18 },
});
