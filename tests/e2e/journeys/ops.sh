#!/usr/bin/env bash
# Ops engineer journey — health, status, metrics (docs/technical/journey-ops.md).

run_ops_journey() {
  echo ""
  echo "── Ops journey (health & metrics) ────────────────────────"

  local health status metrics
  health=$(curl -sf "$API_URL/health" 2>/dev/null || echo '{}')
  e2e_check_json "health postgres up" '"postgres":"up"' "$health"

  status=$(curl -s "$API_URL/api/v1/status" 2>/dev/null || echo '{}')
  e2e_check_json "status dependency checks" '"checks"' "$status"
  e2e_check_json "status postgres in checks" '"postgres"' "$status"

  metrics=$(curl -sf "$API_URL/metrics" 2>/dev/null || echo '')
  if echo "$metrics" | grep -q 'tahti_api_healthy'; then
    e2e_green "Prometheus metrics expose tahti_api_healthy"
  else
    e2e_red "Prometheus metrics missing tahti_api_healthy"
  fi
  if echo "$metrics" | grep -q 'tahti_api_uptime_seconds'; then
    e2e_green "Prometheus metrics expose uptime"
  else
    e2e_red "Prometheus metrics missing uptime"
  fi
  if echo "$metrics" | grep -q 'tahti_postgres_backup_age_hours'; then
    e2e_green "Prometheus metrics expose backup age"
  else
    e2e_yellow "backup age metric missing (optional in dev)"
  fi

  local docs_code
  docs_code=$(e2e_http_code "$API_URL/docs")
  if [[ "$docs_code" == "200" || "$docs_code" == "401" ]]; then
    e2e_green "OpenAPI docs endpoint reachable ($docs_code)"
  else
    e2e_yellow "OpenAPI docs returned HTTP $docs_code"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  JOURNEYS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../helpers.sh
  source "$JOURNEYS_DIR/../helpers.sh"
  e2e_wait_for_api "$API_URL/health" || exit 1
  run_ops_journey
  e2e_summary "Ops journey" || exit 1
fi
