# E2E screenshots (Docker stack)

Full-page captures of the Tahti **web app** (`apps/web`) against the **Docker stack** (not host `next dev` on :3000).

**Canonical location:** commit updated PNGs here only. Agents must **not** copy these into `website/` — the marketing site (`website/`) is off limits unless the user explicitly requests it (see `.cursor/rules/website-off-limits.mdc`).

## Layout

Screenshots are grouped by role:

| Folder | Auth | Description |
|--------|------|-------------|
| `public/` | None | Marketing, channel, profile, help, transparency |
| `free/` | Free listener | Verified account, no €40 membership |
| `member/` | Member (supporter) | Member dashboard + governance |
| `artist/` | Artist channel owner | Full studio dashboard, stats, stash, editor |
| `admin/` | Board (`isBoard`) | Admin console (all nav sections) |
| `journey/` | Fresh artist + admin | Empty account → channel → releases (Playwright journey) |

See `manifest.json` for the full route → file mapping — 87 views as of the July 2026 audit
(see `../design-audit-2026-07.md`), covering every `/dashboard/settings/*` sub-page,
collections, archive, upload, revenue, releases, and most admin routes. Known remaining
gaps (routes needing seed data or dynamic-ID lookups the capture script doesn't do yet):
`/dashboard/moderate/[slug]`, `/v/[slug]`, `/admin/users/[id]`, `/admin/support/[id]`,
`/dashboard/upload/[uploadId]` and its import sub-flows.

## When to update (agents)

After meaningful **UI** changes on public, dashboard, governance, or admin surfaces:

1. Run the capture flow below on a machine with Docker.
2. Commit changed PNGs under `docs/e2e-screenshots/` and `manifest.json` if routes changed.
3. Do **not** touch `website/screenshots/` unless the user asks.

## Reproduce (local only — not CI)

```bash
./scripts/e2e-screenshots.sh    # stack up, seed, capture all pages
./scripts/stack-up.sh --down    # tear down
```

Or step by step:

```bash
./scripts/stack-up.sh --seed
WEB_PORT=17777 API_PORT=15011 ./scripts/stack-screenshots.sh
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
| Member | `screenshot-fan@e2e.tahti.live` | `screenshot-demo-pass` |
| Free listener | `screenshot-free@e2e.tahti.live` | `screenshot-demo-pass` |
| Board admin | `screenshot-board@e2e.tahti.live` | `screenshot-demo-pass` |
| Fresh artist (no channel) | `screenshot-fresh@e2e.tahti.live` | `screenshot-demo-pass` |

Username: `screenshot-demo` · Collection: `demo-mixes` · Smart link: `northern-lights-ep`

### Fresh artist journey (Playwright)

Empty verified account → channel provision → album + EP + single uploads. Captures
screenshots under `journey/` (artist + admin login):

```bash
./scripts/stack-up.sh --seed
WEB_PORT=17777 API_PORT=15011 node tests/e2e/fresh-artist-journey.mjs
```

Or after `./scripts/e2e-screenshots.sh`, run the journey script with the same ports.

Seeded channel includes a **next live broadcast** schedule (`2026-07-10T20:00:00Z`) so the
Archive countdown and dashboard schedule preview appear in captures.

Linked from `docs/user-flows.md`.

Production node layout and scaling bottlenecks: [../scaling-node-distribution.md](../scaling-node-distribution.md).
