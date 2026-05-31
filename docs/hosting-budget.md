# Tahti ry — hosting budget and provider comparison

Current strategy: **owned hardware in Finnish colocation** as the primary, **UpCloud Helsinki** as secondary/DR. This document prices out the current setup, the Hetzner Helsinki alternative, and the bandwidth inflection points where choices change.

See also: `docs/infra-strategy.md` for the reasoning behind the no-CDN, Finnish-jurisdiction approach.

---

## Y1 hosting cost baseline (current plan)

### Owned hardware — capex

| Item | Qty | Unit cost | Total |
|------|-----|-----------|-------|
| Server (Supermicro, 64 GB ECC, 8-core Xeon) | 2 | €1,800 | €3,600 |
| NVMe storage (4× 2TB Samsung 990 Pro) | 2 sets | €700 | €1,400 |
| 10 GbE switch (Mikrotik CRS309) | 1 | €350 | €350 |
| UPS (APC Smart-UPS 750VA) | 1 | €400 | €400 |
| Cabling, rack unit, misc | — | — | €250 |
| **Y1 hardware capex total** | | | **€6,000** |

Amortized over 5 years: **€100/month equivalent**.

### Finnish colocation — opex

Colocation in Helsinki (Equinix HE5, Telia Helsinki, or comparable):

| Item | Monthly | Annual |
|------|---------|--------|
| 1U rack space (2 servers) | €150 | €1,800 |
| Power (2× 350W servers, 24/7) | €80 | €960 |
| Remote hands (quarterly, est.) | €40 avg | €480 |
| **Colo subtotal** | **€270** | **€3,240** |

### Business fiber

| Tier | Provider | Monthly | Suitable for |
|------|----------|---------|--------------|
| 1 Gbps symmetric | Elisa Yritys / DNA Business | €200–350 | Y1–Y2 |
| 10 Gbps symmetric | Elisa Yritys / Telia | €1,500–2,500 | Y3+ |

Use 1 Gbps for Y1-Y2. Lock in a 10 Gbps quote before Month 24 (negotiation window).

### UpCloud Helsinki — opex

UpCloud pricing is usage-based. Projected Y1 costs:

| Use case | Config | Monthly | Annual |
|----------|--------|---------|--------|
| DR Postgres replica | 2 vCPU / 4 GB, 80 GB SSD | €25 | €300 |
| MinIO mirror bucket | Object storage, ~500 GB | €15 | €180 |
| Tahti Radio HLS spillover | Maximal Storage S1, ~1 TB transfer | €20 | €240 |
| **UpCloud subtotal** | | **€60** | **€720** |

### Y1 total hosting (owned hardware path)

| Line item | Monthly | Annual |
|-----------|---------|--------|
| Hardware capex amortized | €100 | €1,200 |
| Colocation (rack + power) | €270 | €3,240 |
| Business fiber (1 Gbps) | €275 avg | €3,300 |
| UpCloud secondary | €60 | €720 |
| **Total** | **€705** | **€8,460** |

---

## Hetzner Helsinki alternative

[Hetzner](https://www.hetzner.com/) operates a Helsinki data center (HEL1, opened 2022). It is German-owned and EU-based — GDPR posture is equivalent to UpCloud.

### Hetzner dedicated servers (HEL1)

| Server | Specs | Monthly |
|--------|-------|---------|
| AX41-NVMe | AMD Ryzen 5 3600, 64 GB, 2× 512 GB NVMe | **€43** |
| AX52 | AMD Ryzen 9 3900, 128 GB, 2× 960 GB NVMe | **€68** |
| AX102 | AMD Ryzen 9 5950X, 128 GB, 2× 1.92 TB NVMe | **€109** |

Hetzner HEL1 includes **20 TB of traffic** per server per month free; additional bandwidth at €1/TB. This is substantially more generous than UpCloud's included transfer.

### Hetzner-primary scenario (Y1)

| Line item | Monthly | Annual | vs. colo plan |
|-----------|---------|--------|---------------|
| 2× AX52 (DB + worker nodes) | €136 | €1,632 | saves €4,068 |
| 1× AX41 (edge + ingest) | €43 | €516 | — |
| Business fiber (unnecessary — Hetzner provides uplink) | €0 | €0 | saves €3,300 |
| Hardware capex (none — leased hardware) | €0 | €0 | saves €6,000 capex |
| UpCloud secondary / backup | €60 | €720 | same |
| **Hetzner total** | **€239** | **€2,868** | **saves €5,592/yr** |

**Trade-offs of Hetzner:**

| Factor | Owned colo | Hetzner HEL1 |
|--------|-----------|--------------|
| Monthly opex | €705 | €239 |
| Upfront capex | €6,000 | €0 |
| Control over hardware | Full | None (lease) |
| "Finnish infrastructure" grant narrative | Strong (Finnish colo) | Weaker (German company) |
| Network performance (Helsinki) | 1 Gbps owned | 1 Gbps shared uplink |
| Scalability | Limited by hardware | Add servers in minutes |
| DPA available | Via colo provider | Yes, Hetzner EU DPA |
| Suitable for Koneen Säätiö / SKR grant application | Yes | Marginal — explain German ownership |

**Recommendation:** start on **Hetzner HEL1** while Y1 cash is tight, with the intent to migrate to owned Helsinki colo hardware in Y2 when grant funding is secured and the "Finnish infrastructure" narrative becomes a material grant requirement. The two setups use identical Docker Swarm orchestration — migration is a data transfer, not an architecture change.

---

## Bandwidth cost at scale

At different growth milestones, the egress picture changes materially:

| Stage | Members | Listener-hours/yr | Egress (FLAC avg 800 kbps) | Colo fiber | Hetzner (at €1/TB overage) |
|-------|---------|------------------|---------------------------|------------|---------------------------|
| Y1 beta | 200 | ~400k | ~128 TB | Within 1 Gbps | Within 20 TB/server free |
| Y1 public | 500 | ~1M | ~320 TB | Within 1 Gbps | ~€300 overage |
| Y2 | 1,200 | ~4M | ~1,280 TB | ~50% pipe util | ~€1,260 overage |
| Y3 | 4,000 | ~20M | ~6,400 TB | **Needs 10 Gbps** | ~€6,400 overage → evaluate CDN |

### Y3 options comparison

At Y3 scale (6.4 PB/year egress):

| Option | Monthly | Annual | Notes |
|--------|---------|--------|-------|
| 10 Gbps Finnish colo fiber | €1,500–2,500 | €18,000–30,000 | Highest control |
| Hetzner + bandwidth | €239 + €530/month overage | ~€9,240 | Cheaper but German |
| UpCloud spillover (partial) | €200–400 spillover | +€2,400–4,800 | Hybrid approach |
| Bunny CDN (Finnish PoP) | ~€800/month at 6.4 PB | €9,600 | Breaks Finnish-infra story |

At Y3, the 10 Gbps colo fiber is the right long-term move if grants have landed. If Y3 is tighter than forecast, Hetzner + bandwidth is the pragmatic fallback.

---

## Decision matrix

| Situation | Recommendation |
|-----------|---------------|
| Y1, grant-funded, grants emphasise Finnish origin | Own colo + 1 Gbps fiber |
| Y1, bootstrapped / grants pending | Hetzner HEL1 (migrate in Y2) |
| Y2, scaling, >50% fiber utilization | Add UpCloud spillover |
| Y3, Hetzner bandwidth cost exceeds €1k/month | Migrate to Finnish 10 Gbps colo |
| Any time, grant narrative requires Finnish infrastructure | Must use Finnish colo (not Hetzner) |

---

## Summary

| Path | Y1 opex | Y1 capex | Y3 opex | Finnish infra claim |
|------|---------|---------|---------|---------------------|
| Owned colo (current plan) | €8,460 | €6,000 | ~€25,000 | Strong |
| Hetzner HEL1 | €2,868 | €0 | ~€12,000 | Marginal |
| Hetzner Y1 → colo Y2 | €2,868 / €8,460 | €6,000 in Y2 | ~€25,000 | Strong from Y2 |

**Current working assumption:** start on Hetzner HEL1, plan colo migration for Y2 when operational grant covers capex. Update this decision at the founding board meeting based on actual grant outcome.
