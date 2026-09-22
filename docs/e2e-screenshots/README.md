# E2E screenshots (Docker stack)

Full-page captures of the Tahti **web app** (`apps/web`) against the **Docker stack** (not host `next dev` on :3000).

**Canonical location:** commit updated PNGs here only. Agents must **not** copy these into `website/` — the marketing site (`website/`) is off limits unless the user explicitly requests it (see `.cursor/rules/website-off-limits.mdc`).

## Layout

The per-route captures (`manifest.json`-driven, `scripts/capture-e2e-screenshots.mjs`)
are still grouped by the older 5-role model:

| Folder    | Auth                 | Description                                     |
| --------- | -------------------- | ----------------------------------------------- |
| `public/` | None                 | Marketing, channel, profile, help, transparency |
| `free/`   | Free listener        | Verified account, no €40 membership             |
| `member/` | Member (supporter)   | Member dashboard + governance                   |
| `artist/` | Artist channel owner | Full studio dashboard, stats, stash, editor     |
| `admin/`  | Board (`isBoard`)    | Admin console (all nav sections)                |

See `manifest.json` for the full route → file mapping. The 20 board-admin
captures there are annotated with the role, route, admin navigation, main
workspace, and page heading so they can be reviewed without opening the app.
Known remaining gaps (routes needing seed data or dynamic-ID lookups the
capture script doesn't do yet): `/dashboard/moderate/[slug]`, `/v/[slug]`,
`/admin/users/[id]`, `/admin/support/[id]`, `/dashboard/upload/[uploadId]` and
its import sub-flows.

### Category journeys (4 categories, light + dark)

`tests/e2e/` is organized into 4 categories matching the product's actual
roles — **anonymous**, **listener**, **artist**, **admin**. Each has a
Playwright screenshot journey walking a real user flow end to end, captured
at 3440×1440 in both light and dark `prefers-color-scheme` (the browser's own
media feature — **not** the product's per-artist channel theme picker under
`/admin/themes` / `/dashboard/channel/edit`, which is unrelated branding):

| Folder                            | Journey                                                                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `anonymous/journey/{light,dark}/` | Home → listen hub → channel → profile → transparency → signup                                                                                   |
| `listener/journey/{light,dark}/`  | Login → dashboard → governance → channel → fan-tier subscribe (buy side of paid content)                                                        |
| `artist/journey/{light,dark}/`    | Login → dashboard → setup wizard → broadcast studio → catalog → fan-subs settings (sell side of paid content) → public channel → admin verifies |
| `admin/journey/{light,dark}/`     | Login → admin dashboard → users → content reports → financial → governance → grants                                                             |

Run all 4 with one command — see [`docs/testing.md`](../testing.md#e2e-journey-screenshots-4-categories)
or:

```bash
./scripts/run-e2e-journeys.sh
```

## When to update (agents)

After meaningful **UI** changes on public, dashboard, governance, or admin surfaces:

1. Run the capture flow below on a machine with Docker.
2. For annotated board-admin captures, use the admin-only command below.
3. Commit changed PNGs under `docs/e2e-screenshots/` and `manifest.json` if routes changed.
4. Do **not** touch `website/screenshots/` unless the user asks.

### Annotated admin capture

This regenerates every manifest-defined admin page as the seeded board account and
keeps the rest of the persona captures untouched:

```bash
./scripts/stack-up.sh --seed
SCREENSHOT_ROLES=admin ANNOTATE_ADMIN_SCREENSHOTS=1 \
  APP_URL=http://localhost:17777 API_URL=http://localhost:15011 \
  node scripts/capture-e2e-screenshots.mjs
```

`ANNOTATE_ADMIN_SCREENSHOTS=1` changes only the temporary Playwright page before
capture; it does not add annotation UI to the product.

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

| Service | URL                    |
| ------- | ---------------------- |
| Web     | http://localhost:17777 |
| API     | http://localhost:15011 |
| MailHog | http://localhost:18025 |

(`stack-up.sh` uses high ports to avoid clashing with local dev. Override with `WEB_PORT` / `API_PORT`.)

## Fixture credentials

| Role                      | Email                              | Password               |
| ------------------------- | ---------------------------------- | ---------------------- |
| Artist                    | `screenshot-artist@e2e.tahti.live` | `screenshot-demo-pass` |
| Member                    | `screenshot-fan@e2e.tahti.live`    | `screenshot-demo-pass` |
| Free listener             | `screenshot-free@e2e.tahti.live`   | `screenshot-demo-pass` |
| Board admin               | `screenshot-board@e2e.tahti.live`  | `screenshot-demo-pass` |
| Fresh artist (no channel) | `screenshot-fresh@e2e.tahti.live`  | `screenshot-demo-pass` |

Username: `screenshot-demo` · Collection: `demo-mixes` · Smart link: `northern-lights-ep`

### Fresh artist journey (Playwright)

Empty verified account → **UI login** → setup-channel wizard (5 steps) → broadcast
studio → album + EP + single uploads → fan-subs settings → public channel → admin
verifies. Captures screenshots under `artist/journey/{light,dark}/` (artist + admin
login first, so wizard and broadcasting pages are authenticated — not a login wall):

```bash
./scripts/stack-up.sh --seed
WEB_PORT=17777 API_PORT=15011 node tests/e2e/artist/fresh-artist-journey.mjs
```

Or run `./scripts/run-e2e-journeys.sh artist` for the fast local-dev path (no Docker
web/api build required). Key shots: `02-setup-channel.png` (wizard step 1),
`03-broadcast-studio.png` (go-live studio), `04b-fan-subs-settings.png` (sell side of
paid content — pairs with `listener/journey/*/05-fan-tier-subscribe.png`, the buy side).

Seeded channel includes a **next live broadcast** schedule (`2026-07-10T20:00:00Z`) so the
Archive countdown and dashboard schedule preview appear in captures.

Linked from [`docs/flows/`](../flows/README.md) (canonical persona packs) and [`docs/user-flows.md`](../user-flows.md).

Production node layout and scaling bottlenecks: [../scaling-node-distribution.md](../scaling-node-distribution.md).
