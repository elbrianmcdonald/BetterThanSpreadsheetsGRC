#!/bin/sh
# postgres wrapper: keeps the superuser password in sync with $POSTGRES_PASSWORD
# on every container start.
#
# Why: the official postgres image only sets the password during `initdb` on
# first boot. Subsequent changes to $POSTGRES_PASSWORD (env/.env drift, cloned
# repos with a different .env, etc.) are ignored because postgres trusts what
# is in its persistent data dir. This causes the app to hit P1000 auth errors
# after any rebuild where .env and the volume have diverged.
#
# How: start postgres in the background via its own entrypoint (so initdb
# still runs correctly on the very first boot), wait for it to accept
# connections over the local socket, ALTER the superuser password to match
# the env, then forward signals and wait on the postgres PID.
#
# The password ALTER uses local-socket trust auth (pg_hba.conf's default for
# `local all all trust`), so no password is needed to run it — which is the
# whole point: it works even when the env password doesn't match the stored
# one yet.
#
# A /tmp/password-synced sentinel is touched after the ALTER. The healthcheck
# in docker-compose.yml checks for this file before reporting healthy, so the
# app container waits until the password is in sync before starting.

set -eu

echo "[postgres-wrapper] Starting postgres via image entrypoint"
docker-entrypoint.sh postgres &
PG_PID=$!

# Forward SIGTERM/SIGINT to postgres so `docker compose down` shuts down cleanly
trap 'kill -TERM "$PG_PID" 2>/dev/null || true; wait "$PG_PID" 2>/dev/null || true; exit 0' TERM INT

POSTGRES_USER_NAME="${POSTGRES_USER:-postgres}"

echo "[postgres-wrapper] Waiting for postgres to accept socket connections"
while ! pg_isready -U "$POSTGRES_USER_NAME" -h /var/run/postgresql -q; do
  # Exit early if postgres died (e.g., initdb failure)
  if ! kill -0 "$PG_PID" 2>/dev/null; then
    echo "[postgres-wrapper] postgres exited before becoming ready" >&2
    wait "$PG_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

echo "[postgres-wrapper] Syncing superuser password with POSTGRES_PASSWORD env"
psql -U "$POSTGRES_USER_NAME" -h /var/run/postgresql -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER USER \"$POSTGRES_USER_NAME\" PASSWORD '$POSTGRES_PASSWORD';" >/dev/null

touch /tmp/password-synced
echo "[postgres-wrapper] Password sync complete"

wait "$PG_PID"
