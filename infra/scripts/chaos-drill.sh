#!/usr/bin/env bash
# Failure drills for a running stack: restart Redis, restart the app, stop Postgres for 30 seconds. Each drill
# records, every 2 seconds, what someone using the app would get (the API, the health check), then how long
# the stack took to recover on its own. Run it with a load test going (infra/k6/ws-load.js) to also see what
# live phones experience. Results are in docs/07 ("Load and failure drills").
#
#   infra/scripts/chaos-drill.sh                     # all three, local stack (docker compose dev services)
#   infra/scripts/chaos-drill.sh redis               # one drill: redis | app | postgres
#
# Settings (environment):
#   API          the public API base            default http://localhost:8480
#   HEALTH       the health check (management)  default http://localhost:8481/actuator/health
#   ORIGIN       an allowed web app origin      default http://localhost:5480
#   REDIS        Redis container name           default squadmap-dev-redis-1
#   POSTGRES     Postgres container name        default squadmap-dev-postgres-1
#   APP_RESTART  command that restarts the app  required for the "app" drill (for example
#                "docker restart squadmap-app-1" on a server)
#   DB_DOWN_S    seconds Postgres stays down    default 30
#
# Read-only apart from the restarts: it signs in nobody and changes no data. Don't run it against production.
set -euo pipefail

API=${API:-http://localhost:8480}
HEALTH=${HEALTH:-http://localhost:8481/actuator/health}
ORIGIN=${ORIGIN:-http://localhost:5480}
REDIS=${REDIS:-squadmap-dev-redis-1}
POSTGRES=${POSTGRES:-squadmap-dev-postgres-1}
DB_DOWN_S=${DB_DOWN_S:-30}

# What a visitor gets: a session refresh with a made-up cookie, which looks it up in the database and answers
# 401 when all is well (its limit, 60 a minute, allows a probe every 2 s); and the health check, as
# "<status>/db:<status>/redis:<status>".
probe() {
  local api body health
  api=$(curl -s -o /dev/null -w '%{http_code}' -m 10 -X POST -H "Origin: $ORIGIN" \
    -H 'Cookie: sm_refresh=chaos-drill-not-a-session' "$API/api/v1/auth/refresh" || true)
  body=$(curl -s -m 10 "$HEALTH" || true)
  if [[ -z $body ]]; then
    health=unreachable
  else
    health="$(field "$body" status)/db:$(component "$body" db)/redis:$(component "$body" redis)"
  fi
  echo "$api $health"
}

field() { { sed -n 's/^{"status":"\([A-Z_]*\)".*/\1/p' <<<"$1" || true; } | head -1 | sed 's/^$/NONE/'; }
component() { { grep -o "\"$2\":{\"status\":\"[A-Z_]*\"" <<<"$1" || true; } | sed 's/.*:"\([A-Z_]*\)"/\1/' | head -1 | sed 's/^$/?/'; }

# Probes every 2 seconds until the stack has been healthy for 3 probes in a row (or 3 minutes pass).
# $2, when given, is the moment the broken part came back; recovery is also counted from it.
watch_until_healthy() {
  local started=$1 back=${2:-} healthy=0 seen_bad=0
  while (( SECONDS - started < 180 )); do
    read -r api health < <(probe)
    printf '  t+%3ss  api=%s  health=%s\n' "$((SECONDS - started))" "$api" "$health"
    if [[ $api == 401 && $health == UP/db:UP/redis:UP ]]; then
      healthy=$((healthy + 1))
      if (( healthy >= 3 )); then
        local since_start=$((SECONDS - started - 4))
        if [[ -n $back ]]; then
          echo "  recovered about $((SECONDS - back - 4)) s after it came back ($since_start s after the drill began)"
        else
          echo "  recovered after about $since_start s"
        fi
        return 0
      fi
    else
      healthy=0
      seen_bad=1
    fi
    sleep 2
  done
  (( seen_bad )) && echo "  NOT recovered within 3 minutes" && return 1
  return 0
}

require_healthy() {
  read -r api health < <(probe)
  if [[ $api != 401 || $health != UP/db:UP/redis:UP ]]; then
    echo "The stack isn't healthy before the drill (api=$api health=$health). Start it first." >&2
    exit 1
  fi
}

drill_redis() {
  echo "== Restart Redis ($REDIS)"
  require_healthy
  local started=$SECONDS
  docker restart "$REDIS" >/dev/null
  watch_until_healthy "$started"
}

drill_app() {
  echo "== Restart the app"
  if [[ -z ${APP_RESTART:-} ]]; then
    echo "  skipped: set APP_RESTART to the command that restarts the app" >&2
    return 0
  fi
  require_healthy
  local started=$SECONDS
  bash -c "$APP_RESTART"
  watch_until_healthy "$started"
}

drill_postgres() {
  echo "== Stop Postgres ($POSTGRES) for ${DB_DOWN_S} s"
  require_healthy
  local started=$SECONDS
  # Whatever happens next, the database comes back.
  trap 'docker start "$POSTGRES" >/dev/null 2>&1 || true' EXIT
  docker stop "$POSTGRES" >/dev/null
  while (( SECONDS - started < DB_DOWN_S )); do
    read -r api health < <(probe)
    printf '  t+%3ss  api=%s  health=%s  (database down)\n' "$((SECONDS - started))" "$api" "$health"
    sleep 2
  done
  docker start "$POSTGRES" >/dev/null
  echo "  database started again"
  watch_until_healthy "$started" "$SECONDS"
}

case "${1:-all}" in
  redis) drill_redis ;;
  app) drill_app ;;
  postgres) drill_postgres ;;
  all) drill_redis; echo; drill_app; echo; drill_postgres ;;
  *) echo "usage: $0 [redis|app|postgres|all]" >&2; exit 2 ;;
esac
