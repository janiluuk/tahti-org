# Rate limiting policy

## Global API limits (`apps/api/src/plugins/rate-limit.ts`)

- Default: **120 requests / minute / IP** for most routes.
- Auth and chat token routes: **10 requests / minute / IP**.
- Disabled when `NODE_ENV=test`.

Environment overrides:

| Variable                     | Default | Meaning                                                                           |
| ---------------------------- | ------- | --------------------------------------------------------------------------------- |
| `RATE_LIMIT_API_MAX`         | `120`   | Max requests per IP per minute (general API)                                      |
| `RATE_LIMIT_AUTH_MAX`        | `10`    | Max requests per IP per minute (register, login, chat), counted in its own bucket |
| `RATE_LIMIT_REDIS_FAIL_OPEN` | `true`  | When Redis is down, allow traffic (`true`) or reject (`false`)                    |

## Download engagement limits (`archive` + `release` downloads)

Per fingerprint **or** IP (whichever trips first):

| Variable                 | Default | Meaning                        |
| ------------------------ | ------- | ------------------------------ |
| `DOWNLOAD_RATE_PER_HOUR` | `5`     | Max download requests per hour |
| `DOWNLOAD_RATE_PER_DAY`  | `20`    | Max download requests per day  |

Other anti-fraud knobs remain in `DOWNLOAD_NO_COUNT_CIDRS`, `DOWNLOAD_TRUST_OVERRIDE_IPS`, and the download-fraud-scan worker.

## Operational guidance

- **Fail-open (code default):** When `RATE_LIMIT_REDIS_FAIL_OPEN` is unset, the API allows traffic if Redis is down. Acceptable for local/dev and brief Redis restarts in early beta.
- **Fail-closed (production Swarm):** `infra/docker-stack.yml` sets `RATE_LIMIT_REDIS_FAIL_OPEN=false` on `api`. A single Redis replica with AOF is enough for the first ~100 users; treat Redis as required for abuse protection. If Redis is unreachable, `/health` and ops restore Redis before expecting normal API traffic — do not flip back to fail-open except as a short emergency override on the manager (`docker service update --env-add …`).
- Tune download limits down if storage egress spikes; tune up for anchor artists running download campaigns.
