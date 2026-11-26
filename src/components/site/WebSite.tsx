/**
 * The public website (web only, see `src/app/_layout.web.tsx`). Waltzy is an app, not a web app:
 * a browser only ever shows
 *
 *   /c/<code>, /s/<id>   "Open in Waltzy" (the app's own link) and where to get the app
 *   /legal/terms, /legal/privacy   the same pages as in the app
 *   anything else        what Waltzy is and where to get it
 *
 * None of the app's providers are mounted here (no library, no account, no backend).
 */
import { useFonts } from 'expo-font';
import { router, Slot, usePathname } from 'expo-router';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { APP_SCHEME, INSTALL_URL } from '@/lib/cloud/config';
import { FONTS } from '@/lib/fonts';
import { I18nProvider, useT } from '@/lib/i18n';
import { PrefsProvider, usePrefs } from '@/lib/prefs';
import { classAppUrl, CLASS_CODE_LENGTH, SHARE_ID_LENGTH, shareAppUrl } from '@/lib/social/links';
import { colors, layout, radius, space } from '@/lib/theme';

const ICON = require('../../../assets/icon.png') as number;

export function WebSite() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  return (
    <PrefsProvider>
      <I18nProvider>
        <Site fontsReady={fontsLoaded || !!fontError} />
      </I18nProvider>
    </PrefsProvider>
  );
}

function Site({ fontsReady }: { fontsReady: boolean }) {
  const { ready } = usePrefs();
  const pathname = usePathname();
  // fonts and the language first: no flash of the fallback font or of the other language
  if (!fontsReady || !ready) return <View style={s.page} />;
  if (/^\/legal\/(terms|privacy)\/?$/.test(pathname)) return <Slot />;
  return <Landing path={pathname} />;
}

/** What the address points at: a class, a shared dance, or nothing in particular. */
function target(path: string): { kind: 'class' | 'share' | 'home'; appUrl: string; code?: string } {
  const [, kind, id = ''] = /^\/(c|s)\/([a-z0-9]+)/i.exec(path) ?? [];
  const key = id.toLowerCase();
  if (kind === 'c' && key.length === CLASS_CODE_LENGTH) return { kind: 'class', appUrl: classAppUrl(key), code: key };
  if (kind === 's' && key.length === SHARE_ID_LENGTH) return { kind: 'share', appUrl: shareAppUrl(key) };
  return { kind: 'home', appUrl: `${APP_SCHEME}://` };
}

/** Leave the page for the app (`waltzy://…`) or for the place to get it. */
const go = (url: string) => {
  if (typeof window !== 'undefined') window.location.assign(url);
};

/** "ab12cd34" → "AB12 CD34" */
const spaced = (code: string) => code.toUpperCase().replace(/(.{4})(?=.)/g, '$1 ');

function Landing({ path }: { path: string }) {
  const t = useT();
  const { kind, appUrl, code } = target(path);
  const invited = kind !== 'home';
  return (
    <ScrollView style={s.page} contentContainerStyle={s.scroll} testID="site">
      <View style={s.column}>
        <Image source={ICON} style={s.icon} accessibilityIgnoresInvertColors alt="" />
        <Text variant="display" align="center" accessibilityRole="header">
          Waltzy
        </Text>
        <Text variant="title" align="center" style={s.title} testID="site-title">
          {kind === 'class' ? t.site.classTitle : kind === 'share' ? t.site.shareTitle : t.site.lead}
        </Text>
        {invited && (
          <Text variant="body" color="ink2" align="center" style={s.body}>
            {kind === 'class' ? t.site.classBody : t.site.shareBody}
          </Text>
        )}
        <View style={s.actions}>
          {invited && <Button label={t.site.open} icon="arrow-right" onPress={() => go(appUrl)} testID="site-open" />}
          <Button label={t.site.get} variant={invited ? 'secondary' : 'primary'} onPress={() => go(INSTALL_URL)} testID="site-get" />
        </View>
        <Text variant="small" color="ink2" align="center" style={s.note}>
          {invited ? `${t.site.again} ${t.site.beta}` : t.site.beta}
        </Text>
        {!!code && (
          <Text variant="small" color="ink2" align="center" style={s.note} testID="site-code">
            {t.site.codeHint(spaced(code))}
          </Text>
        )}
        <View style={s.footer}>
          <Button label={t.account.terms} variant="ghost" size="sm" inline onPress={() => router.push('/legal/terms')} testID="site-terms" />
          <Button label={t.account.privacy} variant="ghost" size="sm" inline onPress={() => router.push('/legal/privacy')} testID="site-privacy" />
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.gutter, paddingVertical: space.xl },
  column: { width: '100%', maxWidth: layout.maxWidth, alignItems: 'stretch' },
  icon: { width: 96, height: 96, borderRadius: radius.card, alignSelf: 'center', marginBottom: space.m },
  title: { marginTop: space.l },
  body: { marginTop: space.s },
  actions: { gap: space.m, marginTop: space.xl },
  note: { marginTop: space.l },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: space.m, marginTop: space.xl },
});
