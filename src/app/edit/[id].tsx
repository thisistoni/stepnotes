/**
 * Editor. Routes:
 *   /edit/new              blank dance
 *   /edit/new?from=<id>    unsaved copy of any dance ("Make my own version"), stored only on Save
 *   /edit/<id>             an own dance (built-in ids redirect to the player)
 */
import { Redirect, router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CoachHint, coachHint } from '@/components/editor/CoachHint';
import { DetailsCard } from '@/components/editor/DetailsCard';
import { EditorCanvas, RotateTray } from '@/components/editor/EditorCanvas';
import { EditorTopBar } from '@/components/editor/EditorTopBar';
import { FollowerSetupCard, FollowerToolsCard } from '@/components/editor/FollowerCards';
import { Inspector } from '@/components/editor/Inspector';
import { DanceNotFound } from '@/components/DanceNotFound';
import { RevealProvider, useRevealScroll } from '@/components/editor/reveal';
import { StepStrip } from '@/components/editor/StepStrip';
import { Entrance, goBackOrHome, hapticNotify, Screen, Segmented, Skeleton, useConfirm, useToast } from '@/components/ui';
import { errorText, useT } from '@/lib/i18n';
import { computeStates, nextCount } from '@/lib/pattern';
import { newDance, useDances } from '@/lib/store';
import { DEFAULT_FOOT_STYLE, ROLE_COLOR, space, styleColor } from '@/lib/theme';
import type { Dance, Role } from '@/lib/types';
import { copyForEditing, useDanceDraft } from '@/lib/useDanceDraft';

export default function EditorRoute() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { get, ready, isBuiltIn } = useDances();
  const t = useT();
  const isNew = id === 'new';

  // Wait for the store, or "Save" on a not-yet-loaded dance would create a new one.
  if (!ready) {
    return (
      <Screen header={<EditorTopBar title={isNew ? t.editor.newTitle : t.editor.editTitle} onClose={goBackOrHome} />}>
        <Skeleton height={68} radius={24} />
        <Skeleton height={320} radius={28} style={s.loadingStage} />
      </Screen>
    );
  }
  // Starter dances are read-only: the player offers "Make my own version".
  if (!isNew && isBuiltIn(id)) return <Redirect href={`/dance/${id}`} />;
  const existing = isNew ? undefined : get(id);
  if (!isNew && !existing) return <DanceNotFound testID="editor-not-found" />;
  const source = isNew && from ? get(from) : undefined;
  // key: another dance (or another source) gets a fresh editor
  return <Editor key={`${id}:${source?.id ?? ''}`} existing={existing} source={source} />;
}

/** Normalise what the user typed before storing. */
function finalize(d: Dance, untitled: string): Dance {
  const fixCounts = (p: Dance['roles']['leader']) => ({
    ...p,
    steps: p.steps.map((st, i) => (st.count.trim() ? st : { ...st, count: nextCount(p.steps.slice(0, i), d.beatsPerBar) })),
  });
  return {
    ...d,
    name: d.name.trim() || untitled,
    style: d.style.trim(),
    description: d.description.trim(),
    videoUrl: d.videoUrl?.trim() || undefined,
    roles: {
      leader: fixCounts(d.roles.leader),
      ...(d.roles.follower ? { follower: fixCounts(d.roles.follower) } : {}),
    },
  };
}

const URL_RE = /^https?:\/\/\S+\.\S+$/i;
/** true when a video link was typed that is not a web address */
function videoProblem(url: string | undefined): boolean {
  const v = url?.trim();
  return !!v && !URL_RE.test(v);
}

function Editor({ existing, source }: { existing?: Dance; source?: Dance }) {
  const isNew = !existing;
  const { save } = useDances();
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const { height: winH } = useWindowDimensions();
  const [initial] = useState<Dance>(() => (existing ? existing : source ? copyForEditing(source, t) : newDance()));
  const d = useDanceDraft(initial);
  const { draft, role, pattern, sel, startFoot } = d;

  const [detailsOpen, setDetailsOpen] = useState(isNew && !source);
  const [videoError, setVideoError] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { scrollRef, contentRef, onScroll, onLayout, onContentLayout, reveal: revealField } = useRevealScroll();

  // --- leaving -------------------------------------------------------------------------------
  const askDiscard = useCallback(
    () =>
      confirm({
        title: (tr) => tr.editor.discardTitle,
        message: (tr) => (isNew ? tr.editor.discardNew : tr.editor.discardEdits),
        confirmLabel: (tr) => tr.editor.discard,
        cancelLabel: (tr) => tr.editor.keepEditing,
        destructive: true,
        icon: 'trash',
      }),
    [confirm, isNew],
  );
  // hardware back, swipe-back and browser back/reload
  const allowLeave = usePreventRemove(d.dirty && !leaving, ({ repeat }) => {
    askDiscard().then((ok) => {
      if (!ok) return;
      setLeaving(true);
      repeat();
    });
  });
  const close = async () => {
    if (d.dirty && !(await askDiscard())) return;
    setLeaving(true);
    allowLeave();
    goBackOrHome();
  };

  const onSave = async () => {
    if (videoProblem(draft.videoUrl)) {
      setVideoError(true);
      setDetailsOpen(true);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      toast.show({ message: (tr) => tr.editor.checkVideo, icon: 'alert' });
      hapticNotify('error');
      return;
    }
    setSaving(true);
    try {
      const saved = await save(finalize(draft, t.common.untitled));
      hapticNotify('success');
      toast.show({ message: (tr) => (isNew ? tr.editor.saved : tr.editor.changesSaved), icon: 'check' });
      setLeaving(true);
      allowLeave();
      if (isNew) router.replace(`/dance/${saved.id}`);
      else if (router.canGoBack()) router.back();
      else router.replace(`/dance/${saved.id}`);
    } catch (e) {
      setSaving(false);
      toast.show({ message: (tr) => errorText(e, tr, tr.editor.saveFailed), icon: 'alert' });
    }
  };

  // --- steps -------------------------------------------------------------------------------
  const states = useMemo(() => (pattern ? computeStates(pattern) : []), [pattern]);
  const step = pattern && sel >= 0 ? pattern.steps[sel] : null;

  // The toast's Undo only applies while the delete is still the latest change.
  const rev = useRef(d.rev);
  useEffect(() => {
    rev.current = d.rev;
  }, [d.rev]);
  const { deleteStep: removeStep, undo } = d;
  const deleteStep = useCallback(
    (i: number) => {
      const expected = rev.current + 1;
      removeStep(i);
      toast.show({
        message: (tr) => tr.editor.stepDeleted(i + 1),
        icon: 'trash',
        action: { label: (tr) => tr.common.undo, onPress: () => rev.current === expected && undo() },
      });
    },
    [removeStep, undo, toast],
  );
  const { updateStep, select: selectStep } = d;
  const onCountBlur = useCallback(
    (i: number) => {
      const st = pattern?.steps[i];
      if (pattern && st && !st.count.trim()) updateStep(i, { count: nextCount(pattern.steps.slice(0, i), draft.beatsPerBar) });
    },
    [updateStep, pattern, draft.beatsPerBar],
  );
  const select = useCallback(
    (i: number) => {
      setBlocked(false);
      selectStep(i);
    },
    [selectStep],
  );

  const regenerate = async () => {
    const ok = await confirm({
      title: (tr) => tr.follower.regenerateTitle,
      message: (tr) => tr.follower.regenerateMessage,
      confirmLabel: (tr) => tr.follower.mirrorAgain,
      icon: 'mirror',
    });
    if (ok) d.createFollower('mirror');
  };
  const removeFollower = async () => {
    const ok = await confirm({
      title: (tr) => tr.follower.removeTitle,
      message: (tr) => tr.follower.removeMessage,
      confirmLabel: (tr) => tr.follower.remove,
      destructive: true,
      icon: 'trash',
    });
    if (ok) d.removeFollower();
  };

  // --- layout ------------------------------------------------------------------------------
  // Canvas + step strip fit on one phone screen together (with the details collapsed).
  const canvasH = Math.round(Math.min(380, Math.max(200, winH - 470)));
  const tone = styleColor(draft.style);
  const hint = coachHint({ sel, step, stepCount: pattern?.steps.length ?? 0, startFoot, dragging: d.dragging, blocked }, t);
  const roleOptions = (['leader', 'follower'] as Role[]).map((r) => ({
    value: r,
    label: t.roles[r],
    icon: r === 'leader' ? ('flat-shoe' as const) : ('heel' as const),
    tone: ROLE_COLOR[r],
  }));

  return (
    <Screen
      scroll={false}
      padded={false}
      testID="editor"
      header={
        <EditorTopBar
          title={isNew ? t.editor.newTitle : t.editor.editTitle}
          onClose={close}
          onUndo={d.undo}
          canUndo={d.canUndo}
          onSave={onSave}
          saving={saving}
        />
      }
    >
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        onLayout={onLayout}
        scrollEventThrottle={32}
        scrollEnabled={!pressing}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        <View ref={contentRef} onLayout={onContentLayout} style={s.stack}>
          <RevealProvider value={revealField}>
            <Entrance index={0}>
              <DetailsCard
                draft={draft}
                expanded={detailsOpen}
                onToggle={() => setDetailsOpen((o) => !o)}
                onChange={d.setDetails}
                onSeal={d.seal}
                videoError={videoError}
                onVideoBlur={() => setVideoError(videoProblem(draft.videoUrl))}
              />
            </Entrance>

            <Entrance index={1}>
              <Segmented label={t.roles.part} options={roleOptions} value={role} onChange={d.setRole} testID="role-switch" />
            </Entrance>

            {!pattern ? (
              <Entrance index={2}>
                <FollowerSetupCard onCreate={d.createFollower} />
              </Entrance>
            ) : (
              <>
                <Entrance index={2} style={s.work}>
                  <EditorCanvas
                    key={role}
                    pattern={pattern}
                    role={role}
                    footStyle={draft.footStyle?.[role] ?? DEFAULT_FOOT_STYLE[role]}
                    tone={tone}
                    sel={sel}
                    startFoot={startFoot}
                    height={canvasH}
                    onDragStart={d.beginDrag}
                    onDragMove={d.dragTo}
                    onDragEnd={d.endDrag}
                    onBlockedTouch={() => setBlocked(true)}
                    onPressChange={setPressing}
                  />
                  <View style={s.hintRow}>
                    <CoachHint text={hint} role={role} />
                    <RotateTray onRotate={d.rotate} disabled={step?.kind === 'hold'} />
                  </View>
                  <StepStrip steps={pattern.steps} role={role} sel={sel} onSelect={select} onAdd={d.addStep} />
                </Entrance>

                <Entrance index={3}>
                  <Inspector
                    role={role}
                    steps={pattern.steps}
                    sel={sel}
                    before={states[Math.max(0, sel)] ?? states[0]}
                    startFoot={startFoot}
                    onStartFoot={d.setStartFoot}
                    onAdd={d.addStep}
                    onUpdate={d.updateStep}
                    onCountBlur={onCountBlur}
                    onFoot={d.setFoot}
                    onKind={d.setKind}
                    onMove={d.moveStep}
                    onDelete={deleteStep}
                    onSeal={d.seal}
                  />
                </Entrance>

                {role === 'follower' && <FollowerToolsCard onRegenerate={regenerate} onRemove={removeFollower} />}
              </>
            )}
          </RevealProvider>
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: space.gutter, paddingTop: space.s, paddingBottom: space.xxl * 2 },
  stack: { gap: space.l },
  work: { gap: space.m },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  loadingStage: { marginTop: space.l },
});
