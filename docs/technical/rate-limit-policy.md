# Rate limiting policy

## Global API limits (`apps/api/src/plugins/rate-limit.ts`)

- Default: **120 requests / minute / IP** for most routes.
- Auth and chat token routes: **10 requests / minute / IP**.
- Disabled when `NODE_ENV=test`.

Environment overrides:

| Variable | Default | Meaning |
|---|---|---|
| `RATE_LIMIT_API_MAX` | `120` | Max requests per IP per minute (general API) |
| `RATE_LIMIT_AUTH_MAX` | `10` | Max requests per IP per minute (register, login, chat) |
| `RATE_LIMIT_REDIS_FAIL_OPEN` | `true` | When Redis is down, allow traffic (`true`) or reject (`false`) |

## Download engagement limits (`archive` + `release` downloads)

Per fingerprint **or** IP (whichever trips first):

| Variable | Default | Meaning |
|---|---|---|
| `DOWNLOAD_RATE_PER_HOUR` | `5` | Max download requests per hour |
| `DOWNLOAD_RATE_PER_DAY` | `20` | Max download requests per day |

Other anti-fraud knobs remain in `DOWNLOAD_NO_COUNT_CIDRS`, `DOWNLOAD_TRUST_OVERRIDE_IPS`, and the download-fraud-scan worker.

## Operational guidance

- **Fail-open (default):** API stays available if Redis restarts; brief abuse window is acceptable for a nonprofit beta.
- **Fail-closed:** Set `RATE_LIMIT_REDIS_FAIL_OPEN=false` in production once Redis HA is proven and on-call can fix Redis quickly.
- Tune download limits down if storage egress spikes; tune up for anchor artists running download campaigns.
