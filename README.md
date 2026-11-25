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
  - Duplicate, share as text, delete (with undo).
- **Editor**: drag the feet on a grid, press and hold a foot to turn it (the toes follow your finger, in 15° steps; the ±15° buttons do the same), drag the empty floor to move the view (the crosshair shows everything again), and set each step's count, length (½ / 1 / 2 beats), foot, action (step, tap, hold) and a note. Generate the follower part as a mirror of the leader, then adjust it. Undo for every change. "Make my own version" of a starter dance opens the editor on a copy that is only saved when you press Save.
- **Import**: paste a dance someone shared (extra chat text around it is fine).
- **Tabs**: Library · Classes · Me. Player, editor, import, sign-in and the legal pages open above the tabs.
- **Account (optional)**: everything works on the device without one. Signing in (e-mail + 6-digit code, no password) backs your dances up and brings them to your other devices. The Me tab shows the backup status, lets you change your name, sign out (dances stay) and delete the account. Classes is a placeholder for now.
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
    dance/[id].tsx        player
    edit/[id].tsx         editor ("new" creates a dance, ?from=<id> copies one)
    import.tsx            paste a shared dance
  components/
    ui/                   design system: Text, PressableLip, Button, Segmented, Sheet, Toast…
    StepDiagram.tsx       the SVG diagram: animation, chart and touch editing
    FootShape.tsx         shoe and heel footprints
    TabBar.tsx            the custom tab bar
    library/ player/ editor/ intro/ account/ legal/   parts of each screen
  lib/
    types.ts              data model
    pattern.ts            step maths: weight, interpolation, mirror, partner, descriptions
    chartLayout.ts        arrow and label placement for the chart and the animation
    usePlayback.ts        beat clock (runs on the UI thread)
    useDanceDraft.ts      editor state with undo
    store.tsx, prefs.tsx  saved dances and settings (AsyncStorage)
    cloud/                backend seam, accounts, library sync (see Backend)
    libraryEvents.ts      explicit delete / undo events for the sync
    validate.ts           checks imported and stored dances
    i18n/                 German and English texts, useT(), plurals
    builtins.ts           starter dances
    theme.ts              colours, type, spacing
```

## Backend

Optional accounts and the library backup run on Supabase (EU, Frankfurt). The app is local-first: AsyncStorage is the source of truth for the UI, the cloud is a backup that merges between devices.

The database (tables, row level security, functions) is in `supabase/migrations/`, exactly as applied to the live project. Change the schema with a new migration file there, never by hand in the dashboard. People who only receive (open a link, join a class) need no account and read through functions keyed by an unguessable id or code; people who publish need an account and manage their own rows.

```
src/lib/cloud/
  api.ts          CloudApi interface + CloudError (reason: offline | notSignedIn | invalidCode | rateLimited | limit | notFound | unknown)
  config.ts       Supabase URL + publishable key, WEB_ORIGIN, OPERATOR (who runs the app, for the legal pages)
  supabaseApi.ts  the real implementation (the only file that imports @supabase/supabase-js; client created on first use)
  fakeApi.ts      the same behaviour in AsyncStorage (`waltzy.fakecloud.v1`) for QA builds; code 123456
  index.ts        `cloud` (fake when EXPO_PUBLIC_CLOUD=fake), `cloudErrorText(e, t)`
  auth.tsx        AuthProvider, useAuth(), useRequireAccount()
  sync.tsx        SyncProvider, useSync(), useSyncSource() (when to sync, I/O)
  merge.ts        the pure last-writer-wins decision (tested with a node script)
  syncMemory.ts   sync state on the device (`waltzy.sync.v1`)
  DanceSync.tsx   registers the user's dances with the engine
```

- **Screens never import Supabase**: everything goes through `cloud`. Every method rejects with a `CloudError`; show `cloudErrorText(e, t)`.
- **Untrusted data**: `dance` / `data` from the cloud always goes through `parseDance` before it is shown or stored.
- **Sync**: last writer wins per item on `updatedAt` (client ms), same rule as the database function `push_library_items`. Deletions are explicit: `DanceProvider.remove` / `restore` call `emitRemoved` / `emitRestored` (`src/lib/libraryEvents.ts`); an item that is merely missing locally never deletes the cloud copy. Built-in starter dances are never synced. Signing in as another person on the same device merges the local dances into that account.
- **Credit** (`Dance.source`): kept in storage and in the backup, never in a JSON export, and dropped from pasted text on import (so it cannot be made up).
- **Build with the fake** (all QA runs against it, the container cannot reach supabase.co):

  ```bash
  EXPO_PUBLIC_CLOUD=fake npx expo export --platform web --output-dir dist-fake
  ```

  Sign in with any e-mail and the code `123456` (`000000` is a wrong code). One browser profile can play several devices: wipe the `waltzy.*` keys except `waltzy.fakecloud.v1`. `window.__fakeCloud.setOffline(true)` makes every call fail with `offline`.
- **Links** (used by sharing and classes): `https://<web origin>/s/<shareId>` (a shared dance), `https://<web origin>/c/<classCode>` (a class); inside the app `waltzy://s/<shareId>`, `waltzy://c/<classCode>`. `WEB_ORIGIN` is the page's origin on web, else `EXPO_PUBLIC_WEB_ORIGIN` or `https://waltzy.expo.app`.

## Languages

All user-facing text lives in `src/lib/i18n/`: `en.ts` is the source and defines the `Strings` type, `de.ts` must match it exactly (a missing or extra key does not compile). Components call `useT()`; code outside React (step descriptions, validation errors) takes the dictionary as an argument. Sentences with values are functions (`t.count.stepOf(3, 8)`), plurals go through `plural.ts`, and step descriptions are written per language from the step's structure (`analyzeStep` in `pattern.ts`). The starter dances get their names, styles, descriptions and notes from the dictionaries too.

To add a language: add its code to `LANGUAGES` in `languages.ts`, write `xx.ts` typed as `Strings` (start from `en.ts`), add a plural rule in `plural.ts` and register the dictionary in `STRINGS` in `index.tsx`. If its style names differ (like "Latein"), add them to `STYLE_ALIASES` in `theme.ts` so they keep their colours.

## Data model

A `Dance` has a name, style, tempo (bpm), beats per bar, a `leader` pattern and an optional `follower` pattern. A pattern is a **start position** for both feet plus a list of **steps**. Each step has a count label (`"1"`, `"&"`, …), a length in beats, which foot moves, an action (`step` takes the weight, `tap` touches without weight, `hold` pauses), where the foot ends up (`x`, `y`, `rot`) and optionally a `pivot`: how far the weight-bearing foot swivels on the spot meanwhile (spins, turns). The dancer faces up the screen at the start (after a turn, "forward" in the descriptions and the facing arrow follow the dancer) and one unit is about one foot width. Weight, animation, charts and descriptions are all calculated from this.

Shared dances are this same structure as JSON text.

> The starter routines were researched figure by figure; the sources and the points a dance teacher should double-check are listed next to each dance in `src/lib/builtins.ts`.

See [`docs/PRODUCT_IDEAS.md`](docs/PRODUCT_IDEAS.md) for who the app is for, questions for a dancer, and the roadmap.
