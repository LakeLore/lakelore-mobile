#!/usr/bin/env bash
# capture-screenshots.sh — interactively capture the App Store / Play Store
# shot list from the iOS Simulator.
#
# Usage:
#   1. Boot the iPhone 16 Pro Max simulator (xcrun simctl boot ... or open the
#      simulator from Xcode → Window → Devices and Simulators).
#   2. Install + launch the LakeLore production / preview build on it
#      (npm run build:preview-sim:ios, then `xcrun simctl install booted` the
#      resulting .app, or open the Expo dev client).
#   3. Run this script from ~/lake-fish-mobile/. It walks through each shot
#      in order; you navigate the app to the right screen, press Enter, the
#      script grabs the framebuffer to screenshots/ios-6.9/<n>-<slug>.png.
#
# Notes:
#   - Uses `xcrun simctl io booted screenshot` because the Simulator window
#     can drop its GPU surface and render black; reading the framebuffer
#     directly is the source of truth.
#   - Resizes nothing — the iPhone 16 Pro Max booted device writes 1320×2868
#     PNGs that match App Store Connect's required dimensions exactly.
#   - For Android phones (1080×1920), run `adb exec-out screencap -p > x.png`
#     on a connected device or AVD. See SHOT_LIST_ANDROID below.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_OUT="$PROJECT_ROOT/screenshots/ios-6.9"
ANDROID_OUT="$PROJECT_ROOT/screenshots/android-phone"

mkdir -p "$IOS_OUT" "$ANDROID_OUT"

# Shot list — must match STORE_LISTING.md "Shot list" section.
# Each entry: "<slug>|<description>"
SHOTS=(
  "01-state-select|State Select — the opening screen with five state cards"
  "02-search-list|Search → List view — Minnesota, Walleye, sorted by CPUE"
  "03-search-scatter|Search → Scatter view — same query, switched to scatter"
  "04-search-filters|Advanced Filters modal, partly filled in"
  "05-lake-cpue|Lake Detail — CPUE chart on a lake with multiple decades and gears"
  "06-lake-stocking|Lake Detail — Stocking History tab with adults/100ac overlay"
  "07-county-map|County map picker"
  "08-about-glossary|About & Sources screen with the glossary"
)

bold() { printf '\033[1m%s\033[0m' "$*"; }
gold() { printf '\033[33m%s\033[0m' "$*"; }
fail() { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# Sanity check: is a simulator booted?
if ! xcrun simctl list devices booted | grep -q Booted; then
  fail "No iOS simulator booted. Open Simulator.app and boot the iPhone 16 Pro Max device."
fi

DEVICE_INFO=$(xcrun simctl list devices booted | awk '/Booted/ { print }' | head -1)
echo "$(bold "Capturing against:") $DEVICE_INFO"
echo

if ! echo "$DEVICE_INFO" | grep -Eq "iPhone (16|15|14) Pro Max"; then
  echo "$(gold "⚠")  Booted device does not look like an iPhone 6.9\" Pro Max."
  echo "    App Store Connect requires 1320×2868 portrait for iPhone 6.9\"."
  echo "    Continue anyway? [y/N] "
  read -r ans
  [[ "$ans" =~ ^[Yy]$ ]] || exit 0
fi

echo "$(bold "Output directory:") $IOS_OUT"
echo "$(bold "Shot count:") ${#SHOTS[@]}"
echo
echo "For each shot, navigate the simulator to the described screen, then"
echo "press $(bold Enter) to capture. Press $(bold s) then Enter to skip."
echo "Press $(bold q) then Enter to abort."
echo

for entry in "${SHOTS[@]}"; do
  slug="${entry%%|*}"
  desc="${entry#*|}"
  out="$IOS_OUT/${slug}.png"
  echo "─────────────────────────────────────────────────────────────────────"
  echo "$(bold "$slug")"
  echo "  $desc"
  echo "  → $out"
  if [[ -f "$out" ]]; then
    echo "  $(gold "(file exists; will overwrite)")"
  fi
  printf "  capture? [Enter / s / q] "
  read -r ans
  case "$ans" in
    q|Q) echo "Aborted."; exit 0 ;;
    s|S) echo "  skipped."; continue ;;
    *)
      xcrun simctl io booted screenshot "$out"
      # Verify dimensions
      dims=$(sips -g pixelWidth -g pixelHeight "$out" 2>/dev/null | awk '/pixel(Width|Height)/ { print $2 }' | xargs)
      echo "  $(bold "✓") saved ($dims px)"
      ;;
  esac
done

echo
echo "─────────────────────────────────────────────────────────────────────"
echo "$(bold "Done.")"
echo "Captured files:"
ls -1 "$IOS_OUT"/*.png 2>/dev/null | sed 's|^|  |'
echo
echo "Next:"
echo "  1. Inspect each PNG. Crop or recapture any that look off."
echo "  2. Upload to App Store Connect → My Apps → LakeLore → App Store tab"
echo "     → version → App Previews and Screenshots → iPhone 6.9\""
echo "  3. For Android (1080×1920), boot an AVD or connect a device and run:"
echo "       adb exec-out screencap -p > $ANDROID_OUT/01-state-select.png"
echo "     repeated per shot. The Android Play Store accepts the same 9:16"
echo "     compositions; capture the same flow on an Android device."
