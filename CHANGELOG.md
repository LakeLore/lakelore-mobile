# Changelog

LakeLore mobile app — version history.

The version numbers below match `app.json` `version`, which is also the App Store / Play Store user-facing version. Each release section ends with a copy-paste block sized for the stores' release-notes fields:

- App Store Connect → App Store → version → "What's New in This Version" (4,000 char limit)
- Play Console → Production / Internal Testing → Release notes (500 char per language)

---

## [1.1.2] — not yet built (entry written 2026-10-22)

The trophy + search-redesign release, and the first store build with Ask LakeLore. Most of this reached 1.1.1 users by OTA on 2026-09-18; the new native build adds Ask LakeLore (compiled out of every 1.1.1 OTA) and the store users' first binary on runtime 1.1.2.

### Added
- **Ask LakeLore** — an AI assistant for All-States subscribers (Claude Opus 5.5, server-side tool use over the state's survey data). Answers only lake-choice questions from LakeLore data and gives a fixed refusal for anything else; per-subscriber daily cap; every answer labelled AI-generated with an in-app Report link; server kill switch via client-config `ask.enabled`.
- **Trophy Abundance** (schema v8) — rank by catch rate of memorable-size fish, with a Trophy chart tab on the lake page.
- Slider filters and lake-name typeahead.

### Changed
- Search redesigned around three selector boxes (Species / Rank Lakes By / View Ranking As) with auto-search; no Search button.
- Lake page: identity in the header, source/report buttons that open the official state survey.

### Removed
- Share Lake Card (2026-09-14).

### Fixed
- Session-token 401 recovery, chart smoothness, and the 2026-09-15 bug-hunt findings (12).

**App Store "What's New":**

> Trophy fishing, redesigned search, and better filters.
> • NEW: Trophy Abundance — rank lakes by the catch rate of true trophy-class fish (like a 25″ walleye), with a trophy-over-time chart on every lake page that has the data.
> • Redesigned search: pick a species, how to rank, and how to view — results appear as you choose. No search button needed.
> • Filters got easier: sliders for every range, lake-name suggestions as you type, and lake pages now jump straight to the official state survey.
> • NEW for All-States subscribers: Ask LakeLore, an AI fishing assistant. Say what you're after in plain words and get lakes picked for you from the survey data.
> • Plus dozens of fixes, including smoother charts and more reliable sessions.

**Play release notes (under 500 characters):**

> • NEW: Ask LakeLore — All-States subscribers can ask in plain words and get lakes picked from the survey data.
> • NEW: Trophy Abundance — rank lakes by catch rate of trophy-class fish, with a trophy chart on lake pages.
> • Redesigned search: pick species, ranking and view; results appear as you choose.
> • Slider filters and lake-name suggestions.
> • Lake pages link straight to the official state survey.
> • Dozens of fixes.

---

## [1.1.1] — Build 29 (iOS) / Play release 19 — shipped 2026-08-24

The all-states polish + durability release. (Catch-up entry written 2026-07-26 — 1.1.0 and 1.1.1 shipped their work across 15 OTA rounds and two builds; see LAUNCH.md and the improvement plans for the full trail.)

### Added
- **Measure × Gear/Source data model** (2026-07-21): a Measure selector (Abundance / Avg Size / Stocking Impact / Presence) drives every search, with Gear/Source as the required filter under Abundance and Avg Size — built per-state from the new `/measures` endpoint, so each state exposes exactly the measures its data supports.
- Share Lake Card (native build 21+).
- Forecast-rating badges, `Est. length` honesty labels, `Stocked · Inferred` presence labels, per-state glossary rework.
- Update-durability kit (2026-07-25): in-app upgrade nudge / kill-switch check, version + OTA id in About and on every request, emergency-launch reporting.

### Changed
- Price: LakeLore All-States is **$4.99/yr** (lowered from $5.99, 2026-07-25).
- Preview mode covers lake detail too: identity stays redacted, every metric visible.
- Offline caches now expire (results/lake payloads 30 d; entitlement hint 7 d).

### Fixed
- Species-anonymous rows and wrong-species navigation under All Species + name search; scatter-dot taps navigate to the tapped dot's species.
- Share-card crash on pre-21 binaries (pure-JS availability probe before native require).
- Session tokens persist across launches correctly (no more per-launch re-mint/attestation).

### Store release-notes copy

```
LakeLore now covers 38 states — 46,000+ lakes of agency netting surveys, stocking records, and forecasts, free to preview everywhere and free in full for Minnesota.

New: pick your measure (abundance, average size, stocking impact, presence) and the exact survey gear behind it. Share any lake as a card. Smoother offline behavior and dozens of fixes.
```

(~360 chars — fits Play's 500 and Apple's 4,000. Counts corrected 2026-08-13 (US-only submission — MB product-held); keep in sync with STORE_LISTING.)

## [1.1.0] — Build 20 (TestFlight; superseded by 1.1.1)

The all-states launch build (2026-07-15): 50 active states/provinces (45 US + 5 CA), map-based US+Canada state selector → county map picker, registry-generated per-state config and species display names, preview mode across every paid state, App Attest / Play Integrity scaffolding, X-User-Sig client signatures, offline retry/backoff, Sentry. Fifteen OTA rounds of fixes shipped on this runtime; all are baked into 1.1.1's binary.

---

## [1.0.1] — Unreleased

Performance release: pinch-zoom and drag-to-pan on the county selector and the
scatterplot now run on the UI thread (Reanimated worklets) — smooth on Android,
where the old per-frame JS re-render dropped frames badly enough to block the
Play launch. Also fixes a pan-after-zoom deadlock on Android (latched pinch
flag), verified on-device.

Build 19 adds **paid-state preview mode**: non-subscribers can now enter ND /
SD / NE / IA and use everything — county selection, species filters, lake-name
search, list + scatter views, every metric visible — but lake names render as
a blurred placeholder (redacted server-side; names never reach the device) and
any lake-detail tap opens the paywall. Replaces the old hard block at state
selection. Requires the matching API deploy (2026-07-08, live).

Store release notes:

> Smoother maps and charts: pinch-zoom and drag are now buttery on every
> device, and fixed a bug where panning could stop working after zooming.
> New: preview any state before subscribing — browse real survey numbers
> everywhere; unlock All-States to see which lakes they belong to.

## [1.0.0] — Released (App Store)

First public release. Five-state lake-fish atlas (MN free, plus ND / SD / NE / IA via LakeLore All-States annual subscription). iPhone-only for v1; Android phone supported.

### Features

- Search every surveyed lake by species, county, gear, lake size, year, stocking density, and per-state extras (PSD, Wr, weight, etc.).
- Two views per result set: list (sortable, paged) and scatter (every dot a lake-survey, colored by stocking density).
- Lake detail page: catch-rate over time chart by gear, full stocking history chart with adults-per-100-acre overlay.
- County map picker with pan + pinch zoom.
- Per-state glossary explaining catch-rate methodology, gear types, and agency-specific terminology.
- "Report data issue" feedback flow on every lake detail page.
- Outbound links to the original agency source page on every lake.
- Offline indicator + safe degradation.
- Crash + performance monitoring via Sentry (anonymous, diagnostic only).

### Store release-notes copy

```
LakeLore — a field guide to fish populations in surveyed lakes across the upper Midwest. Minnesota's 9,490 lakes are free. Unlock North Dakota, South Dakota, Nebraska, and Iowa with the LakeLore All-States annual subscription.

Decades of state DNR netting surveys and stocking records, normalized, charted, and credited to their source. No accounts. No ads.
```

(~400 chars — fits the Play Store 500-char limit and Apple's 4,000.)

---

## Format

Future entries follow the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) shape:

- **Added** — new features
- **Changed** — changes to existing functionality
- **Fixed** — bug fixes
- **Removed** — features dropped this version
- **Security** — vulnerability fixes

Stick the store release-notes copy at the bottom of each version section so it's ready to paste on submit day.
