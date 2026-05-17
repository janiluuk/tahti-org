# Replay ry — CDN strategy (European-first)

Replay is a Helsinki-based Finnish nonprofit serving primarily EU listeners.
Our CDN strategy is European-first for two reasons:

1. **Latency** — most listeners are in the EU; routing through US PoPs adds 80-150 ms
2. **GDPR** — every CDN sees listener IP addresses, which are personal data
   under GDPR; the data-processor agreement (DPA) and the operational
   posture of the CDN vendor matters

## Primary: Bunny CDN

[bunny.net](https://bunny.net) — Slovenia-headquartered, dense European PoP
network, transparent per-GB pricing, no minimum spend.

**Why primary:**
- EU-headquartered company (under GDPR jurisdiction directly)
- Strong EU PoP coverage: Frankfurt, Amsterdam, London, Stockholm, Helsinki,
  Madrid, Milan, Warsaw, Bucharest, etc. — every major EU population center
- Pull-zone model: we configure once, Bunny pulls from MinIO origin and caches
  globally
- Pricing: ~€0.005/GB EU bandwidth — sustainable for our scale
- **Standard DPA available** — they publish their template at
  bunny.net/legal/dpa — signed before launch
- AGPL-compatible: no contractual restrictions on operating an open-source
  service through them
- Real-time bandwidth and request analytics in their dashboard
- Token-based authentication for signed URLs (useful for private downloads
  on fan-sub-only content if we add that)

**What Bunny CDN serves:**
- HLS streams from per-channel Liquidsoap containers
- Static archive items (downloads of tracks, mixes)
- Profile cover art and release artwork
- Embed widget assets (~25 KB total, cached aggressively)
- Smart link landing page assets

**What it doesn't serve:**
- API responses (those route through Caddy directly, not cacheable)
- Stripe/payment flows (security-sensitive, no CDN intermediary)
- Centrifugo WebSocket connections (real-time, no CDN)

**Y3 cost estimate:** ~€1,500/yr (already in the financial model as
`cdn` and `embed_cdn` lines).

## Secondary: BlazingCDN (budget for non-critical assets)

[blazingcdn.com](https://blazingcdn.com) — Latvia-headquartered, also EU-jurisdiction,
even cheaper than Bunny for cold/non-critical content.

**Why secondary:**
- Use for less-trafficked assets (older archive items, low-volume venue photos)
  where Bunny's already-fine pricing is overkill
- Functions as a cost-control valve if Bunny pricing changes
- Adds redundancy: if Bunny has an outage we can manually fail over

**Caveats:**
- Smaller PoP network than Bunny
- DPA available but less polished — review with our lawyer before signing
- Less proven at our scale, so we use them for non-critical paths only

**Y3 cost estimate:** ~€300/yr if used at all (might not be necessary).

## Tertiary, Y3+ only: Fastly with EU-only routing

[fastly.com](https://fastly.com) — US-headquartered but with strong EU
presence and a "Compliant Cloud" offering that restricts processing to EU
PoPs.

**When to consider:**
- Only if our Y3+ scale exceeds Bunny's reliability or Bunny pricing changes
  materially
- When we need VCL-based programmatic control over edge logic (Fastly's
  killer feature)
- For specific compliance reasons (some grant programs require certain
  vendor certifications)

**Caveats:**
- US-jurisdiction parent company; even with Compliant Cloud, this is a
  political-sensitivity issue for some grant programs
- Pricing is enterprise-tier (~10× Bunny per GB at typical volumes)
- Not appropriate for general use; only as a specific tactical add-on

## What we explicitly don't use

- **Cloudflare** — US-jurisdiction; CDN business model fundamentally
  ad-network-aligned; DPA available but operational signals (free tier
  monetization, dependency lock-in concerns) make us cautious. Not banned, but
  not first choice.
- **AWS CloudFront** — US-jurisdiction; Amazon as parent makes some grant
  programs nervous; pricing not competitive for our shape.
- **Google Cloud CDN** — same concerns as Cloudfront, plus Google's
  general posture on data-collection that doesn't align with our positioning.

## GDPR + DPA implementation

Every CDN we use needs:

1. **A signed DPA** — keeps us GDPR-clean as the data controller delegating
   processing to the CDN. We sign these before going live; the bylaws (§9)
   require it.

2. **Documented in our internal data-processor registry** — the registry is
   a markdown file `internal/data-processors.md` listing every vendor that
   sees personal data, what data they see, what country they process in, what
   DPA we have signed.

3. **Listed in our public privacy policy** — visitors should know that their
   IP touches a Bunny PoP when they listen.

4. **Verified TLS termination at the edge** — never serve listener content
   over plain HTTP, even via CDN. Bunny does HSTS by default.

5. **No third-party analytics injected via CDN** — never use Bunny's
   "optional" analytics overlays; we have our own first-party analytics that
   are privacy-respecting.

## Operational notes

- Origin shield enabled in Bunny — reduces origin (MinIO) requests dramatically
- Cache TTLs:
  - HLS segments: 2 seconds (live), 24 hours (archived broadcasts)
  - HLS manifests: 2 seconds (live), 1 hour (archived)
  - Track files (downloads): 30 days
  - Artwork / cover images: 30 days, immutable URLs
  - Embed widget assets: 1 hour
- Cache key normalization: query strings stripped except known-good params
- HTTPS-only at edge; cleartext disabled
- Robots.txt: allows indexing of public profile/release pages, disallows
  private API endpoints

## What changes for the Replay Radio meta-stream

Replay Radio's HLS is served via Bunny too. Mixcloud Live is its own
infrastructure — we just push RTMP to them and they handle distribution.

## What changes for fan-sub-only downloads

For downloads gated to fan-subscribers (FLAC, source files), we use Bunny's
**Token Authentication**:
- API generates a short-lived (5 min) signed URL after auth check
- Bunny edge validates the signature before serving the file
- Prevents URL-sharing of paid content
- Free downloads (Opus 256 derivatives) use plain unsigned URLs since they're
  legitimately public

## Y3 cost recap

| Line | Cost |
|---|---|
| CDN (Bunny) — base | €1,500 |
| Embed widget CDN | €1,500 (included in Bunny line) |
| Downloads bandwidth | €3,000 |
| **Total Bunny spend** | **~€6,000/yr** |

Modeled accordingly in `docs/financial-model.md`.
