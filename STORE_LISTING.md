# LakeLore — Store Listing Copy

This is the source of truth for every text field in App Store Connect and Google Play Console. Edit here, then paste into the corresponding field on each platform. Last updated 2026-05-05.

---

## Quick paste-in cheat sheet

| Field | Value | Limit |
|---|---|---|
| App name | `LakeLore` | 30 |
| Subtitle (iOS) / Short description (Android) | `Atlas of lakes worth fishing` | 30 / 80 |
| Promotional text (iOS only) | See below — updateable without re-review | 170 |
| Keywords (iOS) | `fishing,walleye,muskellunge,stocking,survey,dnr,perch,crappie,minnesota,wisconsin,michigan,iowa` | 100 |
| Description | See "Long description" below | 4000 |
| Support URL | `https://www.lakeloreapp.com/support` | — |
| Marketing URL | `https://www.lakeloreapp.com` | — |
| Privacy Policy URL | `https://www.lakeloreapp.com/privacy` | — |
| Copyright | `© 2026 LakeLore App LLC` | — |
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
Now in five states: MN, ND, SD, NE, IA. Free, no account, no ads — the netting and stocking atlas for northern game fish.
```

(125 chars. Use this for seasonal hooks: launch, ice-fishing, opener, fall walleye, etc.)

## Keywords (iOS, 100 chars max, comma-separated, no spaces between)

```
fishing,walleye,muskellunge,stocking,survey,dnr,perch,crappie,minnesota,iowa,nebraska,dakota
```

(91 chars. Apple already indexes the app name, subtitle, and category, so don't repeat words from those. WI + MI keywords removed for v1 — those states are inactive.)

> **Stale-count audit.** Lake totals shown here are pasted into App Store / Play descriptions one time per submission. Re-fetch from `/api/{state}/status` immediately before paste so the description matches live data. The in-app paywall does NOT show per-state lake counts (deliberately removed 2026-05-27 — counts felt cluttered and drift-prone for a CTA screen), so only this file needs the manual refresh.

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
• Tap through to the original agency reports — SD GFP PDFs, MN DNR LakeFinder, Iowa DNR Lake Page, ND Game & Fish ArcGIS, Nebraska survey PDFs, and more.

DATA COVERED

• Minnesota — 9,490 lakes, 23,618 surveys, 396,371 catch records (MN DNR)
• Iowa — 1,258 lakes (Iowa DNR)
• Nebraska — 480 lakes (Nebraska Game & Parks)
• North Dakota — 452 lakes (ND Game & Fish)
• South Dakota — 327 lakes (SD Game, Fish & Parks)

SPECIES TRACKED

Walleye, northern pike, muskellunge, smallmouth and largemouth bass, lake trout, brown trout, rainbow trout, brook trout, yellow perch, black and white crappie, bluegill, pumpkinseed, rock bass, channel catfish, white bass, hybrid striped bass (wiper), and many more.

WHY IT EXISTS

State biologists pull nets, weigh fish, and publish the results — usually as PDFs or county-level spreadsheets buried several clicks into agency websites. LakeLore gathers all of it, normalizes the assessment methods across states, joins it to every stocking event on record, and renders it as one continuous picture of each lake.

WHAT IT IS NOT

LakeLore is informational only. It does not grant access to any water, replace any fishing regulation, or guarantee anything about the fish you'll catch. Always consult the relevant state agency for the authoritative current rules and licensing requirements.

—

A field guide, quietly assembled. Free to use, free to share.
```

(About 2,100 chars. Both stores accept up to 4,000.)

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

With the LakeLore All-States subscription enabled, two categories must be declared:

- Contact Info: ❌
- Health & Fitness: ❌
- Financial Info: ❌
- Location: ❌
- Sensitive Info: ❌
- Contacts: ❌
- User Content: ❌
- Browsing History: ❌
- Search History: ❌
- **Identifiers: ✅ User ID** — Linked to user: ❌. Used for tracking: ❌. Purpose: **App Functionality**.
- **Purchases: ✅ Purchase History** — Linked to user: ❌. Used for tracking: ❌. Purpose: **App Functionality**.
- Usage Data: ❌ *(server logs are 30-day rate-limit data, not user analytics — see privacy policy)*
- **Diagnostics: ✅ Crash Data, Performance Data** — Linked to user: ❌. Used for tracking: ❌. Purpose: **App Functionality**. *(Sentry — diagnostic crash and performance reporting; declared in `app.json` `ios.privacyManifests.NSPrivacyCollectedDataTypes`.)*
- Other Data: ❌

The User ID is the anonymous device-generated UUID we use to look up entitlement
state. Purchase History is the transaction ID + subscription state RevenueCat
returns; we never receive payment method. Crash Data and Performance Data are
captured by Sentry for diagnostic purposes only — neither is linked to a user
profile, neither is used for tracking.

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

For each section, the answer is **"No data collected or shared"** as of today.

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | No |
| Is all user data collected by your app encrypted in transit? | Yes (HTTPS only) — answer this even though we say "no data collected" since the API itself runs over HTTPS |
| Do you provide a way for users to request that their data be deleted? | Yes — via the email contact in the privacy policy |

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

> If you don't want to deal with iPad screenshots, set `"supportsTablet": false` in `app.json` first. We currently have it `true`. Decide before you submit.

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

1. **State Select** — the opening screen, "Lakes by State" with five state cards.
2. **Search · List view** — Minnesota, Walleye, sorted by CPUE. Shows the brand on a results page.
3. **Search · Scatter view** — same query, switched to scatter. Visual variety + makes the data look rich.
4. **Search · Filters open** — Advanced Filters modal, partly filled in. Shows depth of features.
5. **Lake Detail · CPUE chart** — pick a lake with several decades of survey data and multiple gears (e.g. Lake Mille Lacs in MN, or Lake Oahe in SD). The line chart sells the longitudinal-data angle.
6. **Lake Detail · Stocking history** — same or different lake, switched to the stocking tab, with the adults/100ac overlay visible. The single most distinctive feature.
7. **County map picker** — shows the regional/local-knowledge angle.
8. **Glossary modal** — proves the data is documented and credible.

Adjust to taste. **Order matters** in the App Store — the first 1–2 are visible without swiping, so put the strongest screen first.

### Apple Review notes (paste into App Store Connect → App Review Information)

```
LakeLore is a free Minnesota fishing-lake reference. The optional LakeLore All-States annual subscription ($5.99/yr, auto-renewing) unlocks four additional states: North Dakota, South Dakota, Nebraska, Iowa. No account is required at any tier — identity is an anonymous device-generated UUID, no email, no sign-up.

To test core functionality without subscribing:
1. Launch the app.
2. Tap Minnesota on the State Select screen. (The "FREE" chip indicates free access.)
3. The full Minnesota dataset (9,490 lakes, 23,618 surveys, 396,371 catch records, from MN DNR public records) is browsable: search by species, county, gear, year, etc., and tap any lake to see catch-rate-over-time and stocking-history charts.

To test the subscription / paywall flow:
1. Tap any non-Minnesota state (e.g. North Dakota). The paywall modal appears.
2. The paywall displays subscription title, length (1 year), price (auto-pulled from the store, currency-localized), auto-renewal terms, and links to Terms of Use + Privacy Policy as required by App Store Review guideline 3.1.2(a).
3. Use a sandbox Apple ID (App Store Connect → Users and Access → Sandbox) to complete a test purchase. After purchase, all four paid states unlock.
4. "Restore purchases" is available both inside the paywall and on the About & Sources screen.
5. "Manage subscription" (visible on About & Sources after purchase) opens the native iOS subscription-management sheet via StoreKit.

Data sources: every state agency (MN DNR, ND Game & Fish, SD GFP, Nebraska Game & Parks, Iowa DNR) is credited on the in-app "About & Sources" screen, accessible from the State Select screen via the "ⓘ ABOUT" badge. The app is independent and not affiliated with any agency; all data is sourced from public records published by each agency.

Privacy:
- Anonymous device UUID (X-User-Id header): collected for entitlement lookup. Not linked to user identity. Not used for tracking. Declared in Privacy Manifest as NSPrivacyCollectedDataTypeUserID, purpose: App Functionality.
- Purchase History (RevenueCat transaction state): collected for entitlement enforcement. Not linked to identity. Not used for tracking. Purpose: App Functionality.
- Crash + Performance Data (Sentry): collected for diagnostic purposes. Not linked to identity. Not used for tracking. Purpose: App Functionality.

Privacy policy: https://www.lakeloreapp.com/privacy
Terms of use: https://www.lakeloreapp.com/terms
Support: https://www.lakeloreapp.com/support (publishes support@lakeloreapp.com)
```

(Update sandbox tester credentials if Apple asks; we provision them per-submission rather than committing them here.)

### Google Play Test Instructions (Play Console → Store presence → App content → Target audience and content)

```
LakeLore is a free Minnesota fishing-lake reference. Optional LakeLore All-States annual subscription ($5.99/yr) unlocks ND, SD, NE, IA.

To test:
1. Open the app — Minnesota is free, no sign-in required.
2. Tap Minnesota; search any species (e.g. Walleye); tap any lake to see charts.
3. To test the paywall: tap a non-Minnesota state. Subscription sheet appears with auto-renew terms + Terms / Privacy links. Use a license-tester Google account (Play Console → Setup → License testing) for test purchases at $0.

No account / login required. Anonymous device UUID identity. The app collects no contact info, no location, no analytics — only an anonymous identifier (for entitlement lookup), purchase state (for subscription enforcement), and crash/performance data (Sentry, diagnostic).

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
