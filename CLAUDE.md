# LakeLore Mobile — Working Context

React Native + Expo app shipped to App Store + Google Play. iPhone-only for v1 (`supportsTablet:false`). Production target.

> **Live launch checklist:** `./LAUNCH.md` — current blockers and shipped items.
> **Store metadata source of truth:** `./STORE_LISTING.md` — copy, screenshots shot list, App Privacy answers.
> **Operational reference:** `~/APP_OPS.md` — vendor accounts, identifiers, secrets locations, gotchas.
> **Emergency runbook:** `~/RUNBOOK.md` — rollback, secret rotation, broken builds.

---

## Architecture in 30 seconds

**Three screens** (`src/screens/`):
1. `StateSelectScreen` — picks one of 7 states (SD, MN, ND, IA, NE, WI, MI). MN is free; tapping any other opens the paywall for non-subscribers.
2. `SearchScreen` — species + lake-name search, advanced filters, list or scatter view.
3. `LakeDetailScreen` — CPUE-over-time chart, stocking history with adults/100ac overlay.

Plus three modals: `PaywallScreen`, `AboutScreen` (sources + agency credits, accessible from State Select), and a Glossary inside SearchScreen.

**Navigation** (`App.tsx`): single `StateProvider` + native stack navigator. State selection is gated *before* the navigator mounts.

**State management**: lightweight. `StateContext` (which state is selected, persisted in AsyncStorage). `useEntitlement()` hook tracks subscription status. Per-screen useState for everything else; session cache in `SearchScreen` retains scroll/results when switching states.

**Data flow**: every screen fetches over HTTP from `lake-fish-api.fly.dev`. No bundled database. The API client (`src/api.ts`) sends an anonymous user UUID (`src/userId.ts`) as `X-User-Id` on every request.

## Paywall plumbing (locked 2026-05-11)

- **Free**: MN. **Paid**: WI, MI, ND, SD, NE, IA via `LakeLore All-States` subscription at **$5.99/yr** auto-renewing.
- **Provider**: RevenueCat. SDK key wired in `src/iap.ts`. Configured 2026-05-12.
- **Server gate**: paid-state `/results`, `/lake/:id`, `/pdf` endpoints return 402 without entitlement. `/status` and `/filters` stay public (for marketing site stats).
- **No accounts**: anonymous device UUID identity. Reinstall = new UUID; user taps "Restore Purchases" to reattach Apple/Google account-level receipt.

See `~/APP_OPS.md` for full identifier inventory, subscription IDs, RC project ID, and the RC "credentials need attention" false-positive note.

## Design system

- `src/lakelore-rn/theme/` — colors (paper-cream + ink + walleye-gold), spacing tokens, typography (Young Serif + Instrument Serif + Newsreader + JetBrains Mono).
- `src/lakelore-rn/components/` — `PaperHeader`, `Chip`, `PrimaryButton`, `Segmented`, `Toggle`, `LakeRow`, `StatPill`, `SectionLabel`.
- `src/Toast.tsx` — non-modal validation messages (replaced `Alert.alert`).
- **Aesthetic anchor**: paper-and-ink editorial style, like a 1950s field guide. Cream `#f4efe4` background, dark navy `#1a1f2a` ink, walleye-gold `#c89a3c` accents. Don't introduce other colors casually.

## Build and run

```bash
# Dev (must be a native build — Expo Go can't load RC's native module)
npm run build:dev:ios          # produces a simulator dev client (~15 min)
npm start                      # `expo start --dev-client`, connects Metro to the dev client

# Preview (internal distribution; APK on Android, signed .ipa on iOS)
npm run build:preview:android  # APK for sideloading
npm run build:preview:ios

# Production (Play Store AAB / App Store .ipa)
npm run build:prod:android     # AAB for Play Store upload
npm run build:prod:ios

# Submit to stores
npm run submit:ios             # uploads latest production build to TestFlight
npm run submit:android         # uploads latest production AAB to Play Internal Testing
```

EAS config: `eas.json`. Project ID + owner in `app.json` `extra.eas`. Owner `ndrwtp` (personal Expo account).

## Important constraints

- **`react-native-purchases` is a native module.** Once it's in `package.json`, the legacy Expo Go QR-and-go dev flow doesn't work. Dev means a dev client; first dev build takes 10–15 min on EAS free-tier queue.
- **`@sentry/react-native` plugin requires `organization` and `project` in `app.json`** (already set to `lakelore` / `lakelore-mobile`), OR `SENTRY_DISABLE_AUTO_UPLOAD=true` as a build env var, otherwise the Android Gradle step fails. `SENTRY_AUTH_TOKEN` is an EAS project-secret env var so source-map upload works on every build.
- **iOS bundle ID and Android package name** (`com.lakeloreapp.lakelore`) are immutable post-publish — same for subscription product IDs. See `~/APP_OPS.md` for the full identifier table.
- **No `ios/` or `android/` folder** is committed — managed Expo workflow. Native code regenerates from `app.json` on every EAS build.

## Reading order for a fresh Claude session

1. This file (auto-loaded when CWD is `~/lake-fish-mobile/`).
2. `./LAUNCH.md` — what's the current launch state.
3. `~/APP_OPS.md` — what vendor accounts and identifiers are involved.
4. `~/CLAUDE.md` — top-level project overview.
5. `./STORE_LISTING.md` if working on store submission.
6. `~/RUNBOOK.md` if something is on fire.
