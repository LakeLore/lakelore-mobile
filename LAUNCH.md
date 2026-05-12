# LakeLore — Launch Checklist

The single source of truth for what's left before LakeLore ships to the App Store and Google Play. Maintained alongside the codebase.

For listing copy, screenshot capture, and store-form answers, see [STORE_LISTING.md](./STORE_LISTING.md). This file tracks the *infrastructure and code* work that surrounds those.

Last reviewed: 2026-05-08.

## Monetization model (locked in 2026-05-07)

- **Free tier:** Minnesota only. Full access to all 9,477 MN lakes, all features.
- **Paid tier — "LakeLore All-States":** Unlocks the other six states (WI, MI, ND, SD, NE, IA).
- **Price:** $5.99 / year, auto-renewing.
- **Free trial:** None.
- **Provider:** RevenueCat (cross-platform abstraction over Apple StoreKit + Google Play Billing).
- **User identity:** Anonymous device UUID (no account, no email). Cross-device restore via per-platform store account ("Restore Purchases" button).
- **State Select UX:** All 7 states visible with lake counts. MN is free to enter; the other six show a small lock indicator and tapping opens the paywall instead of entering the state.

---

## At a glance

| | Item | Owner | Status |
|---|---|---|---|
| ✅ | Apple Developer Program enrollment | you | Approved 2026-05-07 |
| ✅ | Google Play Console enrollment | you | Approved 2026-05-08 |
| ✅ | Expo / EAS account | you | `eas login` done; project linked at `@ndrwtp/lakelore` |
| ✅ | EAS Build setup | shared | iOS dev build live; Android preview build in progress 2026-05-08 |
| 🛑 | [Capture screenshots](#capture-screenshots) | you | iOS dev client installed; capture session pending |
| ✅ | `support@lakeloreapp.com` Google Workspace alias | you | Live |
| ✅ | iPad decision: `supportsTablet` | you | Set to `false` for v1 (iPhone-only); iPad considered for v1.x |
| ✅ | RevenueCat account + iOS + Android apps linked | you | Real `appl_` and `goog_` keys in code |
| ✅ | App Store Connect: iOS subscription product | you | `com.lakeloreapp.lakelore.allstates_annual` created, $5.99 USD, Ready to Submit (submits with binary) |
| ✅ | Play Console: Android subscription product | you | `lakelore_allstates_annual` (base plan `annual`) created and Active, $5.99 USD |
| ✅ | RevenueCat entitlement + offering wired | shared | Both products attached to `LakeLore All-States` entitlement and to `$rc_annual` package in `default` (Current) offering |
| ✅ | Server entitlement gating | me | Live in production with v2 RC API; real entitlement lookups verified |
| ✅ | Mobile RevenueCat SDK + paywall UX | me | All UX shipped; both platform keys real |
| ✅ | Privacy + Terms updates for subscriptions | me | Live on lakeloreapp.com (effective 2026-05-07) |
| ✅ | Sentry crash + error monitoring | shared | Live · mobile + server wired |
| ⚠️ | [Offsite DB backups](#offsite-db-backups) | shared | 30 min |
| ✅ | Auto-discover dev API host | me | Shipped (commit `e250df4`) |
| ✅ | In-app "Sources / About" page | me | Shipped (commit `f0f8362`) |
| ✅ | Empty / error state polish | me | Shipped — see commit below |
| ✅ | Replace `Alert.alert` validation with toast | me | Shipped (commit `aa24543`) |

🛑 = blocker · 💳 = paywall track · ⚠️ = strongly recommended pre-launch · 🧹 = polish, post-launch fine

## Remaining blockers, in order

1. **Sandbox-test a purchase** end-to-end on at least one platform before submission:
   - **iOS**: App Store Connect → Users and Access → Sandbox Testers → create a sandbox Apple ID. TestFlight build, sign out of real Apple ID on simulator/device, sign in with sandbox account, tap a non-MN state → paywall → Subscribe.
   - **Android**: Play Console → Setup → License testing → add yourself as a tester. Internal Testing track build, install on a real device, tap a non-MN state → paywall → Subscribe.
2. **Capture screenshots** — iPhone 6.9" / 6.5" required for App Store (1320×2868 / 1284×2778), Android phone (1080×1920 or larger 9:16) for Play. With `supportsTablet:false`, no iPad screenshots required. See STORE_LISTING.md for shot list.
3. **Submit to App Store and Play Store.**

Items 1 and 2 can be done in any order. Item 3 is the final step; the iOS subscription product gets submitted to App Review alongside the binary in a single submission.

## Known minor open items (not blocking)

- **Sentry source map upload disabled** in `eas.json` (`SENTRY_DISABLE_AUTO_UPLOAD: true`). Production stack traces won't be deobfuscated until you generate a Sentry auth token, set it as an EAS env var, and re-enable upload. Crashes still get reported, just with minified line numbers.
- **RC dashboard "Credentials need attention" warning** on the Play Store credential block. Cosmetic — verified directly against Google's API that all permissions are correct and Google accepts the credentials. Worth filing as an RC support ticket.
- **Offsite DB backups** (the only remaining ⚠️ item) — needs a Cloudflare R2 / Backblaze B2 account first.

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
- [x] `eas.json` exists with `development`, `preview`, and `production` profiles.
- [ ] `eas init` run (writes `extra.eas.projectId` to `app.json`).
- [x] `auto-increment` enabled in eas.json so Apple doesn't reject a build for reusing `CFBundleVersion`.
- [ ] `submit.production.ios.ascAppId` and `appleTeamId` filled in (currently `TBD-...` placeholders) — needed only for `eas submit`, not for `eas build`.
- [ ] `npm run build:dev:ios` succeeds and produces a simulator-installable dev client.
- [ ] `npm run build:preview:ios` succeeds and produces a TestFlight-installable build.
- [ ] `npm run build:preview:android` succeeds and produces an internal-testing-installable APK.

**Where.** `~/lake-fish-mobile/eas.json`. Build commands wired into `package.json` scripts.

**Owner.** Shared. Config is in. You handle the interactive bits below.

**Your steps to take it the rest of the way:**

```bash
# 1. Install EAS CLI (one-time, global)
npm install -g eas-cli

# 2. Log in (interactive — opens browser)
eas login

# 3. Initialize the project — writes projectId into app.json
cd ~/lake-fish-mobile
eas init

# 4. First build — make a dev client for simulator
npm run build:dev:ios

# 5. Once it's built (~10–15 min), install in simulator and connect:
npm start
# Press 'i' to launch the simulator + your dev build
```

After the first dev build succeeds, RC's "SDK detected" check will go green
the first time you launch the app — that'll satisfy the wizard step you skipped.

**Filling in the submit placeholders** (only needed when you run `eas submit`, not for `eas build`):

- `appleTeamId` → developer.apple.com/account → Membership → Team ID (10-character string).
- `ascAppId` → App Store Connect → My Apps → LakeLore → App Information → "Apple ID" (numeric, ~10 digits).
- `serviceAccountKeyPath` → after Google bank verification, the JSON file you'll download for RC.

Edit `eas.json` directly to swap them in.

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

---

## 🛑💳 Paywall track

All six items below ship together. Apple won't approve a binary that references a subscription product that doesn't exist in App Store Connect, and the subscription product needs the binary to be reviewable. We schedule the user-side work and code work in parallel, then submit both at the same time.

### RevenueCat account + API keys

**Why.** RevenueCat sits between Apple/Google billing and your app: it abstracts cross-platform purchase APIs, handles receipt validation, and exposes a single REST API + webhook that your server checks for entitlement. Free up to $2.5K monthly tracked revenue (~5,000 subscribers at $5.99/yr) — well within the free tier for v1.

**Done when.**
- [ ] RevenueCat account created at https://app.revenuecat.com.
- [ ] LakeLore project created.
- [ ] Apple App Store and Google Play apps linked (needs the bundle ID `com.lakeloreapp.lakelore` and a P8 key from App Store Connect / a service account JSON from Play Console).
- [ ] **Public SDK keys** captured (one for iOS, one for Android — these go in `app.json` `extra.revenueCat`).
- [ ] **Secret API key** captured (server-side, used to query entitlement state — goes in Fly secrets).
- [ ] **Webhook signing secret** captured (server-side, used to verify webhook calls from RC — goes in Fly secrets).

**Owner.** You. I'll provide a step-by-step walkthrough when you start; the dashboard is reasonably guided.

---

### App Store Connect: Paid Apps agreement + subscription product

**Why.** Apple requires a separate "Paid Applications" agreement (with banking and tax info) before you can sell anything. Then the subscription product itself has to be created in App Store Connect, reviewed, and approved alongside the binary.

**Done when.**
- [ ] Paid Apps agreement signed; banking + tax (W-9) submitted under Agreements, Tax, and Banking.
- [ ] Subscription Group created: "LakeLore Atlas Pass" (one group can hold future tiers).
- [ ] Subscription product created within the group:
  - Product ID: `com.lakeloreapp.lakelore.allstates_annual`
  - Reference name: `LakeLore All-States · Annual`
  - Display name: `LakeLore All-States`
  - Duration: 1 year
  - Price tier: USD $5.99 (Apple's per-region matrix takes care of foreign pricing)
  - Free trial: none
  - Localized description: "Unlocks every state outside of Minnesota — Wisconsin, Michigan, North Dakota, South Dakota, Nebraska, and Iowa. Annual subscription, auto-renews."
- [ ] Subscription submitted for review with the first build that references it.

**Owner.** You. I'll provide the exact form values when you start the form.

**Watch out for.** Apple requires *before-purchase disclosure* in the app: title, length, price, auto-renew terms, link to terms, link to privacy policy. Missing any of these is the most common subscription rejection. I'll bake them into the paywall screen so they're correct by construction.

---

### Play Console: subscription product

**Why.** Same idea on Google's side — the subscription product must exist in Play Console before the app can purchase against it.

**Done when.**
- [ ] Merchant account set up (Play Console → Setup → Payments).
- [ ] Subscription created under Monetize → Products → Subscriptions:
  - Product ID: `lakelore_allstates_annual` (Google requires lowercase + underscores; can't share Apple's reverse-DNS form)
  - Name: `LakeLore All-States`
  - Description: same as Apple's
  - Base plan: 1 year, USD $5.99, auto-renewing
  - Free trial: none

**Owner.** You.

---

### Server entitlement gating

**Why.** Pure client-side gating gets bypassed by anyone who proxies the API. The server has to be the source of truth for "is this user paid?"

**Done when.**
- [ ] Express middleware reads `X-User-Id: <uuid>` from incoming requests; assigns one if missing.
- [ ] `/api/me/entitlement` endpoint returns `{ allStates: boolean, expiresAt: string|null, source: 'revenuecat'|'cache' }`. Implementation: server caches entitlement per UUID in memory for ~5 min, falls through to RevenueCat REST API on miss, and updates from webhook events when RC pushes them.
- [ ] State allow-list check: requests for any state other than `mn` require `allStates === true` (else 402 Payment Required with `{ error: 'subscription_required', state }`).
- [ ] Webhook handler at `POST /webhooks/revenuecat` verifies the signing secret, updates the entitlement cache.
- [ ] `/api/mn/*` endpoints unchanged (free tier).
- [ ] No regressions in existing endpoint behavior for unauthenticated callers (mobile app + marketing site continue to work for MN).

**Where.** `~/lake-fish-mobile-server/server.js`. Likely a new module `entitlement.js` for the cache + RC client.

**Owner.** Me.

**Notes.** I'll wire the code with `process.env.REVENUECAT_SECRET_KEY` and `REVENUECAT_WEBHOOK_SECRET` so the user just sets the Fly secrets when they have keys. Server can be merged before the keys exist (will refuse to gate without them, fail-closed).

---

### Mobile RevenueCat SDK + paywall UX

**Why.** The actual purchase flow lives on the device. RC's SDK abstracts the platform-specific bits.

**Done when.**
- [ ] `react-native-purchases` installed; iOS and Android SDK keys plumbed via `app.json` `extra.revenueCat`.
- [ ] Anonymous user UUID generated on first launch, stored in AsyncStorage (`lakeloreUserId`), passed as `X-User-Id` on every API request.
- [ ] RevenueCat configured at app start with that UUID as App User ID.
- [ ] State Select screen modified:
  - All seven cards visible with lake counts (no change).
  - Cards for non-MN states show a small "🔒 ALL-STATES" eyebrow chip in walleye-gold.
  - Tapping a non-MN state opens the paywall modal instead of entering the state.
  - MN unchanged — tap → enter.
- [ ] Paywall modal:
  - Headline ("Unlock the rest of the atlas"), value props (six states, all features), price ($5.99/yr, auto-renewing).
  - Pre-purchase disclosure block (title, length, auto-renew terms, links to terms + privacy).
  - "Subscribe" button → triggers RC purchase flow → updates entitlement → dismisses modal.
  - "Restore Purchases" button → triggers RC restore → updates entitlement.
  - "Manage Subscription" link (visible after purchase) → opens platform subscription settings.
- [ ] After successful purchase, the entitlement state propagates so the previously-blocked state can be entered.
- [ ] In-flight purchase state is robust: if RC takes a few seconds, the button shows a spinner; if the user backgrounds and returns, state is correct.
- [ ] Offline behavior: cached entitlement allows continued access for at least 24 hours of offline use (RC handles this by default).

**Where.**
- New: `src/screens/PaywallScreen.tsx`
- Modified: `src/screens/StateSelectScreen.tsx`, `src/screens/SearchScreen.tsx` (state-picker modal also needs the lock affordance), `src/api.ts` (new `X-User-Id` header), `App.tsx` (RC init).

**Owner.** Me.

---

### Privacy + Terms updates for subscriptions

**Why.** When the paywall ships, the app collects two new categories: an anonymous user identifier (UUID) and purchase data (transaction ID, subscription state). The privacy policy already has a "May be collected" hook for these but should be promoted to "Currently collected" once the paywall actually goes live. The terms need a Subscriptions section with auto-renew, refund, and cancellation language.

**Done when.**
- [ ] `web/app/privacy/page.tsx` updated:
  - "Anonymous user identifier" — currently collected (replaces or complements the existing analytics-section device-ID language).
  - "Purchase data" — currently collected when a user subscribes.
  - Service providers section adds RevenueCat + Apple/Google billing.
- [ ] `web/app/terms/page.tsx` updated:
  - New "Subscriptions" section: name, price, length, auto-renew terms, free-trial language (none), cancellation method, refund policy (handled by Apple/Google).
  - Acknowledgment that billing is by Apple/Google and subject to their refund policies.
- [ ] Effective date bumped on both pages.
- [ ] STORE_LISTING.md "App Privacy questionnaire" answers updated:
  - Identifiers: ✅ User ID (App Functionality) — not linked to identity, not used for tracking.
  - Purchases: ✅ Purchase History (App Functionality) — not linked to identity, not used for tracking.

**Where.** `~/web/app/privacy/page.tsx`, `~/web/app/terms/page.tsx`, `~/lake-fish-mobile/STORE_LISTING.md`.

**Owner.** Me. Drafted now, deployed when paywall ships.

---



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
