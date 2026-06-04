#!/usr/bin/env bash
#
# setup-env.sh — populate .env with strong secrets for first-run installation.
#
# Idempotent: existing non-empty values are preserved. Generates only the
# secrets that are missing or blank. Safe to re-run.
#
# Generates: AUTH_SECRET, CRON_SECRET, POSTGRES_PASSWORD.
#
# Usage:
#   ./scripts/setup-env.sh
#
set -euo pipefail

# Run from repo root so paths resolve.
cd "$(dirname "$0")/.."

ENV_FILE=".env"
EXAMPLE_FILE=".env.example"

if [ ! -f "$EXAMPLE_FILE" ]; then
  echo "ERROR: $EXAMPLE_FILE not found. Run this script from the repo root." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "Created $ENV_FILE from $EXAMPLE_FILE"
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "ERROR: openssl is required but not installed." >&2
  exit 1
fi

generate_if_missing() {
  local var=$1
  # Treat both unset and empty (VAR= with nothing after) as missing.
  if grep -qE "^${var}=[^[:space:]]+" "$ENV_FILE"; then
    echo "  $var already set, skipping"
    return
  fi

  local value
  value=$(openssl rand -hex 32)

  if grep -qE "^${var}=" "$ENV_FILE"; then
    # Cross-platform sed: write to temp then move (avoids -i portability issue).
    awk -v var="$var" -v value="$value" '
      $0 ~ "^"var"=" { print var"="value; next }
      { print }
    ' "$ENV_FILE" > "$ENV_FILE.tmp"
    mv "$ENV_FILE.tmp" "$ENV_FILE"
  else
    echo "${var}=${value}" >> "$ENV_FILE"
  fi
  echo "  Generated $var"
}

echo "Populating secrets in $ENV_FILE:"
generate_if_missing AUTH_SECRET
generate_if_missing CRON_SECRET
generate_if_missing POSTGRES_PASSWORD

echo ""
echo "Setup complete. Review $ENV_FILE, then run: docker compose up -d"
