# E2E screenshots (Docker stack)

Full-page captures of the Tahti **web app** (`apps/web`) against the **Docker stack** (not host `next dev` on :3000).

**Canonical location:** commit updated PNGs here only. Agents must **not** copy these into `website/` — the marketing site (`website/`) is off limits unless the user explicitly requests it (see `.cursor/rules/website-off-limits.mdc`).

## When to update (agents)

After meaningful **public UI** changes (layouts, brand shells, auth, channel, profile, dashboard, governance, transparency):

1. Run the capture flow below on a machine with Docker.
2. Commit changed files under `docs/e2e-screenshots/` (PNG + `manifest.json` if routes changed).
3. Do **not** touch `website/screenshots/` unless the user asks.

## Reproduce (local only — not CI)

```bash
./scripts/e2e-screenshots.sh    # stack up, seed, capture all pages
./scripts/stack-up.sh --down    # tear down
```

Or step by step:

```bash
./scripts/stack-up.sh --seed
./scripts/stack-screenshots.sh
```

Via Make: `make e2e-screenshots`

CI runs lint, tests, and `tests/e2e/vital-flows.sh` — not Playwright screenshots.

## Ports (stack defaults)

| Service | URL |
|---------|-----|
| Web | http://localhost:17777 |
| API | http://localhost:15011 |
| MailHog | http://localhost:18025 |

(`stack-up.sh` uses high ports to avoid clashing with local dev. Override with `WEB_PORT` / `API_PORT`.)

## Fixture credentials

| Role | Email | Password |
|------|-------|----------|
| Artist | `screenshot-artist@e2e.tahti.live` | `screenshot-demo-pass` |
| Fan | `screenshot-fan@e2e.tahti.live` | `screenshot-demo-pass` |

Username: `screenshot-demo` · Smart link slug: `northern-lights-ep`

See `manifest.json` for route → file mapping. Linked from `docs/user-flows.md`.

Production node layout and scaling bottlenecks: [../scaling-node-distribution.md](../scaling-node-distribution.md).
