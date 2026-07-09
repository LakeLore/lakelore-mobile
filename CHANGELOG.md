# Changelog

LakeLore mobile app — version history.

The version numbers below match `app.json` `version`, which is also the App Store / Play Store user-facing version. Each release section ends with a copy-paste block sized for the stores' release-notes fields:

- App Store Connect → App Store → version → "What's New in This Version" (4,000 char limit)
- Play Console → Production / Internal Testing → Release notes (500 char per language)

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
