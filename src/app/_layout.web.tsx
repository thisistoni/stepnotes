/**
 * The web has no app: `https://waltzy.antoniobeslic.com` only receives the links people share.
 * On a phone with Waltzy those links open the app itself; in a browser this layout shows a page
 * that opens the app or says where to get it (`WebSite`), plus the terms and the privacy policy.
 *
 * QA builds still run the whole app in the browser (`EXPO_PUBLIC_WEB_APP=1`, or the fake cloud
 * with `EXPO_PUBLIC_CLOUD=fake`), because that is how the check scripts drive it.
 */
import { ErrorScreen } from '@/components/ErrorScreen';
import { WebSite } from '@/components/site/WebSite';

const Root =
  process.env.EXPO_PUBLIC_WEB_APP === '1' || process.env.EXPO_PUBLIC_CLOUD === 'fake'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('@/components/AppRoot') as typeof import('@/components/AppRoot')).default
    : WebSite;

export default Root;
export { ErrorScreen as ErrorBoundary };
