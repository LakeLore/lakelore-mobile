# LakeLore — Launch Checklist

The single source of truth for what's left before LakeLore ships to the App Store and Google Play. Maintained alongside the codebase.

For listing copy, screenshot capture, and store-form answers, see [STORE_LISTING.md](./STORE_LISTING.md). This file tracks the *infrastructure and code* work that surrounds those.

Last reviewed: 2026-05-05.

---

## At a glance

| | Item | Owner | Estimate |
|---|---|---|---|
| 🛑 | [Apple Developer Program enrollment](#apple-developer-program-99yr) | you | 1 day (Apple verification) |
| 🛑 | [Google Play Console enrollment](#google-play-console-25-one-time) | you | ~1 hr |
| 🛑 | [Expo / EAS account](#expo--eas-account) | you | 5 min |
| 🛑 | [EAS Build setup](#eas-build-setup) | shared | 30 min config + 1 hr first build |
| 🛑 | [Capture screenshots](#capture-screenshots) | you | 1–2 hr |
| 🛑 | [`support@lakeloreapp.com` Google Workspace alias](#supportlakeloreappcom-alias) | you | 5 min |
| 🛑 | [iPad decision: `supportsTablet`](#ipad-decision-supportstablet) | you | 1 min decide, then either iPad screenshots or a flag flip |
| ⚠️ | [Sentry crash + error monitoring](#sentry-crash--error-monitoring) | shared | 30 min |
| ⚠️ | [Offsite DB backups](#offsite-db-backups) | shared | 30 min |
| ⚠️ | [Auto-discover dev API host](#auto-discover-dev-api-host) | me | 10 min |
| ⚠️ | [In-app "Sources / About" page](#in-app-sources--about-page) | me | 1 hr |
| 🧹 | [Empty / error state polish](#empty--error-state-polish) | me | 1 hr |
| 🧹 | [Replace `Alert.alert` validation with toast](#replace-alertalert-validation-with-toast) | me | 30 min |

🛑 = blocker · ⚠️ = strongly recommended pre-launch · 🧹 = polish, post-launch fine

---

## 🛑 Blockers (cannot submit without these)

### Apple Developer Program ($99/yr)

**Why.** Required to submit any iOS app. Apple verifies your identity (sometimes by phone) which can take a day or two.

**Done when.** Membership is active at developer.apple.com/account; you have a Team ID and can sign into App Store Connect.

**Owner.** You.

---

### Google Play Console ($25 one-time)

**Why.** Required to publish to the Play Store. Verification is faster than Apple's, usually within an hour.

**Done when.** play.google.com/console shows your developer account active.

**Owner.** You.

---

### Expo / EAS account

**Why.** EAS Build (used to produce signed `.ipa` / `.aab`) runs on Expo's cloud and needs an account.

**Done when.** `eas whoami` from any terminal returns your Expo handle.

**Owner.** You. Sign up at https://expo.dev.

---

### EAS Build setup

**Why.** Without this, there's no shippable binary. `npx expo prebuild` + `xcodebuild` can theoretically produce one, but EAS handles signing, version increments, TestFlight upload, and Play upload in a single command.

**Done when.**
- [ ] `eas.json` exists with `development`, `preview`, and `production` profiles.
- [ ] `app.json` has `extra.eas.projectId` populated by `eas init`.
- [ ] `auto-increment` is enabled so Apple doesn't reject a build for reusing `CFBundleVersion`.
- [ ] `eas build --profile preview --platform ios` succeeds and produces a TestFlight-installable build.
- [ ] `eas build --profile preview --platform android` succeeds and produces an internal-testing-installable AAB.

**Where.** `~/lake-fish-mobile/eas.json` (to be created); `app.json` updated by `eas init`.

**Owner.** Shared. I write config + walk you through `eas login` (must be interactive in your shell).

**Notes.** Pre-requisite to screenshots if you want them from a real native build. Screenshots can also be captured from Expo Go without EAS — see STORE_LISTING.md.

---

### Capture screenshots

**Why.** Apple requires 6.9" iPhone screenshots (1320×2868); Google Play requires phone screenshots. Apple also requires 13" iPad screenshots if `supportsTablet:true`.

**Done when.**
- [ ] 5–8 iPhone 6.9" screenshots in `~/lake-fish-mobile/screenshots/ios-6.9/` matching the shot list in STORE_LISTING.md.
- [ ] iPad screenshots if `supportsTablet` stays `true` (see next item).
- [ ] Same screenshots reused or recaptured for Android (1080×1920 or larger phone format) in `~/lake-fish-mobile/screenshots/android-phone/`.

**Where.** Capture guide in `STORE_LISTING.md` → "Screenshots — capture guide".

**Owner.** You.

---

### `support@lakeloreapp.com` alias

**Why.** The Apple App Store reviewer checks the Support URL. Currently `https://lakeloreapp.com/support` publishes the email address `support@lakeloreapp.com`. If that alias doesn't exist in Google Workspace, support emails bounce and Apple may flag it.

**Done when.** Sending email to `support@lakeloreapp.com` from any account lands in your inbox.

**Where.** admin.google.com → Apps → Google Workspace → Gmail → Routing, OR Users → your account → Email aliases.

**Owner.** You.

---

### iPad decision: `supportsTablet`

**Why.** Currently `app.json` has `ios.supportsTablet: true`. If left true, Apple **requires** iPad screenshots and rejects submissions without them. The codebase doesn't have iPad-specific layouts, so the app will work on iPad but won't be optimized for the larger screen.

**Decision.** Either:

- **Drop iPad for v1:** flip to `"supportsTablet": false` in `app.json`. Apple stops asking for iPad screenshots. Add iPad later as a v1.x feature.
- **Keep iPad in:** capture three iPad 13" screenshots (2064×2752) in addition to the iPhone shots.

**Done when.** Decision recorded here and `app.json` reflects it.

**Where.** `~/lake-fish-mobile/app.json` line `"supportsTablet"`.

**Owner.** You. Recommendation: drop for v1 unless you've actually been using the app on an iPad and it looks right.

---

## ⚠️ Strongly recommended pre-launch

### Sentry crash + error monitoring

**Why.** Without this, you'll only learn about prod crashes from store reviews. Sentry captures stack traces from both the React Native app and the Node API, with breadcrumbs of what the user did before the crash. Free tier covers this app comfortably.

**Done when.**
- [ ] Sentry account created.
- [ ] DSN added to `app.json` `extra` and to Fly secrets.
- [ ] `App.tsx` initializes `@sentry/react-native` (Expo plugin handles native config).
- [ ] `server.js` initializes `@sentry/node` and wraps the request handler.
- [ ] A test crash from each side is visible in the Sentry dashboard.

**Where.** New deps in `lake-fish-mobile/package.json` and `lake-fish-mobile-server/package.json`.

**Owner.** Shared. You create the Sentry account and grab the DSN; I wire both runtimes.

**Privacy.** Already covered in the privacy policy under "Diagnostic and crash reports — May be collected" — no policy update needed.

---

### Offsite DB backups

**Why.** Fly's volume snapshots are stored in the same region as the volume. A region-wide outage or accidental volume deletion would mean re-running every state's scraper from scratch (multi-day for some states; some PDF-extracted catch records would have to be re-extracted).

**Done when.**
- [ ] Cloudflare R2 or Backblaze B2 bucket created.
- [ ] Nightly script that runs on the Fly machine: `tar -cz /data/*.db | s3cmd put`.
- [ ] First successful backup verified by listing the bucket.
- [ ] Restore procedure documented in `lake-fish-mobile-server/README.md`.

**Cost.** ~$0.50/mo for ~1 GB of backups with R2/B2 free tier.

**Where.** New cron in `lake-fish-mobile-server/deploy/`; bucket credentials as Fly secrets.

**Owner.** Shared. You create the bucket; I script the cron.

---

### Auto-discover dev API host

**Why.** `src/api.ts:9` has `const DEV_API_BASE = 'http://192.168.1.8:3100'`. When your laptop's LAN IP changes (DHCP lease, different network), the dev build can no longer reach the local server and you have to edit this file. Expo exposes the Metro host to the app so this can be auto-derived.

**Done when.** `src/api.ts` derives `DEV_API_BASE` from `Constants.expoConfig?.hostUri` (or similar) so any LAN IP works without code edits.

**Where.** `~/lake-fish-mobile/src/api.ts:9`.

**Owner.** Me. Small change.

---

### In-app "Sources / About" page

**Why.** From the original audit (item #8 — content/IP review). Apple reviewers occasionally ask: "What's your relationship to these state agencies?" Having an in-app page that credits each one and explains the data is public-records-derived is the cleanest answer. Also the right thing to do.

**Done when.**
- [ ] New screen or modal in the mobile app: "About / Sources".
- [ ] Each of MN DNR, WI DNR, MI DNR, ND Game & Fish, SD GFP, NE Game & Parks, IA DNR is credited with a one-line description and an outbound link to the agency.
- [ ] One-line statement: "LakeLore is independent and not affiliated with or endorsed by any agency. All data is sourced from public records."
- [ ] Link to lakeloreapp.com and to the privacy policy.

**Where.** New file: `~/lake-fish-mobile/src/screens/AboutScreen.tsx` (or extend the existing Glossary modal).

**Owner.** Me.

---

## 🧹 Polish (post-launch is fine)

### Empty / error state polish

**Why.** From original audit item #13. If a state's DB isn't ready or filters fail, the species picker silently has nothing in it. A skeleton or retry UI would be more legible.

**Where.** `~/lake-fish-mobile/src/screens/SearchScreen.tsx` — the `if (s.ready)` branch.

**Owner.** Me.

---

### Replace `Alert.alert` validation with toast

**Why.** From original audit item #14. `Alert.alert('Search', 'Enter a species or lake name to search.')` at `SearchScreen.tsx:143` uses a heavy modal for what should be a passing toast.

**Where.** `~/lake-fish-mobile/src/screens/SearchScreen.tsx:143`.

**Owner.** Me. Probably uses a small custom Toast component (or `react-native-toast-message` if we want a dependency).

---

## ✅ Already shipped (this session, 2026-05-05)

For posterity / context:

- Bundle ID rebrand to **LakeLore** (`com.lakeloreapp.lakelore`); managed-workflow `ios/` cleanup
- Marketing site legal pages — `/privacy`, `/terms`, `/support` live on lakeloreapp.com
- API server in git: https://github.com/LakeLore/lake-fish-api
- Mobile app in git: https://github.com/LakeLore/lakelore-mobile
- Backend hardening — `trust proxy`, rate limit 600/15min, CORS allow-list, `/healthz`, `/reload` bearer token
- App icon, Android adaptive icon, splash icon — new SVG sources + rasterized PNGs, brand-cream backgrounds
- Apple Privacy Manifest under `app.json` `ios.privacyManifests`
- `ITSAppUsesNonExemptEncryption: false` to skip the per-build export-compliance prompt
- Play Store 1024×500 feature graphic
- Store listing copy in `STORE_LISTING.md`
- CLAUDE.md updated for 7 states, repo locations, deploy/ symlink layout

---

## How to update this file

When you finish an item, move it to "Already shipped" with the date. When new launch debt surfaces, add it to the right priority bucket. Keep the at-a-glance table in sync.
