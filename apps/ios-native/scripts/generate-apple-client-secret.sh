#!/usr/bin/env bash
# Generate the Apple "Sign in with Apple" client secret JWT that
# Supabase / Auth0 / Cognito / any standard OIDC consumer expects.
#
# Apple gives you a .p8 private key; the actual secret you paste
# into the IdP dashboard is an ES256-signed JWT with specific
# claims (see Apple TN3107). The JWT expires (max ~6 months per
# Apple), so re-run this script before the expiry date.
#
# Usage:
#   ./generate-apple-client-secret.sh \
#     --p8       ~/Downloads/AuthKey_ABC123DEF4.p8 \
#     --team-id  XYZ987WVUT \
#     --key-id   ABC123DEF4 \
#     --client-id wiki.memory.MemoryWiki.signinservice
#
# Output: prints the JWT to stdout. Paste into Supabase dashboard
# Authentication → Providers → Apple → Secret Key (for OAuth).
#
# Requires: openssl (default on macOS), python3 (default on macOS).

set -euo pipefail

P8=""
TEAM_ID=""
KEY_ID=""
CLIENT_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --p8)       P8="$2";       shift 2 ;;
    --team-id)  TEAM_ID="$2";  shift 2 ;;
    --key-id)   KEY_ID="$2";   shift 2 ;;
    --client-id) CLIENT_ID="$2"; shift 2 ;;
    -h|--help)
      sed -n 's/^# //p' "$0" | head -20
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

for var in P8 TEAM_ID KEY_ID CLIENT_ID; do
  if [[ -z "${!var}" ]]; then
    echo "Missing --${var,,} (run with --help)" >&2
    exit 1
  fi
done

if [[ ! -f "$P8" ]]; then
  echo "Private key not found: $P8" >&2
  exit 1
fi

NOW=$(date +%s)
# Apple caps lifetime at 15777000 seconds (~6 months). Stay 1 day
# short to avoid edge clock-skew rejections.
EXP=$((NOW + 15777000 - 86400))

# base64url helpers (no padding).
b64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

HEADER_JSON=$(printf '{"alg":"ES256","kid":"%s","typ":"JWT"}' "$KEY_ID")
PAYLOAD_JSON=$(printf '{"iss":"%s","iat":%d,"exp":%d,"aud":"https://appleid.apple.com","sub":"%s"}' \
  "$TEAM_ID" "$NOW" "$EXP" "$CLIENT_ID")

HEADER_B64=$(printf '%s' "$HEADER_JSON" | b64url)
PAYLOAD_B64=$(printf '%s' "$PAYLOAD_JSON" | b64url)
SIGNING_INPUT="${HEADER_B64}.${PAYLOAD_B64}"

# Sign with ES256. openssl returns ASN.1 DER which is NOT what
# JWT wants — JWT needs raw R||S (64 bytes for P-256). Python
# unpacks it.
DER_SIG=$(printf '%s' "$SIGNING_INPUT" | openssl dgst -sha256 -binary -sign "$P8" | openssl base64 -A)

JOSE_SIG=$(python3 - "$DER_SIG" <<'PY'
import sys, base64
der = base64.b64decode(sys.argv[1])
# Minimal ASN.1 DER parser for SEQUENCE of two INTEGERs.
def parse(buf, i):
    tag = buf[i]; i += 1
    length = buf[i]; i += 1
    if length & 0x80:
        n = length & 0x7F
        length = int.from_bytes(buf[i:i+n], "big"); i += n
    return tag, buf[i:i+length], i + length
assert der[0] == 0x30
_, body, _ = parse(der, 0)
_, r, j = parse(body, 0)
_, s, _ = parse(body, j)
def pad(b):
    b = b.lstrip(b'\x00')
    return b.rjust(32, b'\x00')
sig = pad(r) + pad(s)
sys.stdout.write(base64.urlsafe_b64encode(sig).rstrip(b'=').decode())
PY
)

echo "${SIGNING_INPUT}.${JOSE_SIG}"
