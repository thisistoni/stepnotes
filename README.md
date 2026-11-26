# Waltzy

A mobile app (iOS and Android, built with Expo / React Native) for **learning and writing down dance steps as footprint diagrams**: the numbered "feet and arrows" charts dance schools hand out, but animated, slowed down and editable.

<p>
  <img src="docs/screenshots/library.png" width="190" alt="Library" />
  <img src="docs/screenshots/player.png" width="190" alt="Player, playing" />
  <img src="docs/screenshots/chart.png" width="190" alt="Player, chart of one bar" />
  <img src="docs/screenshots/editor.png" width="190" alt="Editor" />
  <img src="docs/screenshots/intro.png" width="190" alt="Intro lesson" />
</p>

## What it does

- **Intro** (first launch): three short steps. Welcome, which part you dance (leader, follower or both), and a one-minute interactive lesson on reading the footprints. The lesson can be opened again from the library.
- **Library**: four starter routines of beginner figures (Slow Waltz: box and left box turn; Cha-cha: basic and New Yorker; Salsa On1: basic, side basic and the follower's right turn; Bachata: side basic and the follower's inside turn) and your own dances, with search and style filters.
- **Player**
  - *Animate*: the feet glide on the beat. The foot carrying your weight is solid, the free foot is light, and the moving foot has a thick numbered arrow and a dashed outline where it will land. Taps and holds look different from a normal step; when a foot turns on its way, it is drawn turned and its arrow curves the same way.
  - Big count, a plain-language description ("Right foot steps back"), beat pills to jump to any step, and previous / next to walk through one step at a time.
  - *Chart*: the printed view with every position numbered, one chart per bar (short dances of up to three bars can also show all steps at once).
  - Leader, Follower or **Both** side by side, in sync.
  - Tempo 50–125 %, loop, spoken counts, mirror mode, L / R letters, and vibration on each step (phones only).
  - Duplicate, share (a link with a QR code), delete (with undo).
- **Editor**: drag the feet on a grid, press and hold a foot to turn it (the toes follow your finger, in 15° steps; the ±15° buttons do the same), drag the empty floor to move the view (the crosshair shows everything again), and set each step's count, length (½ / 1 / 2 beats), foot, action (step, tap, hold) and a note. Generate the follower part as a mirror of the leader, then adjust it. Undo for every change. "Make my own version" of a starter dance opens the editor on a copy that is only saved when you press Save.
- **Tabs**: Library · Classes · Me. Player, editor, sign-in and the legal pages open above the tabs.
- **Account (optional)**: everything works on the device without one. Signing in (e-mail + 6-digit code, no password) backs your dances up and brings them to your other devices, by itself and live: there is no sync button. The Me tab shows the backup status, lets you change your name, sign out (dances stay) and delete the account, and lists your shared links and the people you blocked.
- **Sharing** (needs an account to publish, never to receive): a dance, your own or a starter, gets a link and a QR code (update it after changes, or stop sharing). Anyone who opens the link sees the dance in the player, even on their very first visit (no intro first), and can save a copy with credit ("by Anna").
- **Classes**: a teacher creates a class, posts dances with a note ("Week 3: the turn"), updates or removes them and invites students with a link, a code and a big QR code. Students join without an account (remembered on the device, joined in the account after signing in), watch and save the dances. The Classes tab lists the classes you teach and joined, also offline.
- **Report and block**: every shared dance, class and class dance can be reported (four reasons); blocking a person hides their links and classes on this device.
- **Languages**: German and English. The app follows the device language (German if the device is set to German, otherwise English) until you pick one under Me → Language or with DE | EN on the first intro screen; that choice is saved with the other settings.

## Run it

```bash
npm install
npx expo start
```

Press `w` to open it in a browser, or `i` / `a` for a simulator. The app uses only modules included in Expo Go, so you can also scan the QR code with Expo Go.

Before committing:

```bash
npm run lint && npm run typecheck
```

Builds for the stores use EAS (`npx eas-cli@latest build`). The `ios/` and `android/` folders are generated, so configure native settings in `app.json`.

## Project layout

```
src/
  app/                    screens (Expo Router)
    _layout.tsx           providers, fonts, splash screen, first-run redirect
    intro.tsx             intro; /intro?lesson=1 shows only the lesson
    (tabs)/_layout.tsx    tab bar: Library (index.tsx, "/"), Classes (classes.tsx), Me (me.tsx)
    sign-in.tsx           e-mail → code → name (modal)
    legal/                terms.tsx, privacy.tsx
    dance/[id].tsx        player of a library dance (?share=1 opens the share sheet)
    s/[id].tsx            a shared dance (public, outside the intro gate)
    c/[code].tsx          a class (public); c/[code]/[postId].tsx one of its dances; c/[code]/invite.tsx
    shared-links.tsx, blocked.tsx   Profile → My shared links / Blocked people
    edit/[id].tsx         editor ("new" creates a dance, ?from=<id> copies one)
  components/
    ui/                   design system: Text, PressableLip, Button, Segmented, Sheet, Toast…
    StepDiagram.tsx       the SVG diagram: animation, chart and touch editing
    FootShape.tsx         shoe and heel footprints
    TabBar.tsx            the custom tab bar
    library/ player/ editor/ intro/ account/ legal/ social/   parts of each screen
    player/PlayerView.tsx the player without the library around it (used by the three player routes)
    QrCode.tsx            QR code (pure-JS matrix from qrcode-generator, drawn with react-native-svg)
  lib/
    types.ts              data model
    pattern.ts            step maths: weight, interpolation, mirror, partner, descriptions
    chartLayout.ts        arrow and label placement for the chart and the animation
    usePlayback.ts        beat clock (runs on the UI thread)
    useDanceDraft.ts      editor state with undo
    store.tsx, prefs.tsx  saved dances and settings (AsyncStorage)
    cloud/                backend seam, accounts, library sync (see Backend)
    libraryEvents.ts      explicit delete / undo events for the sync
    social/               blocked people, my shared links, my classes (device caches), links, saving with credit
    validate.ts           checks received and stored dances
    i18n/                 German and English texts, useT(), plurals
    builtins.ts           starter dances
    theme.ts              colours, type, spacing
```

## Backend

Optional accounts and the library backup run on Supabase (EU, Frankfurt). The app is local-first: AsyncStorage is the source of truth for the UI, the cloud is a backup that merges between devices.

The database (tables, row level security, functions) is in `supabase/migrations/`, exactly as applied to the live project. Change the schema with a new migration file there, never by hand in the dashboard. People who only look (open a shared dance, or a class without approval) need no account and read through functions keyed by an unguessable id or code; people who publish or join a class need an account. Joining needs one so the teacher sees who is in the class (`class_member_list`); a class with `approval` shows its dances only to members the teacher accepted (`join_class_v2` returns `pending`, `class_member_set` accepts or removes).

```
src/lib/cloud/
  api.ts          CloudApi interface + CloudError (reason: offline | notSignedIn | invalidCode | rateLimited | limit | notFound | unknown)
  config.ts       Supabase URL + publishable key, WEB_ORIGIN, OPERATOR (who runs the app, for the legal pages)
  supabaseApi.ts  the real implementation (the only file that imports @supabase/supabase-js; client created on first use)
  fakeApi.ts      the same behaviour in AsyncStorage (`waltzy.fakecloud.v1`) for QA builds; code 123456
  index.ts        `cloud` (fake when EXPO_PUBLIC_CLOUD=fake), `cloudErrorText(e, t)`
  auth.tsx        AuthProvider, useAuth(), useRequireAccount()
  sync.tsx        SyncProvider, useSync(), useSyncSource() (when to sync, I/O; always automatic)
  merge.ts        the pure last-writer-wins decision (tested with a node script)
  syncMemory.ts   sync state on the device (`waltzy.sync.v1`)
  DanceSync.tsx   registers the user's dances with the engine
```

- **Sign-in**: Sign in with Apple on iOS (`src/components/account/AppleSignIn.ios.tsx`; other platforms get the empty `AppleSignIn.tsx`) and Google everywhere (`cloud.signInWithGoogle`: Google's page in the system sign-in sheet on phones, a normal redirect on the web). In the Supabase dashboard this needs the Apple provider with the bundle id as client id, the Google provider with an OAuth client id and secret, and the redirect URLs `waltzy://sign-in` and `https://waltzy.antoniobeslic.com/sign-in`. The e-mail code flow is built but switched off (`EMAIL_SIGN_IN` in `src/lib/cloud/config.ts`): it needs a mail service on the backend. QA builds with the fake cloud keep it, so the check scripts still sign in with it.
- **Screens never import Supabase**: everything goes through `cloud`. Every method rejects with a `CloudError`; show `cloudErrorText(e, t)`.
- **Untrusted data**: `dance` / `data` from the cloud always goes through `parseDance` before it is shown or stored.
- **Sync** runs by itself: after sign-in, on start, in the foreground, shortly after a local change, at once when another device changed the library (`cloud.onLibraryChange`: Supabase Realtime on `library_items`, only a nudge to pull) and once a minute while open. The Me tab only shows the status, with "Try again" after an error. Last writer wins per item on `updatedAt` (client ms), same rule as the database function `push_library_items`. Deletions are explicit: `DanceProvider.remove` / `restore` call `emitRemoved` / `emitRestored` (`src/lib/libraryEvents.ts`); an item that is merely missing locally never deletes the cloud copy. Built-in starter dances are never synced. Signing in as another person on the same device merges the local dances into that account.
- **Credit** (`Dance.source`): kept in storage and in the backup, never sent with a shared link (`sharePayload`).
- **Build with the fake** (all QA runs against it, the container cannot reach supabase.co):

  ```bash
  EXPO_PUBLIC_CLOUD=fake npx expo export --platform web --output-dir dist-fake
  ```

  A fake build is also the only web build that runs the app itself: the public website shows no app (see "Website").

  Sign in with any e-mail and the code `123456` (`000000` is a wrong code). One browser profile can play several devices: wipe the `waltzy.*` keys except `waltzy.fakecloud.v1`. `window.__fakeCloud.setOffline(true)` makes every call fail with `offline`.
- **Device keys of sharing and classes**: `waltzy.shares.v1` (my links, for the signed-in user), `waltzy.classes.v1` (the last list of my classes; plus codes joined without an account by earlier versions), `waltzy.classdetails.v1` (the last loaded page of up to 20 classes, for offline), `waltzy.blocked.v1` (blocked people `{ id, name, at }`).
- **Links** (used by sharing and classes): `https://<web origin>/s/<shareId>` (a shared dance), `https://<web origin>/c/<classCode>` (a class); inside the app `waltzy://s/<shareId>`, `waltzy://c/<classCode>`. `WEB_ORIGIN` is the page's origin on web, else `EXPO_PUBLIC_WEB_ORIGIN` or `https://waltzy.antoniobeslic.com`.
- **Website** (`https://waltzy.antoniobeslic.com`): there is no web version of the app. The address only receives the links and QR codes people share. On an iPhone with Waltzy they open the app directly (universal links: `ios.associatedDomains` in `app.json` plus `public/.well-known/apple-app-site-association`, which lists the Apple team id and the paths `/c/*` and `/s/*`). In a browser, `src/app/_layout.web.tsx` shows `src/components/site/WebSite.tsx`: "Open in Waltzy" (the `waltzy://` link), where to get the app (`INSTALL_URL` in `src/lib/cloud/config.ts`, the public TestFlight link during the beta), and the terms and privacy pages. Built from the `Dockerfile` (static export served by nginx, `deploy/nginx.conf`) by Dokploy on the owner's server; that address has to stay up. Android: the intent filter is in `app.json`, but links only open the app once `public/.well-known/assetlinks.json` exists with the signing key's fingerprint (`eas credentials -p android`); until then they show the website.
- **Scanner** (`src/app/scan.tsx`): `expo-camera` reads QR codes inside the app (a class or a shared dance, `parseScanned` in `src/lib/social/links.ts`). The camera does not work in the iOS simulator.

## Languages

All user-facing text lives in `src/lib/i18n/`: `en.ts` is the source and defines the `Strings` type, `de.ts` must match it exactly (a missing or extra key does not compile). Components call `useT()`; code outside React (step descriptions, validation errors) takes the dictionary as an argument. Sentences with values are functions (`t.count.stepOf(3, 8)`), plurals go through `plural.ts`, and step descriptions are written per language from the step's structure (`analyzeStep` in `pattern.ts`). The starter dances get their names, styles, descriptions and notes from the dictionaries too.

To add a language: add its code to `LANGUAGES` in `languages.ts`, write `xx.ts` typed as `Strings` (start from `en.ts`), add a plural rule in `plural.ts` and register the dictionary in `STRINGS` in `index.tsx`. If its style names differ (like "Latein"), add them to `STYLE_ALIASES` in `theme.ts` so they keep their colours.

## Data model

A `Dance` has a name, style, tempo (bpm), beats per bar, a `leader` pattern and an optional `follower` pattern. A pattern is a **start position** for both feet plus a list of **steps**. Each step has a count label (`"1"`, `"&"`, …), a length in beats, which foot moves, an action (`step` takes the weight, `tap` touches without weight, `hold` pauses), where the foot ends up (`x`, `y`, `rot`) and optionally a `pivot`: how far the weight-bearing foot swivels on the spot meanwhile (spins, turns). The dancer faces up the screen at the start (after a turn, "forward" in the descriptions and the facing arrow follow the dancer) and one unit is about one foot width. Weight, animation, charts and descriptions are all calculated from this.

A shared link and the backup carry this same structure as JSON.

> The starter routines were researched figure by figure; the sources and the points a dance teacher should double-check are listed next to each dance in `src/lib/builtins.ts`.

See [`docs/PRODUCT_IDEAS.md`](docs/PRODUCT_IDEAS.md) for who the app is for, questions for a dancer, and the roadmap.
