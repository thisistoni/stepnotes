import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Platform, ScrollView } from 'react-native';

/** true while the on-screen keyboard is up (always false on web: the browser moves the page itself) */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const a = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setOpen(true));
    const b = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return open;
}

const KEYBOARD_SETTLE_MS = 320;

/**
 * For a text field at the end of a ScrollView inside a `<Sheet>`: the sheet shrinks when the
 * keyboard opens, so once that has settled we scroll to the end and the field (and the button
 * under it) is in view again.
 *
 *   const { scrollRef, onFocus } = useScrollToEndOnFocus();
 *   <ScrollView ref={scrollRef}>… <TextField onFocus={onFocus} /></ScrollView>
 */
export function useScrollToEndOnFocus() {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const onFocus = useCallback(() => {
    if (Platform.OS === 'web') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      scrollRef.current?.scrollToEnd({ animated: true });
    }, KEYBOARD_SETTLE_MS);
  }, []);
  return { scrollRef, onFocus };
}
