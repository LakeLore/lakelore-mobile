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
| Support URL | `https://lakeloreapp.com/support` *(see note)* | — |
| Marketing URL | `https://lakeloreapp.com` | — |
| Privacy Policy URL | `https://lakeloreapp.com/privacy` | — |
| Copyright | `© 2026 LakeLore Co.` | — |
| Primary category (iOS) | `Sports` (secondary: `Reference`) | — |
| Primary category (Android) | `Sports` | — |
| Content rating | 4+ (iOS) / Everyone (Android) | — |

> **Note on Support URL:** The marketing site doesn't have a `/support` route yet. Either add a one-paragraph page with the `hello@lakeloreapp.com` mailto, or just point Apple/Google at `https://lakeloreapp.com/#download` (anchor on the homepage with the download CTA). Apple won't reject for either, but a real `/support` page is cleaner.

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
Now in seven states: MN, WI, MI, ND, SD, NE, IA. Free, no account, no ads — the netting and stocking atlas for northern game fish.
```

(125 chars. Use this for seasonal hooks: launch, ice-fishing, opener, fall walleye, etc.)

## Keywords (iOS, 100 chars max, comma-separated, no spaces between)

```
fishing,walleye,muskellunge,stocking,survey,dnr,perch,crappie,minnesota,wisconsin,michigan,iowa
```

(94 chars. Apple already indexes the app name, subtitle, and category, so don't repeat words from those.)

Variants to swap in if rankings shift:

- Trade `crappie` for `bass` (5→4 chars, frees up 1 char)
- Trade `wisconsin` for `nebraska` (9→8, frees up 1)
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

• Minnesota — 9,477 lakes, 22,952 surveys, 386,104 catch records (MN DNR)
• Wisconsin — 2,329 lakes (WI DNR)
• Iowa — 1,258 lakes (Iowa DNR)
• Nebraska — 541 lakes (Nebraska Game & Parks)
• North Dakota — 452 lakes (ND Game & Fish)
• Michigan — 367 lakes (MI DNR)
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

Walk through the App Privacy questionnaire and select **"Data Not Collected"**. None of the categories apply today:

- Contact Info: ❌
- Health & Fitness: ❌
- Financial Info: ❌
- Location: ❌
- Sensitive Info: ❌
- Contacts: ❌
- User Content: ❌
- Browsing History: ❌
- Search History: ❌
- Identifiers: ❌
- Purchases: ❌
- Usage Data: ❌ *(server logs are 30-day rate-limit data, not user analytics — see privacy policy)*
- Diagnostics: ❌
- Other Data: ❌

If/when you turn on analytics or crash reporting, return here and re-declare. The privacy policy already covers those categories as "May be collected".

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

1. **State Select** — the opening screen, "Lakes by State" with seven state cards.
2. **Search · List view** — Minnesota, Walleye, sorted by CPUE. Shows the brand on a results page.
3. **Search · Scatter view** — same query, switched to scatter. Visual variety + makes the data look rich.
4. **Search · Filters open** — Advanced Filters modal, partly filled in. Shows depth of features.
5. **Lake Detail · CPUE chart** — pick a lake with several decades of survey data and multiple gears (e.g. Lake Mille Lacs in MN, or Lake Oahe in SD). The line chart sells the longitudinal-data angle.
6. **Lake Detail · Stocking history** — same or different lake, switched to the stocking tab, with the adults/100ac overlay visible. The single most distinctive feature.
7. **County map picker** — shows the regional/local-knowledge angle.
8. **Glossary modal** — proves the data is documented and credible.

Adjust to taste. **Order matters** in the App Store — the first 1–2 are visible without swiping, so put the strongest screen first.

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
