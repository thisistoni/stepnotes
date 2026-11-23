/**
 * First-run intro: Welcome → Role → "How to read the footprints" (three short steps, skippable).
 * `/intro?lesson=1` shows only the lesson, with a close button, and leaves prefs alone.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { BackHandler, ScrollView, StyleSheet } from 'react-native';

import { IntroTopBar } from '@/components/intro/IntroTopBar';
import { LessonStep } from '@/components/intro/LessonStep';
import { RoleStep, type RoleChoice } from '@/components/intro/RoleStep';
import { StepTransition } from '@/components/intro/StepTransition';
import { WelcomeStep } from '@/components/intro/WelcomeStep';
import { Button, goBackOrHome, Header, Screen } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { usePrefs } from '@/lib/prefs';
import { space } from '@/lib/theme';
import type { Role } from '@/lib/types';

const STEPS = 3;

export default function Intro() {
  const { lesson } = useLocalSearchParams<{ lesson?: string }>();
  return lesson === '1' ? <LessonOnly /> : <IntroFlow />;
}

/** The lesson on its own (from the Library's "How to read the footprints" card). */
function LessonOnly() {
  const { prefs } = usePrefs();
  const t = useT();
  return (
    <Screen
      header={<Header leading="close" onBack={goBackOrHome} />}
      footer={<Button label={t.intro.gotIt} onPress={goBackOrHome} testID="intro-primary" />}
      contentStyle={[s.grow, s.tight]}
      testID="intro-screen"
    >
      <LessonStep role={prefs.preferredRole} />
    </Screen>
  );
}

function IntroFlow() {
  const { prefs, set } = usePrefs();
  const t = useT();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);
  const [choice, setChoice] = useState<RoleChoice | null>(null);
  const finishing = useRef(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= STEPS || next === step) return;
      setDirection(next > step ? 1 : -1);
      setStep(next);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    },
    [step],
  );

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      await set({ onboardingDone: true });
    } catch {
      // prefs keep the change in memory even if it could not be written: carry on
    } finally {
      finishing.current = false;
      router.replace('/');
    }
  }, [set]);

  const choose = (c: RoleChoice) => {
    setChoice(c);
    // "Both / not sure" starts on the leader's part
    void set({ preferredRole: c === 'follower' ? 'follower' : 'leader' });
    // on short phones the coach's answer sits below the fold: bring it into view
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  // Android back button steps back through the intro instead of leaving the app.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (step === 0) return false;
        go(step - 1);
        return true;
      });
      return () => sub.remove();
    }, [step, go]),
  );

  const role: Role = choice ? (choice === 'follower' ? 'follower' : 'leader') : prefs.preferredRole;

  const footer =
    step === 0 ? (
      <Button label={t.intro.getStarted} onPress={() => go(1)} testID="intro-primary" />
    ) : step === 1 ? (
      <Button label={t.intro.continue} disabled={!choice} onPress={() => go(2)} testID="intro-primary" />
    ) : (
      <Button label={t.intro.startDancing} onPress={finish} testID="intro-primary" />
    );

  return (
    <Screen
      header={<IntroTopBar step={step} total={STEPS} onBack={() => go(step - 1)} onSkip={finish} />}
      footer={footer}
      contentStyle={[s.grow, s.tight]}
      scrollRef={scrollRef}
      testID="intro-screen"
    >
      <StepTransition key={step} direction={direction}>
        {step === 0 ? (
          <WelcomeStep animate={direction === 0} />
        ) : step === 1 ? (
          <RoleStep value={choice} onChange={choose} />
        ) : (
          <LessonStep role={role} />
        )}
      </StepTransition>
    </Screen>
  );
}

const s = StyleSheet.create({
  grow: { flexGrow: 1 },
  /** Content may run right up to the pinned button (the lesson stage absorbs the slack). */
  tight: { paddingBottom: space.s },
});
