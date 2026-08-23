#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────
# Integrity check for The Museum of Emergence.
#
# The site's safety rests on being genuinely inert: no dependencies, no
# network at runtime, no storage, no dynamic code. This script proves that
# rather than assuming it. Run it before every push, and on any PR you are
# thinking of merging.
#
#   ./tools/verify.sh
# ────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; DIM=$'\033[2m'; OFF=$'\033[0m'
fail=0
SRC=$(find . -type f \( -name '*.js' -o -name '*.html' -o -name '*.css' \) \
        -not -path './.git/*' -not -path './_backups/*')

check () {                       # check <label> <regex> <severity>
  local label="$1" pat="$2" sev="${3:-fatal}"
  local hits
  hits=$(grep -nEI "$pat" $SRC 2>/dev/null | grep -v '^\s*$' || true)
  if [ -n "$hits" ]; then
    if [ "$sev" = fatal ]; then
      printf '%s  ✗ %-46s%s\n' "$RED" "$label" "$OFF"; fail=1
    else
      printf '%s  ! %-46s%s\n' "$YEL" "$label" "$OFF"
    fi
    printf '%s' "$DIM"; printf '%s\n' "$hits" | sed 's/^/      /' | head -12; printf '%s' "$OFF"
  else
    printf '%s  ✓ %-46s%s\n' "$GRN" "$label" "$OFF"
  fi
}

echo
echo "  THE MUSEUM OF EMERGENCE — integrity check"
echo "  ─────────────────────────────────────────────────────"
echo

# ── 1. no dynamic code execution ──────────────────────────────────────
check "no eval()"                     '(^|[^a-zA-Z0-9_.])eval[[:space:]]*\('
check "no new Function()"             'new[[:space:]]+Function[[:space:]]*\('
check "no dynamic import()"           '[^a-zA-Z0-9_.]import[[:space:]]*\('
check "no innerHTML from variables"   'innerHTML[[:space:]]*=[[:space:]]*[a-z_]+[[:space:]]*;' warn

# ── 2. no network at runtime ──────────────────────────────────────────
check "no fetch()"                    '(^|[^a-zA-Z0-9_.])fetch[[:space:]]*\('
check "no XMLHttpRequest"             'XMLHttpRequest'
check "no WebSocket"                  'new[[:space:]]+WebSocket'
check "no sendBeacon"                 'sendBeacon'
check "no EventSource"                'new[[:space:]]+EventSource'

# ── 3. no third-party origins ─────────────────────────────────────────
THIRD=$(grep -noEI 'https?://[a-zA-Z0-9.-]+' $SRC 2>/dev/null \
        | grep -vE '(github\.com|arjuptl\.github\.io|www\.w3\.org|sitemaps\.org|localhost)' || true)
if [ -n "$THIRD" ]; then
  printf '%s  ✗ %-46s%s\n' "$RED" "no third-party origins" "$OFF"; fail=1
  printf '%s' "$DIM"; printf '%s\n' "$THIRD" | sed 's/^/      /' | head -12; printf '%s' "$OFF"
else
  printf '%s  ✓ %-46s%s\n' "$GRN" "no third-party origins" "$OFF"
fi

# ── 4. no storage or tracking ─────────────────────────────────────────
check "no localStorage"               'localStorage'
check "no sessionStorage"             'sessionStorage'
check "no cookies"                    'document\.cookie'
check "no indexedDB"                  'indexedDB'
check "no navigator.sendBeacon/geo"   'navigator\.(geolocation|sendBeacon)'

# ── 5. no dependency machinery ────────────────────────────────────────
for f in package.json package-lock.json yarn.lock pnpm-lock.yaml node_modules; do
  if [ -e "$f" ]; then
    printf '%s  ✗ %-46s%s\n' "$RED" "no dependency machinery ($f)" "$OFF"; fail=1
  fi
done
[ ! -e package.json ] && [ ! -e node_modules ] && \
  printf '%s  ✓ %-46s%s\n' "$GRN" "no dependency machinery" "$OFF"

# ── 6. CSP present on every HTML page ─────────────────────────────────
missing=""
for f in $(find . -name '*.html' -not -path './.git/*' -not -path './_backups/*'); do
  grep -q 'Content-Security-Policy' "$f" || missing="$missing $f"
done
if [ -n "$missing" ]; then
  printf '%s  ✗ %-46s%s\n' "$RED" "CSP on every page —$missing" "$OFF"; fail=1
else
  printf '%s  ✓ %-46s%s\n' "$GRN" "CSP on every page" "$OFF"
fi

# ── 7. no unexpected binaries ─────────────────────────────────────────
BIN=$(find . -type f -not -path './.git/*' -not -path './_backups/*' \
        -not -name '*.js' -not -name '*.html' -not -name '*.css' -not -name '*.md' \
        -not -name '*.txt' -not -name '*.xml' -not -name '*.yml' -not -name '*.sh' \
        -not -name '.nojekyll' -not -name '.gitignore' -not -name 'LICENSE' \
        -not -name '*.woff2' -not -name 'SHA256SUMS' || true)
if [ -n "$BIN" ]; then
  printf '%s  ! %-46s%s\n' "$YEL" "unexpected non-source files" "$OFF"
  printf '%s%s\n%s' "$DIM" "$(printf '%s\n' "$BIN" | sed 's/^/      /')" "$OFF"
else
  printf '%s  ✓ %-46s%s\n' "$GRN" "no unexpected binaries (fonts only)" "$OFF"
fi

# ── 8. record a manifest so tampering is visible ──────────────────────
if command -v shasum >/dev/null 2>&1; then
  find . -type f -not -path './.git/*' -not -path './_backups/*' -not -name 'SHA256SUMS' \
    | sort | xargs shasum -a 256 > SHA256SUMS 2>/dev/null
  printf '%s  ✓ %-46s%s\n' "$GRN" "SHA256SUMS written ($(wc -l < SHA256SUMS | tr -d ' ') files)" "$OFF"
fi

echo
if [ "$fail" -eq 0 ]; then
  printf '%s  PASS — the museum is inert.%s\n\n' "$GRN" "$OFF"
else
  printf '%s  FAIL — do not push until the ✗ lines are resolved.%s\n\n' "$RED" "$OFF"
fi
exit "$fail"
