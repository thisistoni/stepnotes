import { memo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui';
import type { Prefs } from '@/lib/prefs';

interface Props {
  loop: boolean;
  speak: boolean;
  mirror: boolean;
  letters: boolean;
  vibrate: boolean;
  setPref: (patch: Partial<Prefs>) => void;
  setMirror: (on: boolean) => void;
}

/** Practice toggles, sized to their labels and wrapping, so no label is ever truncated. */
export const PlayerToggles = memo(function PlayerToggles({ loop, speak, mirror, letters, vibrate, setPref, setMirror }: Props) {
  return (
    <View style={s.row} testID="player-toggles">
      <Chip variant="toggle" icon="loop" label="Loop" selected={loop} onPress={() => setPref({ loop: !loop })} testID="toggle-loop" />
      <Chip
        variant="toggle"
        icon={speak ? 'volume' : 'volume-off'}
        label="Say counts"
        selected={speak}
        onPress={() => setPref({ speakCounts: !speak })}
        testID="toggle-speak"
      />
      <Chip variant="toggle" icon="mirror" label="Mirror" selected={mirror} onPress={() => setMirror(!mirror)} testID="toggle-mirror" />
      <Chip
        variant="toggle"
        icon="letters"
        label="L / R letters"
        accessibilityLabel="Show L and R letters on the feet"
        selected={letters}
        onPress={() => setPref({ showLetters: !letters })}
        testID="toggle-letters"
      />
      {Platform.OS !== 'web' && (
        <Chip variant="toggle" icon="vibrate" label="Vibrate" selected={vibrate} onPress={() => setPref({ haptics: !vibrate })} testID="toggle-vibrate" />
      )}
    </View>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
