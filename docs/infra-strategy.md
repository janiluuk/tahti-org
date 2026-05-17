# Tahti ry — infrastructure strategy

Tahti is a Helsinki-based Finnish nonprofit serving primarily EU listeners. The infrastructure choices reflect three priorities:

1. **EU jurisdiction throughout the stack** — no US cloud, no non-EU CDN, no Atlantic data flow
2. **Cost discipline** — we run primarily on owned hardware; we don't pay rent to AWS, Cloudflare, or Google
3. **Operational resilience** — UpCloud Helsinki provides spillover capacity and DR copy

## Primary: owned hardware in Helsinki

Tahti's primary infrastructure runs on hardware physically owned by the org, racked in Helsinki on business fiber. This includes:

- Postgres 16 (Tahti ry's database of truth)
- Redis 7 (cache, queue, chat state)
- MinIO (object storage for audio, artwork, archive)
- Liquidsoap containers (one per artist channel, plus Tahti Radio)
- Centrifugo (real-time chat + presence)
- Nginx-RTMP (live ingest from OBS)
- Icecast2 (live ingest from Mixxx/Traktor/butt)
- Caddy (edge TLS termination + reverse proxy)

**Business fiber:**
- Y1-Y2: symmetric gigabit (1 Gbps up/down) from a Helsinki business provider (Elisa or DNA). Cost: €200-400/month.
- Y3: upgrade to 10 Gbps symmetric when concurrent listeners and FLAC streaming push the gigabit pipe to saturation. Cost: €1,500-3,000/month at Helsinki rates.

**Hardware refresh:**
- Initial capex amortized over 5 years
- Y2 storage capacity expansion (€3,000)
- Y3 storage + compute upgrade (€6,000)
- Tracked in `docs/financial-model.md`

## Secondary: UpCloud Helsinki

[UpCloud](https://upcloud.com/) is a Finnish-owned, Helsinki-headquartered cloud provider. We use them for:

- **Static content spillover** — when owned-hardware pipe is saturated, HLS segments and archive downloads can be served from UpCloud edge
- **DR origin** — daily replica of MinIO bucket; if primary infrastructure fails, UpCloud becomes the read-only origin while we recover
- **Tahti Radio publishing** — meta-stream HLS output published to UpCloud so we don't compete with channel traffic on the same pipe
- **Embed widget serving** — the ~25 KB embed assets cached on UpCloud (since they're hit from random external sites)

**Why UpCloud:**
- Finnish-owned (legitimate "all-Finnish infrastructure" story for grants)
- Helsinki data center (low latency for primary EU audience)
- EU-jurisdiction (no US data transfer concerns)
- Strong DPA — already signed with major Finnish tech companies
- Transparent per-GB pricing with no surprise overage charges
- Public roadmap, real customer support, not a hyperscaler with 4-month ticket SLAs

**What UpCloud isn't:**
- Not a CDN. They have a Helsinki PoP. A listener in Madrid gets ~30ms higher latency from us than from a CDN. For our scale this is acceptable.
- Not cheap at high egress volumes (their per-GB rate kicks in above included transfer). The financial model assumes ~€400/month at Y3 scale; if egress climbs significantly above forecast, this rises.

## What we don't use

**No CDN.** Bunny, Fastly, Cloudflare, BlazingCDN, AWS CloudFront — none. The savings (~€5-10k/yr at Y3 scale via Bunny vs UpCloud) come at the cost of:
- US-jurisdiction touchpoints (most CDNs except Bunny are US-headquartered)
- Contractual lock-in to a third-party network provider
- A line item in the budget that grant officers will ask about
- A "we depend on Cloudflare" narrative that doesn't fit a Finnish nonprofit

**No AWS / GCP / Azure.** Not for orchestration, not for storage, not for compute. Pure-cloud isn't bad for many businesses; it's bad for Tahti's particular story.

**No Cloudflare.** They run a critical-mass amount of the open web through US-jurisdiction edge nodes; even with their EU Compliant offerings, the political and contractual posture is wrong for a Finnish nonprofit positioning around digital sovereignty.

**No third-party analytics.** Privacy-respecting, first-party analytics only (anonymized IP hashes, rotating salts, no fingerprinting beyond what's required for chat moderation).

## Bandwidth math at scale

This is the operational constraint that drives the Y3 fiber upgrade.

At Y3 scale (4,000 paid + 12,000 free users):

**Paid users** stream FLAC 16/44 (~800 kbps average):
- Assumed listener-hours: ~35M/year
- Bandwidth required: ~12,600 TB/year (~12.6 PB)

**Free users** stream MP3 192 kbps:
- Assumed listener-hours: ~12M/year
- Bandwidth required: ~1,037 TB/year (~1 PB)

**Total: ~13.6 PB/year egress**

A 1 Gbps symmetric pipe theoretical max: ~3.9 PB/year (at 100% utilization, which is unrealistic — practical max ~60% sustained = ~2.4 PB/yr).

So Y3 needs roughly **5× more bandwidth than a gigabit pipe can deliver.**

Options:
- **10 Gbps business fiber** (modeled): delivers 39.5 PB/year theoretical, ~24 PB/year practical. Comfortable headroom.
- **CDN deployment**: would cost ~€8-12k/yr via Bunny at this volume. Saves on fiber.
- **Hybrid via UpCloud**: route portion of egress through UpCloud's Helsinki PoP; cost scales with bandwidth.

The current plan is 10 Gbps fiber. If the contract terms in 2027 are unfavorable (Helsinki business fiber pricing changes), the org should revisit the CDN decision at AGM.

## Backups and DR

- **Postgres**: pgBackRest to off-site Finnish hosting (UpCloud or aligned partner). RPO: 1 hour. RTO: 4 hours.
- **MinIO**: `mc mirror` to UpCloud bucket daily. RPO: 24 hours. RTO: 8 hours.
- **Configuration**: GitOps in a private repo on a Finnish-hosted GitLab instance (or self-hosted Gitea).
- **Disaster scenario**: primary hardware fails → UpCloud becomes read-only origin; new artists can sign up (writes go to UpCloud Postgres replica), broadcasting paused until primary recovered.

The DR plan is documented in detail in the operations runbook (not part of this package — agent generates during M11 hardening).

## GDPR posture

- All processors in EU jurisdiction
- DPA signed with UpCloud before launch (template available)
- DPA signed with Stripe, Postmark/SES (transactional email), Mixcloud (live streaming partner)
- Internal data-processor registry maintained at `internal/data-processors.md`
- Public privacy policy lists all processors and what data they see

## Why this matters for the funding story

When applying to Business Finland Tempo, Koneen Säätiö, Suomen Kulttuurirahasto, or Creative Europe, the infrastructure story matters:

- **"We are a Finnish nonprofit running on Finnish infrastructure"** — concrete, verifiable, narratively coherent
- **"No US cloud, no global CDN"** — significant differentiator from typical SaaS pitches
- **"All listener data stays in EU jurisdiction"** — easier GDPR conversation with reviewers
- **"Bandwidth costs are line-itemed and predictable"** — finance committees can read this

This isn't aesthetic. It changes how grant officers and board candidates perceive the org's seriousness about its mission.
