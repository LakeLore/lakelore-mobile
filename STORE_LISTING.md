# LakeLore — Store Listing Copy

This is the source of truth for every text field in App Store Connect and Google Play Console. Edit here, then paste into the corresponding field on each platform. Last updated 2026-07-26 (pre-submission red-team pass: Terms-of-Use metadata row, subscription block in the description, promo-text coverage fix, feedback-form privacy declarations, drift-proof MN counts, shot-list rewrite, corrected Play console field targets).

---

## Quick paste-in cheat sheet

| Field | Value | Limit |
|---|---|---|
| App name | `LakeLore` | 30 |
| Subtitle (iOS) / Short description (Android) | `Atlas of lakes worth fishing` | 30 / 80 |
| Promotional text (iOS only) | See below — updateable without re-review | 170 |
| Keywords (iOS) | `fishing,lake finder,fishing map,ice fishing,walleye,musky,bass,stocking,perch,crappie,dnr,lakes` | 100 |
| Description | See "Long description" below | 4000 |
| Support URL | `https://www.lakeloreapp.com/support` | — |
| Marketing URL | `https://www.lakeloreapp.com` | — |
| Privacy Policy URL | `https://www.lakeloreapp.com/privacy` | — |
| Terms of Use (EULA) URL | `https://www.lakeloreapp.com/terms` — **required for auto-renewable subs (3.1.2)**: put it in ASC → App Information → License Agreement (or keep Apple's standard EULA) AND it appears in the description's SUBSCRIPTION block | — |
| Copyright | `© 2026 LakeLore App LLC` ⚠️ owner-confirm the legal entity — the app/site footer says "LakeLore Co."; this field is a legal attestation and the two must match | — |
| Primary category (iOS) | `Sports` (secondary: `Reference`) | — |
| Primary category (Android) | `Sports` | — |
| Content rating | 4+ (iOS) / Everyone (Android) | — |

> **Support email:** `support@lakeloreapp.com` is the single contact published across the support page, privacy policy, and terms. Configure as an alias in Google Workspace.

---

## App name

```
LakeLore
```

(8 chars / 30. Same on iOS, Android, and macOS.)

## Subtitle (iOS) / Short description (Android)

Primary recommendation:

```
Atlas of lakes worth fishing
```

(28 chars. Benefit-led — implies "we tell you which lakes have fish".)

Alternates if you want to A/B:

- `Northern game fish atlas` (24 chars — pure positioning)
- `DNR netting & stocking atlas` (28 chars — explains the data source)
- `Walleye, pike, bass — by lake` (29 chars — species-led)

## Promotional text (iOS only — updateable any time)

```
Now covering 38 states and Manitoba. Free in Minnesota, no account, no ads — the netting and stocking atlas for game fish.
```

> **2026-08-04 legal-hold count change:** 11 states/provinces (AB BC ON SK AK HI KS KY MI NE VT) are now
> `active:false` per the data-licensing audit (`~/DATA_LICENSING_AUDIT_2026-07-28.md`; owner policy: any
> compliance violation holds the whole state). Counts everywhere went 45 US + 5 CA → **38 US + Manitoba (39)**.
> If states are un-held (permission letters / licence confirmations), update every count in this file +
> paywall + web layout/landing/terms in the same commit.

(134 chars. Use this for seasonal hooks: launch, ice-fishing, opener, fall walleye, etc. Corrected 2026-07-26 — the previous "all 50 states + Canada" was factually false (45 US states + 5 provinces are active; the internal "50" counts states AND provinces) and contradicted the description: Apple 2.3.1 territory.)

## Keywords (iOS, 100 chars max, comma-separated, no spaces between)

```
fishing,lake finder,fishing map,ice fishing,walleye,musky,bass,stocking,perch,crappie,dnr,lakes
```

(96 chars. Updated 2026-07-16 per IMPROVEMENT_PLAN P3.4: swapped low-volume/
low-intent terms — `muskellunge`→`musky`, dropped `survey` and single-state
names (the app is 39-jurisdiction now; per-state discovery comes from the site's
programmatic SEO pages instead) — for the high-volume generics `lake finder`,
`fishing map`, `ice fishing`, `bass`. Apple indexes name/subtitle/category, so
don't repeat those words.)

> **Stale-count audit.** Lake/survey/catch totals shown here are pasted into App Store / Play descriptions one time per submission. The description and review notes now use FLOOR phrasing ("9,400+ lakes") precisely so routine refreshes can't invalidate them (2026-07-26 — the exact figures drifted twice in one week); if you ever restore exact figures, re-fetch all three fields from `/api/mn/status` immediately before paste. The in-app paywall does NOT show per-state lake counts (deliberately removed 2026-05-27).

Variants to swap in if rankings shift:

- Trade `crappie` for `bass` (5→4 chars, frees up 1 char)
- Add `sunfish,bluegill` (frees up by dropping 2 from above)

Apple expands singulars to plurals automatically; don't waste chars on `walleyes`.

---

## Long description (paste in both iOS Description and Android Full description)

```
LakeLore is a field guide to fish populations in publicly surveyed lakes — built for anglers, conservationists, and anyone who wants to read a lake before they fish it.

Decades of state DNR netting surveys, electrofishing data, and stocking records, gathered into one quiet atlas. No accounts. No ads. Free.

WHAT YOU CAN DO

• Search every surveyed lake by species, county, gear type, lake size, year, and stocking density.
• Read each lake as a field-guide page: catch-per-unit-effort over decades, broken out by gear type.
• See the full stocking history — fry, fingerlings, yearlings, adults — with an estimated "adult fish per 100 acres" overlay derived from a survival model.
• Compare lakes side-by-side in a scatter plot: each dot is a lake-survey, colored by stocking density.
• Tap through to the original agency reports — MN DNR LakeFinder, SD GFP PDFs, ND Game & Fish ArcGIS, Texas Parks & Wildlife, Ontario Fish ON-Line, and dozens more.

DATA COVERED

• 38 US states and Manitoba, assembled from each fish and wildlife agency's published surveys, forecasts, and stocking records.
• Minnesota — free, no subscription: 9,400+ lakes, 23,000+ surveys, 396,000+ catch records (MN DNR).
• Every other state and province is included in the LakeLore All-States subscription — and browsable in preview before you subscribe.

SPECIES TRACKED

Walleye, northern pike, muskellunge, smallmouth and largemouth bass, lake trout, brown trout, rainbow trout, brook trout, yellow perch, black and white crappie, bluegill, pumpkinseed, rock bass, channel catfish, white bass, hybrid striped bass (wiper), and many more.

WHY IT EXISTS

State and provincial biologists pull nets, weigh fish, and publish the results — usually as PDFs or county-level spreadsheets buried several clicks into agency websites. LakeLore gathers all of it, normalizes the assessment methods across states and provinces, joins it to every stocking event on record, and renders it as one continuous picture of each lake.

WHAT IT IS NOT

LakeLore is informational only. It does not grant access to any water, replace any fishing regulation, or guarantee anything about the fish you'll catch. Always consult the relevant state agency for the authoritative current rules and licensing requirements.

SUBSCRIPTION

LakeLore All-States — US$4.99 per year, auto-renewing. Payment is charged to your App Store account at confirmation. The subscription renews automatically unless cancelled at least 24 hours before the end of the current period; manage or cancel in your device's subscription settings.
Terms of Use: https://www.lakeloreapp.com/terms
Privacy Policy: https://www.lakeloreapp.com/privacy

—

A field guide, quietly assembled. Free to use, free to share.
```

(About 2,600 chars. Both stores accept up to 4,000. The SUBSCRIPTION block satisfies Apple 3.1.2's metadata requirement — name, duration, price, auto-renew terms, and functional ToU + privacy links in the description; for Play, swap "App Store account" → "Google Play account" when pasting.)

---

## Apple-specific

### Categories

- Primary: **Sports**
- Secondary: **Reference**

### Age rating questionnaire (App Store Connect)

Answer "None" / "No" to every question. The app contains no:

- Cartoon, fantasy, or realistic violence
- Sexual content or nudity
- Profanity or crude humor
- Alcohol, tobacco, or drug references (the species "Bullhead" doesn't count)
- Mature/suggestive themes
- Horror/fear themes
- Medical/treatment information
- Gambling or contests
- Unrestricted web access
- User-generated content
- Personal information sharing

Result: rated **4+** (Apple's lowest, all ages).

### Export Compliance (uploaded with each build)

Add to `app.json` (already documented elsewhere in the file):

```json
"ios": {
  "infoPlist": {
    "ITSAppUsesNonExemptEncryption": false
  }
}
```

This auto-answers Apple's export compliance prompt with "uses standard encryption only (HTTPS via the system)" — true for LakeLore.

### App Privacy questionnaire (App Store Connect → "App Privacy")

FOUR categories must be declared (2026-07-26 red-team pass — the feedback form and Sentry's own bundled manifest each added one):

- Contact Info: ❌
- Health & Fitness: ❌
- Financial Info: ❌
- Location: ❌
- Sensitive Info: ❌
- Contacts: ❌
- **User Content: ✅ Customer Support** — Linked to user: ❌. Used for tracking: ❌. Purpose: **App Functionality**. *(The in-app "Report data issue" feedback form: free-text message + lake/species/version context, stored keyed to the anonymous UUID. Was falsely declared ❌ until 2026-07-26.)*
- Browsing History: ❌
- Search History: ❌ *(searches ride request URLs only; Sentry breadcrumbs strip query strings as of 1.1.1 — src/sentry.ts beforeBreadcrumb)*
- **Identifiers: ✅ User ID** — Linked to user: ❌. Used for tracking: ❌. Purpose: **App Functionality**.
- **Purchases: ✅ Purchase History** — Linked to user: ❌. Used for tracking: ❌. Purpose: **App Functionality**.
- Usage Data: ❌ *(no product analytics SDK; Sentry session/performance telemetry is declared under Diagnostics → Performance Data)*
- **Diagnostics: ✅ Crash Data, Performance Data, Other Diagnostic Data** — Linked to user: ❌. Used for tracking: ❌. Purpose: **App Functionality**. *(Sentry — its own bundled PrivacyInfo.xcprivacy declares OtherDiagnosticData, and Apple aggregates bundled manifests at upload, so the questionnaire must match; all three are in `app.json` `ios.privacyManifests`.)*
- Other Data: ❌

The User ID is the anonymous device-generated UUID we use to look up entitlement
state. Purchase History is the transaction ID + subscription state RevenueCat
returns; we never receive payment method. Crash/Performance/Other Diagnostic Data
are captured by Sentry for diagnostic purposes only. "Linked to user" is ❌
everywhere because the UUID is tied to no account, name, or email anywhere in the
system — written rationale in case of a post-approval audit.

If/when you turn on product analytics, return here and re-declare — that would
add Usage Data ✅ (Product Interaction, App Functionality), still unlinked /
non-tracking. The privacy policy already covers that category.

---

## Android / Google Play–specific

### Categories

- App category: **Sports**
- Tags: pick `Outdoor sports`, `Reference & Information` if available.

### Content rating questionnaire (Play Console → "Content Rating")

Same answers as Apple's age rating: zero objectionable content. Result: **Everyone**.

### Data Safety form (Play Console → "Data Safety")

**Must mirror the iOS App Privacy declarations above** — the app collects the same three categories on both platforms (rewritten 2026-07-17; the old "no data collected" answers predated the subscription + Sentry and would be a false declaration).

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes — collected, not shared** |
| Is all user data collected by your app encrypted in transit? | Yes (HTTPS only) |
| Do you provide a way for users to request that their data be deleted? | Yes — via the email contact in the privacy policy |

Declared data types (all: **collected**, NOT shared, NOT processed ephemerally, collection **required**, purpose **App functionality**):

| Play category → type | What it actually is |
|---|---|
| Personal info → **User IDs** | Anonymous device-generated UUID (`X-User-Id`) used for entitlement lookup. Not linked to a real identity. |
| Financial info → **Purchase history** | Subscription transaction state from RevenueCat/Google. Never the payment method. |
| App info and performance → **Crash logs** + **Diagnostics** | Sentry crash and performance reports. |
| Messages → **Other in-app messages** | The "Report data issue" feedback form: free-text message + lake/species/version context. Collected, not shared, **OPTIONAL** (user-initiated), purpose App functionality. *(Added 2026-07-26 — was falsely omitted.)* |
| Device or other IDs → **Device or other IDs** | Sentry's per-install installation ID (SDK-generated) + the RevenueCat anonymous app-user ID. Collected, not shared, required, App functionality. *(Added 2026-07-26.)* |

Everything else (location, contacts, photos, browsing, health, etc.): **not collected**. *(Messages moved OUT of this line 2026-07-26 — the feedback form is one.)*

### Government regulations

- COPPA (children under 13): app **is not** designed for or directed at children under 13. Don't enroll in Designed for Families.
- HIPAA: not applicable.
- Health Connect: not applicable.

---

## Screenshots — capture guide

### What you need

Each store wants screenshots at specific aspect ratios and pixel sizes. Required minimums:

| Store | Device class | Resolution |
|---|---|---|
| Apple — required | iPhone 6.9" (16/15/14 Pro Max) | 1320 × 2868 portrait |
| Apple — also OK | iPhone 6.5" (11 Pro Max / 14 Plus) | 1284 × 2778 portrait |
| Apple — required if `supportsTablet:true` | iPad 13" | 2064 × 2752 portrait |
| Google Play — required | Phone | 1080 × 1920 (or anything 320–3840 on each side, 16:9 or 9:16) |

> iPad screenshots are NOT needed: `app.json` has `"supportsTablet": false` (decided for v1 — see `~/APP_OPS.md` deferred items).

### Easiest path: iOS Simulator

```bash
cd ~/lake-fish-mobile
npx expo prebuild --clean       # one-time, regenerates ios/
npx expo run:ios -- --device "iPhone 16 Pro Max"
```

Once the app is running in the simulator:

1. **`Cmd+S`** in the simulator menu (or `Device → Save Screen`) saves a screenshot at the device's exact pixel size (1320×2868 for Pro Max — perfect for App Store). The PNG lands on your Desktop.
2. Repeat for each screen (see "shot list" below).
3. For 6.5", in the same way after running on `iPhone 14 Plus` or similar.
4. For iPad, run on `iPad Pro 13"`.

### Easiest path: real iPhone via Expo Go (if you don't want to build)

Real device screenshots also work — Expo Go renders the app screens identically. The native splash/icon won't appear (those need a build), but for the screenshots you only need the *app screens*, which look the same.

1. `npx expo start`, scan QR with Expo Go on your iPhone 16 Pro Max.
2. Capture each screen: side button + volume up.
3. AirDrop to Mac.

### Shot list (8 screenshots — 5 required, 3 optional)

Aim for editorial framing: include search results that *say something*. e.g. WAE results sorted by stocking density in MN, with a stripe of high-density lakes at the top.

*(Rewritten 2026-07-26 for the 1.1.1 UI — the old list described the pre-Measure, pre-map-selector app and a standalone glossary modal that no longer exists. Screenshots on disk are from May and MUST be recaptured on 1.1.1 before submission: Apple 2.3.3.)*

1. **State Select** — the pan/zoom US + Canada atlas map with the A-Z state list below.
2. **Search · List view** — Minnesota, Walleye, Measure = Abundance. Shows the brand on a results page.
3. **Search · Measure picker open** — the Abundance / Avg Size / Stocking Impact / Presence selector with gear/source options. The data model IS the product; show it.
4. **Search · Scatter view** — same query, switched to scatter. Visual variety + makes the data look rich.
5. **Lake Detail · CPUE chart** — pick a lake with several decades of survey data and multiple gears (e.g. Lake Mille Lacs in MN, or Lake Oahe in SD). The line chart sells the longitudinal-data angle.
6. **Lake Detail · Stocking history** — same or different lake, switched to the stocking tab, with the adults/100ac overlay visible. The single most distinctive feature.
7. **Paywall** — the All-States screen with price + value props. Reviewers of subscription apps look for it; users deserve to see the ask up front.
8. **County map picker** — shows the regional/local-knowledge angle. (Optional 9th: About & Sources with the glossary — now part of AboutScreen, reached from Search's "ⓘ About & Glossary".)

Adjust to taste. **Order matters** in the App Store — the first 1–2 are visible without swiping, so put the strongest screen first.

### Apple Review notes (paste into App Store Connect → App Review Information)

```
LakeLore is a free Minnesota fishing-lake reference. The optional LakeLore All-States annual subscription ($4.99/yr, auto-renewing) unlocks the other 37 US states and Manitoba currently active in the app (39 active states/provinces total). No account is required at any tier — identity is an anonymous device-generated UUID, no email, no sign-up.

To test core functionality without subscribing:
1. Launch the app.
2. Tap Minnesota on the state map (gold fill / "FREE" chip in the list below the map).
3. A county map opens automatically — tap "Done" to search statewide, or tap one or more counties first.
4. The full Minnesota dataset (9,400+ lakes, 23,000+ surveys, 396,000+ catch records, from MN DNR public records) is browsable: pick a species and a Measure (Abundance / Avg Size / Stocking Impact / Presence), filter by county, gear, year, etc., and tap any lake to see catch-rate-over-time and stocking-history charts.

To test the subscription / paywall flow:
1. Tap any non-Minnesota state (e.g. Wisconsin). It opens in PREVIEW: every metric and chart is visible, but lake names, counties, acreage, and coordinates are withheld (server-side) until subscribed. Tapping "Unlock" in the preview banner opens the paywall modal.
2. The paywall displays subscription title, length (1 year), price (auto-pulled from the store, currency-localized; static US$4.99/yr terms shown if the store is unreachable), auto-renewal terms, and links to Terms of Use + Privacy Policy as required by App Store Review guideline 3.1.2(a).
3. Use a sandbox Apple ID (App Store Connect → Users and Access → Sandbox) to complete a test purchase. After purchase, all paid states unlock.
4. "Restore purchases" is available both inside the paywall and on the About & Sources screen; store/network failures show a retry message, never a false "no subscription found".
5. "Manage subscription" (always visible on About & Sources) opens the native iOS subscription-management sheet via StoreKit.

Data sources: every state and provincial fish and wildlife agency is credited on the in-app "About & Sources" screen, accessible from the State Select screen via the "ⓘ ABOUT" badge. The app is independent and not affiliated with any agency; all data is sourced from public records published by each agency.

Privacy:
- Anonymous device UUID (X-User-Id header, plus X-App-Version/X-Update-Id version headers): collected for entitlement lookup and fleet version telemetry. Not linked to user identity. Not used for tracking. Declared in Privacy Manifest as NSPrivacyCollectedDataTypeUserID, purpose: App Functionality.
- Purchase History (RevenueCat transaction state): collected for entitlement enforcement. Not linked to identity. Not used for tracking. Purpose: App Functionality.
- Crash + Performance + Other Diagnostic Data (Sentry): collected for diagnostic purposes. Not linked to identity. Not used for tracking. Purpose: App Functionality. Network breadcrumbs are query-string-stripped client-side.
- Customer Support (in-app "Report data issue" form): optional, user-initiated free-text feedback with lake/species/app-version context, keyed to the anonymous UUID. Declared as NSPrivacyCollectedDataTypeCustomerSupport, purpose: App Functionality.

Privacy policy: https://www.lakeloreapp.com/privacy
Terms of use: https://www.lakeloreapp.com/terms
Support: https://www.lakeloreapp.com/support (publishes support@lakeloreapp.com)
```

(Update sandbox tester credentials if Apple asks; we provision them per-submission rather than committing them here.)

### Google Play Test Instructions (Play Console → **App content → App access**; duplicate into the release's reviewer notes)

*(Field corrected 2026-07-26 — the old target, "Target audience and content", is the children/age questionnaire; instructions pasted there are never seen by the reviewer.)*

```
All functionality is available without any login or special access. LakeLore is a free Minnesota fishing-lake reference. Optional LakeLore All-States annual subscription ($4.99/yr, auto-renewing) unlocks the other 37 US states and Manitoba active in the app; those states open in PREVIEW without subscribing.

To test:
1. Open the app — Minnesota is free, no sign-in required.
2. Tap Minnesota on the map. A county map opens automatically — tap "Done" to search statewide.
3. Search any species (e.g. Walleye); tap any lake to see charts.
4. To test the paywall: tap a non-Minnesota state. It opens in PREVIEW — all metrics and charts are visible but lake names/locations are withheld until subscribed. Tap "Unlock" in the preview banner to open the paywall (auto-renew terms + Terms / Privacy links shown). Use a license-tester Google account (Play Console → Setup → License testing) for test purchases at $0.
5. "Restore purchases" and "Manage subscription" are both on the About & Sources screen (ⓘ ABOUT badge on the state map, or "About & Glossary" from Search).

No account / login required. Anonymous device UUID identity. The app collects no contact info and no location — only an anonymous identifier (entitlement lookup), purchase state (subscription enforcement), crash/performance data (Sentry, diagnostic), and optional user-initiated feedback messages ("Report data issue" form).

Privacy policy: https://www.lakeloreapp.com/privacy
Support: support@lakeloreapp.com
```

### Optional polish: marketing overlays

Apple and Google both allow marketing-style screenshots with overlay text and device frames. They're not required but they convert better. Tools:

- [Screenshot Designer](https://www.appscreens.com) — paid, fast
- [Figma](https://www.figma.com) — free, manual
- [Fastlane snapshot + framer](https://docs.fastlane.tools/getting-started/ios/screenshots/) — automated

Suggested overlay headlines, in the brand voice:

1. **State select:** "Read the lake. Find the fish."
2. **Search list:** "Decades of surveys. One field guide."
3. **Scatter:** "Every dot is a lake-survey."
4. **Filters:** "Tighten the net by species, gear, year, county."
5. **Lake CPUE:** "How a population moves over time."
6. **Stocking history:** "What was stocked. What survived."
7. **County map:** "Regional, by the watershed."
8. **Glossary:** "Every metric, defined."
