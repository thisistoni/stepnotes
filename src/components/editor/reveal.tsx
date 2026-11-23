/**
 * Keeps a focused text field visible above the keyboard inside a custom ScrollView.
 *
 *   const r = useRevealScroll();               // in the screen
 *   <ScrollView ref={r.scrollRef} onScroll={r.onScroll} onLayout={r.onLayout} scrollEventThrottle={32}>
 *     <View ref={r.contentRef} onLayout={r.onContentLayout}><RevealProvider value={r.reveal}>…</RevealProvider></View>
 *   </ScrollView>
 *
 *   const reveal = useReveal();                // in a field
 *   <TextField ref={ref} onFocus={() => reveal(ref.current)} />
 *
 * The screen's KeyboardAvoidingView shrinks the scroll view when the keyboard opens; after it
 * has settled we scroll just enough for the field to be fully visible (web: the browser does it).
 */
import { createContext, useCallback, useContext, useEffect, useRef, type ComponentRef } from 'react';
import { Platform, ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

type ViewInstance = ComponentRef<typeof View>;
type Measurable = Pick<ViewInstance, 'measureLayout'> | null;
type RevealFn = (node: Measurable) => void;

const Ctx = createContext<RevealFn>(() => {});
export const RevealProvider = Ctx.Provider;
export const useReveal = () => useContext(Ctx);

const KEYBOARD_SETTLE_MS = 320;
const MARGIN = 24;

export function useRevealScroll() {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const contentRef = useRef<ViewInstance>(null);
  const offset = useRef(0);
  const viewport = useRef(0);
  /** y of the measured content view inside the scroll content (the container's top padding) */
  const contentTop = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    viewport.current = e.nativeEvent.layout.height;
  }, []);
  const onContentLayout = useCallback((e: LayoutChangeEvent) => {
    contentTop.current = e.nativeEvent.layout.y;
  }, []);

  const reveal = useCallback<RevealFn>((node) => {
    if (Platform.OS === 'web' || !node) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      const content = contentRef.current;
      if (!content) return;
      node.measureLayout(
        content,
        (_x: number, yInContent: number, _w: number, h: number) => {
          const y = yInContent + contentTop.current;
          const top = offset.current;
          const bottom = top + viewport.current;
          if (y + h + MARGIN > bottom) scrollRef.current?.scrollTo({ y: y + h + MARGIN - viewport.current, animated: true });
          else if (y - MARGIN < top) scrollRef.current?.scrollTo({ y: Math.max(0, y - MARGIN), animated: true });
        },
        () => {},
      );
    }, KEYBOARD_SETTLE_MS);
  }, []);

  return { scrollRef, contentRef, onScroll, onLayout, onContentLayout, reveal };
}
