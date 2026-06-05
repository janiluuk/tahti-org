# Ingest DNS failover (STREAM-003)

Low TTL on ingest hostnames lets OBS/Mixxx pick up surviving nodes quickly after a replica failure. **Health-ranked `fallbackServers`** on `GET /api/me/stream-settings` lets clients switch without waiting for DNS when the dashboard credentials are refreshed.

## Records (production)

| Hostname | Type | Target | TTL |
|----------|------|--------|-----|
| `ingest.tahti.live` | A | Swarm node `ingest_id=a` public IP | **5–30s** |
| `ingest-b.tahti.live` | A | Swarm node `ingest_id=b` public IP | **5–30s** |
| `ingest-icecast.tahti.live` | A/CNAME | Caddy edge (or node A) | 300 |
| `ingest-icecast-b.tahti.live` | A/CNAME | Caddy edge (or node B) | 300 |

RTMP uses raw TCP (port 1935) on each ingest node — Caddy cannot proxy it; DNS must point directly at the node IPs.

Icecast uses HTTPS via Caddy (`ingest-icecast*.tahti.live` → overlay `icecast` / `icecast-b`).

## Recommended TTL

- **RTMP ingest A records:** start at **30s** during rollout, lower to **5s** once both replicas are stable.
- **Do not** use TTL &gt; 60s on RTMP failover names — dead-node connections linger until TTL expiry.

## Client behaviour

1. OBS reads `server` + `fallbackServers` from stream settings (health-probed every ~10s on API).
2. On connect failure, OBS tries the next URL in its server list (faster than DNS alone).
3. Existing sessions on a failed node must reconnect manually or via OBS auto-reconnect.

## Verification

```bash
# Health probes (from any host with network access)
curl -sf https://ingest-icecast.tahti.live/status-json.xsl | head
curl -sf https://ingest-icecast-b.tahti.live/status-json.xsl | head
curl -sf http://ingest.tahti.live:8080/health
curl -sf http://ingest-b.tahti.live:8080/health

# API stream settings (authenticated)
curl -sf -H "Cookie: tahti_session=…" https://api.tahti.live/api/me/stream-settings | jq '.rtmp,.icecast'
```

See also `ops/RUNBOOK.md` (ingest env) and `infra/docker-stack.yml` (`icecast-b`, `rtmp-ingest-b`).
