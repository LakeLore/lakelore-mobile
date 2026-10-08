#!/bin/bash
# scripts/ota.sh — publish an OTA update with the checks that used to be manual.
#
#   scripts/ota.sh --runtime 1.1.1 --message "what changed" [--rollout 10]
#   scripts/ota.sh --runtime 1.1.2 --message "…" --staging
#   scripts/ota.sh --runtime 1.1.1 --message "…" --dry-run     (export + verify, no publish)
#
# Why a script (2026-10-08). `npm run ota` was `eas update --branch production`:
#  - It published to whatever version app.json held. runtimeVersion.policy is
#    appVersion, so with the repo at 1.1.2 and the stores at 1.1.1 a plain run
#    reached NOBODY, and targeting the live fleet meant hand-editing app.json.
#    --runtime is now REQUIRED, and app.json is swapped and restored here.
#  - EXPO_PUBLIC_* values are inlined at bundle time from the shell AND ride
#    Metro's transform cache: on 2026-09-17 a production export reused
#    staging-inlined modules with the env unset. This clears the cache, sets
#    the env explicitly for the target, and then INSPECTS the exported bundle.
#  - It went to 100% of the channel at once. --rollout defaults to 10; raise
#    it with `eas update:edit` once crash-free, or pass --rollout 100.
#
# Publishing is an outward action: this script never runs unattended.
set -euo pipefail
cd "$(dirname "$0")/.."

RUNTIME=""; MESSAGE=""; ROLLOUT=10; STAGING=false; DRY=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --runtime) RUNTIME="${2:-}"; shift 2 ;;
    --message) MESSAGE="${2:-}"; shift 2 ;;
    --rollout) ROLLOUT="${2:-}"; shift 2 ;;
    --staging) STAGING=true; shift ;;
    --dry-run) DRY=true; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ "$RUNTIME" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "--runtime X.Y.Z is required: the app version whose installed devices should receive this update" >&2; exit 2; }
[[ -n "$MESSAGE" ]] || $DRY || { echo "--message is required" >&2; exit 2; }
[[ "$ROLLOUT" =~ ^[0-9]+$ && "$ROLLOUT" -ge 1 && "$ROLLOUT" -le 100 ]] || { echo "--rollout must be 1-100" >&2; exit 2; }

if $STAGING; then
  CHANNEL=staging
  export EXPO_PUBLIC_API_BASE="https://lake-fish-api-staging.fly.dev"
  export EXPO_PUBLIC_ASK_ENABLED=1
else
  CHANNEL=production
  unset EXPO_PUBLIC_API_BASE EXPO_PUBLIC_ASK_ENABLED
fi

# 1. Publish what is committed — an OTA from a dirty tree cannot be reproduced.
if ! $DRY && [[ -n "$(git status --porcelain)" ]]; then
  echo "working tree not clean — commit first (or use --dry-run to verify a bundle)" >&2; exit 1
fi

# 2. Target the requested runtime. app.json's version IS the runtime
#    (policy appVersion); swap it for the export + publish, always restore.
# A leftover backup means an earlier run died mid-swap and app.json may hold
# the WRONG version — never build on top of that.
[[ ! -f app.json.ota-backup ]] || { echo "app.json.ota-backup exists (an earlier run was killed mid-swap). Inspect app.json, restore with: mv app.json.ota-backup app.json" >&2; exit 1; }
REPO_VERSION="$(node -p "require('./app.json').expo.version")"
restore() { [[ -f app.json.ota-backup ]] && mv -f app.json.ota-backup app.json; return 0; }
trap restore EXIT
if [[ "$REPO_VERSION" != "$RUNTIME" ]]; then
  cp app.json app.json.ota-backup
  node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('app.json','utf8'));j.expo.version='$RUNTIME';fs.writeFileSync('app.json',JSON.stringify(j,null,2)+'\n')"
fi
echo
echo "=== OTA → channel $CHANNEL, runtime $RUNTIME (repo is at $REPO_VERSION), rollout $ROLLOUT% ==="
echo "    Only devices running app version $RUNTIME on the $CHANNEL channel receive it."
echo

# 3. Gates.
npx tsc --noEmit
npx jest --silent

# 4. Clean export. The transform cache carries inlined EXPO_PUBLIC_* values
#    across runs, so it goes first.
OUT=dist-ota
rm -rf node_modules/.cache "$OUT"
npx expo export --clear --platform all --output-dir "$OUT" --source-maps >/dev/null

# 5. Inspect what was actually built.
#    Needles must be PURE ASCII: Hermes stores any string containing a
#    non-ASCII character as UTF-16, which `strings` does not see — such a
#    needle would count 0 and a "must be absent" check would pass vacuously.
BUNDLES=()
while IFS= read -r b; do BUNDLES+=("$b"); done < <(find "$OUT/_expo/static/js" -name '*.hbc' 2>/dev/null)
[[ ${#BUNDLES[@]} -gt 0 ]] || { echo "no .hbc bundles under $OUT — export layout changed?" >&2; exit 1; }
count() {
  LC_ALL=C grep -q '[^ -~]' <<<"$1" && { echo "non-ASCII needle '$1' cannot be checked" >&2; exit 1; }
  local n=0 c; for b in "${BUNDLES[@]}"; do c=$(strings -a "$b" | grep -c -- "$1" || true); n=$((n + c)); done; echo "$n"
}
fail=0
check() {  # description, needle, expectation (zero|nonzero)
  local n; n=$(count "$2")
  if { [[ "$3" == zero && "$n" -ne 0 ]] || [[ "$3" == nonzero && "$n" -eq 0 ]]; }; then
    echo "  ✗ $1 ($n occurrence(s) of '$2', expected $3)"; fail=1
  else
    echo "  ✓ $1"
  fi
}
echo "bundle checks ($CHANNEL):"
if $STAGING; then
  check "points at the staging API"            "lake-fish-api-staging" nonzero
  check "chat screen is present"               "Start a new chat"      nonzero
else
  check "does not reference the staging API"   "lake-fish-api-staging" zero
  check "uses the owned API hostname"          "api.lakeloreapp.com"   nonzero
  check "keeps the Fly fallback hostname"      "lake-fish-api.fly.dev" nonzero
  check "chat screen is compiled out"          "Start a new chat"      zero
  check "launch chooser is compiled out"       "Give me recommendations" zero
fi
[[ "$fail" -eq 0 ]] || { echo "bundle checks FAILED — not publishing" >&2; exit 1; }

if $DRY; then
  echo; echo "dry run: bundle verified in $OUT/, nothing published."; exit 0
fi

# 6. Publish exactly the inspected bundle.
npx eas update --channel "$CHANNEL" --input-dir "$OUT" --skip-bundler \
  --rollout-percentage "$ROLLOUT" --message "$MESSAGE"

# 7. Source maps, so crashes from this bundle are readable in Sentry.
if [[ -n "${SENTRY_AUTH_TOKEN:-}" ]]; then
  npx sentry-expo-upload-sourcemaps "$OUT" || echo "WARN: Sentry source-map upload failed — crashes from this update will be unsymbolicated" >&2
else
  echo "WARN: SENTRY_AUTH_TOKEN not set — source maps NOT uploaded; crashes from this update will be unsymbolicated" >&2
fi

echo
echo "published at $ROLLOUT%. Widen with: npx eas update:edit   ·   roll back with: npx eas update:revert-update-rollout (RUNBOOK §12)"
