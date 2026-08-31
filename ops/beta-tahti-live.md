# beta.tahti.live (Tahti Player listen POC)

Public [Tahti Player](https://github.com/janiluuk/tahti-player) × Tahti listen client. **Does not modify** production `tahti.live` stack services.

## Live routing

| Layer | Target |
|-------|--------|
| DNS | `beta.tahti.live` → same public IP as `tahti.live` (`91.152.54.76`) |
| Pi4 Nginx Proxy Manager | Proxy Host **#61** → `http://192.168.2.100:15180` (vimage) |
| TLS | Existing wildcard cert `*.tahti.live` (npm-162) |
| Upstream | Docker `tahti-beta-web` on **vimage** `/srv/tahti-beta` |
| Browser API | Same-origin `/tahti-api/` → nginx proxies to **`https://api.tahti.live`** |
| Chat WS | `wss://chat.tahti.live/connection/websocket` |

Wildcard channel host `#55` excludes `beta` so `beta.tahti.live` does not fall through to production web.

> Note: Pi4 may still have a leftover `tahti-beta` on `:15180` (API → LAN `:15011`). NPM no longer points there — safe to `docker stop tahti-beta` on pi4 to avoid confusion.

## Production data

Beta talks to **live** `api.tahti.live` / `chat.tahti.live` / `cdn.tahti.live` (not Pi4, not mocks). Build unsets `VITE_FORCE_MOCK` and `VITE_ALLOW_MOCK_FALLBACK`.

## Auth on beta

Session cookie `tahti_session` is host-only. Log in at **https://beta.tahti.live/login** with a real production account so the cookie is set on `beta.tahti.live` via `/tahti-api` (sessions from `tahti.live` do not carry over).

## Redeploy

From the [Tahti Player repository](https://github.com/janiluuk/tahti-player):

```bash
cd /home/jani/workspace/tahti-nuclear
pnpm deploy:tahti-beta
```

Details: [`tahti-nuclear/packages/tahti-web/deploy/README.md`](../../tahti-nuclear/packages/tahti-web/deploy/README.md) and [`TAHTI-FORK.md`](../../tahti-nuclear/TAHTI-FORK.md).

## Production cutover

When replacing production `apps/web` with this client, follow **[`nuclear-web-cutover.md`](nuclear-web-cutover.md)** → [`CUTOVER.md`](../../tahti-nuclear/packages/tahti-web/CUTOVER.md).
