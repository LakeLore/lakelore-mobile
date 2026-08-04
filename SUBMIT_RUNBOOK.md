# LakeLore Mobile — Submission Runbook

Keystroke-level sequence for shipping a new mobile release to the App Store and Google Play. Use this **on submission day**. Designed to be run top-to-bottom; don't skip steps.

> Day-to-day context lives in `~/lake-fish-mobile/CLAUDE.md`.
> Launch checklist (one-time blockers) lives in `./LAUNCH.md`.
> Vendor accounts, secret paths, gotchas: `~/APP_OPS.md`.
> Rollback / emergency procedures: `~/RUNBOOK.md`.
> Store-listing copy + screenshot shot list: `./STORE_LISTING.md`.

---

## 0. Pre-flight (the morning of)

**0.0 — Fix-verify review loop (MANDATORY, 2026-07-28).** Before cutting ANY
build: if there has been a multi-day change burst since the last reviewed
state (check `git log --since="<last review date>" --oneline | wc -l` across
mobile + server + lakelore-data — more than a handful of commits counts), run
the fix-verify loop per `~/APP_REVIEW_PLAYBOOK.md` §1b: adversarial review of
the accumulated diff → triage every finding (fix / defer-with-reason /
reject-with-reason) → review the fixes themselves → exit when nothing above
minor remains (cap 3 rounds). Rationale: per-change gates (tsc/tests/smoke)
all passed while the 07-25→27 wave carried 40 defects as a body, including a
data-loss bug and an unauthenticated OOM vector; the loop caught them, and
its round 2 caught 8 more in the fixes. Record the loop's outcome (date +
rounds + verdict) in the current improvement plan before proceeding. A build
cut without this step is an unreviewed build.

**0.0b — Serving-contract changes ship CLIENT-FIRST (MANDATORY, 2026-08-05).**
A *serving-contract change* is anything that alters what the API will answer
for an input an already-installed binary can still produce:

- flipping a state `active` in `~/lakelore-data/registry/states.json` (either direction)
- removing or renaming an endpoint
- changing a wire field list, an id format, or a status code
- changing the entitlement gate or preview projection

**Every installed binary is a client of that contract, and its state list /
route set is baked into its JS bundle.** Deploying the server first means every
older build is pointing at a contract that moved under it.

Before deploying such a change, enumerate the live runtimes and decide
reachability for EACH — not just the one you're testing:

```bash
# Which runtimes exist, and which can an OTA still reach?
npx eas branch:list                       # branch -> latest runtime
npx eas update:list --branch production --limit 40 | grep "Runtime Version" \
  | awk '{print $NF}' | sort | uniq -c    # runtimes actually served

# What is PUBLICLY live right now (not what's on TestFlight)?
curl -sS "https://itunes.apple.com/lookup?bundleId=com.lakeloreapp.lakelore&country=us" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['results'][0]['version'])"
```

`runtimeVersion.policy: appVersion` means **an OTA only reaches devices on that
exact app version.** A bundle published at 1.1.1 cannot fix a 1.0.0 install. For
each live runtime, pick one: ship a matching OTA, accept the breakage with a
recorded reason, or use `LAKELORE_MIN_APP_VERSION` (RUNBOOK §17) — and note that
the kill switch is useless until a newer public build exists to update *to*.

> **Why this rule exists — 2026-08-04/05.** The data-licensing legal holds
> flipped 11 states to `active:false` and the server was deployed first. Result:
> TestFlight build 24 still listed 50 states and showed "Server error (400)" on
> the 11 held ones (fixed same day by OTA `9e3281ae` on runtime 1.1.1). Worse,
> the publicly-live App Store build was **v1.0** shipping the original five-state
> cut `mn sd nd ia ne` — Nebraska is on hold, so public users got a broken state,
> and being on **runtime 1.0.0** they were unreachable by the 1.1.1 OTA. The
> legal objective was met; the sequencing turned a data decision into a
> user-facing regression that a two-minute reachability check would have caught.

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

# 4. Verify the MN floor claims still hold (description + review notes use
#    "9,400+/23,000+/396,000+" floor phrasing precisely so refreshes can't
#    invalidate them — this check only fails if data ever SHRINKS below a floor)
curl -s https://lake-fish-api.fly.dev/api/mn/status | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d['lakes']>=9400 and d['surveys']>=23000 and d['catches']>=396000, d
print('MN floors OK:', d)"
# 4b. Generated app config is current (doc-check also enforces this weekly)
git diff --quiet src/generated/states.ts || echo "WARN: states.ts uncommitted drift"
# 4c. Verify the paywall test state in the review notes serves (currently WI)
curl -s https://lake-fish-api.fly.dev/api/wi/status | python3 -m json.tool | head -3

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
   - **Notes for the App Reviewer** (paste from `STORE_LISTING.md` § "Apple Review notes" — that section is the ONLY source; if it is missing, STOP and restore it. A stale inline fallback here once said "four additional states" two eras after the all-states launch — never paste from memory.)
5. **App Privacy** (separate left-sidebar item): confirm answers match `STORE_LISTING.md` § "App Privacy questionnaire" — Identifiers ✅, Purchases ✅, Diagnostics ✅ (Crash + Performance + Other Diagnostic Data), **User Content ✅ (Customer Support — the feedback form)**, everything else ❌.
6. **Export Compliance**: already handled by `ITSAppUsesNonExemptEncryption: false` in `app.json`. No questions asked.
7. **Submit for Review.** Expected review time: 24–72 hours for first submission.

---

## 6. Submit to Play Store

**First submission only — App content checklist (2026-07-26; ALL of these gate the release and none were previously documented).** Play Console → Policy → App content:

- [ ] **Privacy policy URL**: `https://www.lakeloreapp.com/privacy` (Console field, separate from the in-app link).
- [ ] **App access**: "All functionality is available without any login or special access" + paste the test instructions from `STORE_LISTING.md` § "Google Play Test Instructions".
- [ ] **Ads**: No (the listing markets "No ads").
- [ ] **Content rating** questionnaire → Everyone.
- [ ] **Target audience**: 18+ only (never any group under 13 — that forces Designed-for-Families compliance).
- [ ] **News app**: No.
- [ ] **Data safety**: fill from `STORE_LISTING.md` § "Data Safety form" (FIVE type rows since 2026-07-26, incl. Messages + Device/other IDs) and SUBMIT the form, not just save a draft.
- [ ] **Government apps**: No. **Financial features**: No. **Advertising ID**: No (verify post-build: `bundletool dump manifest | grep -i ad_id` — if present, block it in app.json or flip the answer).
- [ ] **Store listing assets**: ≥2 Android phone screenshots (1080×1920+, captured on Android — `screenshots/android-phone/` is currently EMPTY), 512×512 32-bit RGBA icon (export from `assets/icon.png` — the 1024 source is RGB, Play's field requires alpha), feature graphic (exists, correct).

Also first-submission-only: the FIRST AAB must be uploaded through the Console UI (Internal testing → Create new release); `eas submit` works from the second upload onward. Then verify Billing Library ≥8 in the built AAB before the Aug 31 2026 deadline (`bundletool dump manifest`, or check the RevenueCat release notes for the pinned version).

Then, per release:

1. **Production** → Releases → Create new release.
2. Upload the AAB (or promote from Internal Testing if it's already up).
3. **Release notes**: paste `CHANGELOG.md` v1.X.Y store-release-notes block (swap "App Store account" → "Google Play account" in the SUBSCRIPTION line if pasting the description).
4. **Review release** → Save and review.
5. **Start rollout to Production.**

> ⚠️ **While any build is in review (either store): do NOT set `LAKELORE_MIN_APP_VERSION` or `LAKELORE_KILLED_VERSIONS`** on lake-fish-api — the kill screen would blank the app for the reviewer, and the store link can't offer the in-review version. Kill-list entries may target a single build as `1.1.1+24`.

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
- **Play Store rejects AAB / first submission fails**. Target-API-level is NOT the likely cause (Expo SDK 54 targets API 36). The real first-submission failure modes, in order: (1) the FIRST-EVER bundle must be uploaded manually via Play Console → Internal testing → Create release (the Play Developer API refuses an app with no prior release — `eas submit` works from the second upload on); (2) unfilled App content forms (see the checklist in §6); (3) missing Android phone screenshots; (4) versionCode collision — run `eas build:version:get -p android` and compare against App bundle explorer before building.
- **Users report a state erroring that "should" work, or an endpoint 404ing after a clean deploy**. Almost always a serving-contract change shipped ahead of its client (§0.0b). Diagnose by asking which app version they're on, then compare against the runtimes an OTA can actually reach (`npx eas branch:list`). A 1.1.1 OTA does nothing for a 1.0.0 install. Fix: publish an OTA at the *matching* runtime, or accept it until the next store release supersedes that build.
- **"App was rejected" email from Apple**. Read the Resolution Center notes carefully — most rejections are paywall-disclosure quibbles (the in-app paywall already covers length, price, auto-renew, terms, privacy per Apple's required list). If asked to clarify the relationship with state DNRs, point them at the in-app About / Sources screen and the explicit "Independence" callout.
