# LakeLore Mobile — Submission Runbook

Keystroke-level sequence for shipping a new mobile release to the App Store and Google Play. Use this **on submission day**. Designed to be run top-to-bottom; don't skip steps.

> Day-to-day context lives in `~/lake-fish-mobile/CLAUDE.md`.
> Launch checklist (one-time blockers) lives in `./LAUNCH.md`.
> Vendor accounts, secret paths, gotchas: `~/APP_OPS.md`.
> Rollback / emergency procedures: `~/RUNBOOK.md`.
> Store-listing copy + screenshot shot list: `./STORE_LISTING.md`.

---

## 0. Pre-flight (the morning of)

Run these checks before touching any build commands.

```bash
cd ~/lake-fish-mobile

# 1. Confirm you're on main and clean
git status
git log --oneline -5

# 2. Confirm tsc passes
./node_modules/.bin/tsc -p tsconfig.json --noEmit

# 3. Confirm prod API is healthy
curl -s --max-time 8 https://lake-fish-api.fly.dev/healthz
curl -s https://lake-fish-api.fly.dev/api/mn/status | python3 -m json.tool

# 4. Refresh lake counts in store description (NE drifts the most)
for s in mn sd nd ia ne; do
  echo -n "$s: "
  curl -s https://lake-fish-api.fly.dev/api/$s/status \
    | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('lakes'))"
done
# Compare against STORE_LISTING.md "DATA COVERED" list. Update if any drifted.

# 5. Confirm marketing-site legal pages are live and canonical
for u in / /privacy /terms /support; do
  echo -n "https://www.lakeloreapp.com$u → "
  curl -s -o /dev/null -w "%{http_code}\n" https://www.lakeloreapp.com$u
done
# All four should return 200.

# 6. Confirm `support@lakeloreapp.com` receives mail.
#    Send a test email from a different account; verify arrival.
```

If anything fails, fix it before bumping the version.

---

## 1. Bump the version

```bash
cd ~/lake-fish-mobile
# Edit app.json — increment expo.version. Patch for fixes, minor for new
# features. The build number auto-increments in EAS (`autoIncrement: true`).
```

`expo.version` is what users see. It's also what `runtimeVersion.policy: "appVersion"` uses for OTA segmentation — bumping it starts a fresh OTA channel and orphans existing installs from future OTA updates until they pick up the new native build.

```bash
# Verify
node -e "console.log(require('./app.json').expo.version)"

# Commit the bump
git add app.json CHANGELOG.md
git commit -m "Release v1.X.Y"
```

Add the matching entry in `CHANGELOG.md` with the store release-notes copy.

---

## 2. Build the production binaries

### iOS

```bash
cd ~/lake-fish-mobile
npm run build:prod:ios
```

EAS queue: ~5 min, build: ~10 min. Watch at https://expo.dev/accounts/ndrwtp/projects/lakelore/builds.

If it fails on a Sentry source-map upload error, that's the long-standing issue tracked in `~/APP_OPS.md` "Open items deferred" #1. Production profile has `SENTRY_ALLOW_FAILURE: true` so the build should still succeed.

### Android

```bash
npm run build:prod:android
```

Same queue and timing. Produces an AAB (not an APK — Play Store rejects APKs).

You can run these in parallel; EAS queues both.

---

## 3. Test the iOS build via TestFlight before submitting

```bash
npm run submit:ios
```

This uploads the latest production EAS build to App Store Connect. ASC processing: 5–25 min after EAS finishes.

When the build shows up in TestFlight on your iPhone:

1. Cold-launch the app. Confirm the new version number appears in About.
2. Run the **paywall sandbox test** (per LAUNCH.md "Remaining blockers" #1):
   - Sign out of your real Apple ID in iPhone Settings → Media & Purchases.
   - Sign into a sandbox Apple ID (App Store Connect → Users and Access → Sandbox).
   - Open LakeLore, tap a non-MN state, tap Subscribe, complete the sandbox purchase.
   - Confirm the previously-locked state unlocks.
3. Tap "Restore purchases" in About. Confirm it reports success.
4. Run smoke tests:
   - Search a species in MN → expect results.
   - Open a lake → expect CPUE + stocking charts.
   - Toggle Latest Only → expect re-search.
   - Open County map picker → pan, pinch, select 2 counties → Done → expect filtered results.
   - Tap each external "↗" link on Lake Detail → expect Safari to open the agency page.
   - Toggle airplane mode → expect "OFFLINE — RECONNECT TO LOAD MORE" banner.
5. Check Sentry: https://sentry.io/organizations/lakelore-app-llc/issues/?project=react-native — no new crashes in the last hour.

If anything fails, fix and re-build before submitting to App Review.

---

## 4. Test the Android build before submitting

The Android `submit.production.android.releaseStatus` is `draft` (per `eas.json`), so the AAB lands as a draft in Internal Testing. You need to publish it manually.

```bash
npm run submit:android
```

Then in Play Console:

1. Internal Testing → Releases → click into the draft → review → Save → Review release → Start rollout.
2. Wait ~5 min for Play to process.
3. On your test Android device (added as a license tester in Play Console → Setup → License testing), install the build.
4. Run the same smoke tests as iOS plus:
   - Confirm Android edge-to-edge looks right (status bar transparent, OfflineBanner padding clears the inset).
   - Confirm subscription flow opens the Play purchase sheet (use a license tester account so charges are $0).
   - Confirm "Manage subscription" deep-links to the Play subscriptions page for LakeLore.

---

## 5. Submit to App Review (iOS)

App Store Connect → My Apps → LakeLore → App Store tab.

1. **Version Information** section: confirm "What's New in This Version" matches `CHANGELOG.md` v1.X.Y store-release-notes block.
2. **Build** section: select the build that came in from `eas submit`.
3. **In-App Purchases and Subscriptions**: confirm `com.lakeloreapp.lakelore.allstates_annual` is attached to this build (first submission only — gets approved alongside the binary on v1.0).
4. **App Review Information** (left sidebar):
   - Sign-in required: No (anonymous device UUID identity).
   - Demo account: Not applicable.
   - **Notes for the App Reviewer** (paste from `STORE_LISTING.md` § "Apple Review notes" if present, otherwise: "LakeLore is a free Minnesota fishing-lake reference with an optional LakeLore All-States annual subscription that unlocks four additional states (ND, SD, NE, IA). No account required — identity is an anonymous on-device UUID. To test the paywall, please use a sandbox Apple ID (App Store Connect → Users and Access → Sandbox). To test core functionality without subscribing, tap Minnesota on the first screen.").
5. **App Privacy** (separate left-sidebar item): confirm answers match `STORE_LISTING.md` § "App Privacy questionnaire" — Identifiers ✅, Purchases ✅, Diagnostics ✅, everything else ❌.
6. **Export Compliance**: already handled by `ITSAppUsesNonExemptEncryption: false` in `app.json`. No questions asked.
7. **Submit for Review.** Expected review time: 24–72 hours for first submission.

---

## 6. Submit to Play Store

Play Console:

1. **Production** → Releases → Create new release.
2. Upload the AAB (or promote from Internal Testing if it's already up).
3. **Release notes**: paste `CHANGELOG.md` v1.X.Y store-release-notes block.
4. **Review release** → Save and review.
5. **Start rollout to Production.**

Expected review time: a few hours for routine submissions, up to 7 days for first submission and policy-flagged updates.

---

## 7. Post-submit watch

For the first 72 hours after release, follow `~/lake-fish-mobile/POST_LAUNCH_WATCH.md` — Sentry thresholds, store-review monitoring, rollback triggers.

If you spot a critical bug after Apple approval but before Google approval, hold the Google release at Internal Testing and ship a fixed iOS build first. If Google has already rolled out, follow the OTA rollback recipe in `~/RUNBOOK.md` §12.

---

## 8. After both stores are live

```bash
cd ~/lake-fish-mobile
git tag v1.X.Y
git push origin main --tags
```

Update `LAUNCH.md` "Already shipped" list with the release date and version number. Mark this run's open items closed.

---

## Common failure modes

- **EAS build fails on Sentry upload**. `SENTRY_ALLOW_FAILURE: true` in eas.json should let it pass. If it doesn't, see `~/APP_OPS.md` "Open items deferred" #1.
- **TestFlight build doesn't show up after `submit:ios`**. ASC processing varies 5–25 min. If >2 hours, log into ASC and check Activity tab for upload errors.
- **Sandbox purchase says "Cannot connect to iTunes Store"**. You're signed into a real Apple ID. Sign out in Settings → Media & Purchases, leave it signed out, attempt purchase; sandbox prompt should appear.
- **Play Store rejects AAB**. Most common cause is missing target-API-level. EAS handles this; if it recurs, run `eas build:inspect` on the failed build.
- **"App was rejected" email from Apple**. Read the Resolution Center notes carefully — most rejections are paywall-disclosure quibbles (the in-app paywall already covers length, price, auto-renew, terms, privacy per Apple's required list). If asked to clarify the relationship with state DNRs, point them at the in-app About / Sources screen and the explicit "Independence" callout.
