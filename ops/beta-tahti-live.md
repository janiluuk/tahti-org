# beta.tahti.live (Nuclear listen POC)

Public Nuclear × Tahti listen client. **Does not modify** production `tahti.live` stack services.

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

## Redeploy

From the Tahti Nuclear fork:

```bash
cd /home/jani/workspace/tahti-nuclear
pnpm deploy:tahti-beta
```

Details: [`tahti-nuclear/packages/tahti-web/deploy/README.md`](../../tahti-nuclear/packages/tahti-web/deploy/README.md) and [`TAHTI-FORK.md`](../../tahti-nuclear/TAHTI-FORK.md).
