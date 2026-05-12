#!/usr/bin/env bash

set -euo pipefail

CERT_FILE="${TMPDIR:-/tmp}/codex-system-roots.pem"
SYSTEM_KEYCHAIN="/System/Library/Keychains/SystemRootCertificates.keychain"

if [[ ! -f "$SYSTEM_KEYCHAIN" ]]; then
  echo "System root keychain not found: $SYSTEM_KEYCHAIN" >&2
  exit 1
fi

security find-certificate -a -p "$SYSTEM_KEYCHAIN" > "$CERT_FILE"
export NODE_EXTRA_CA_CERTS="$CERT_FILE"

exec "$@"
