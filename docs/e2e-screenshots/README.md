# E2E screenshots (Docker stack)

Full-page captures of the Tahti web app against the **Docker stack** (not host `next dev` on :3000).

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

## Ports (defaults)

| Service | URL |
|---------|-----|
| Web | http://localhost:3010 |
| API | http://localhost:3011 |
| MailHog | http://localhost:8025 |

Override with `WEB_PORT` / `API_PORT` when starting the stack.

## Fixture credentials

| Role | Email | Password |
|------|-------|----------|
| Artist | `screenshot-artist@e2e.tahti.live` | `screenshot-demo-pass` |
| Fan | `screenshot-fan@e2e.tahti.live` | `screenshot-demo-pass` |

Username: `screenshot-demo` · Smart link slug: `northern-lights-ep`

See `manifest.json` for route → file mapping.

Copies used on the marketing site (`website/screenshots/`) power the annotated “How it looks” section on [tahti.live](https://tahti.live). Re-copy after re-capturing:

```bash
cp docs/e2e-screenshots/{06,07,08,09,10,11,12}-*.png website/screenshots/
```

Production node layout and scaling bottlenecks: [../scaling-node-distribution.md](../scaling-node-distribution.md).
