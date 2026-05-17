# Tahti ry — financial model

Reference date: May 2026. Self-hosted in Helsinki.

**Pricing:** free-tier artist (no fee) or paying artist (€40/yr).  
**Legal form:** Finnish *yhdistys* (nonprofit association).  
**Surplus:** distributed annually as artist grants, weighted by engagement units.

## Overview

Tahti is a **member-owned** broadcasting platform. Paying artists are members of
Tahti ry; membership fees fund running the service. Foundation grants bridge the
early years until enough members join. Operating surplus (after costs and a
small reserve) returns to artists as grants.

**Income streams:**

1. Membership subscriptions (€40/yr per paying artist)
2. Distribution fees (Revelator pass-through — artist-paid per release)
3. DSP referral (DistroKid affiliate)
4. Foundation grants (Business Finland, Koneen, SKR, Creative Europe)
5. Donations
6. Fan-sub operational fee (2% of fan-sub gross — covers Stripe and compliance only)

## Pricing tiers

### Free-tier artist
- 1 channel + 1 profile page
- **Pro audio editor** (full in-browser multitrack editor — see `docs/audio-editor.md`)
- Up to 5 archive items
- Live broadcasting (Icecast, RTMP, browser)
- Basic chat
- Embed widget (with Tahti attribution)
- Smart link auto-generated
- Channel auto-archives if no broadcast in 60 days

### Paying artist — €40/year

**Design target:** one membership should cover that artist's share of **running
the service** at steady state — hosting, bandwidth, email, chat, transcoding,
and ops — on **owned hardware and in-house software**. Early years also rely on
foundation grants; at scale, memberships carry platform, governance, and
operations with headroom for grants.

- Everything in free tier, plus:
- Unlimited archive
- Unlimited releases on profile
- Auto-archive every live set
- 1 multistream destination (Mixcloud Live)
- Mixcloud auto-upload
- Pinned announcements + chat moderation
- Pay-per-release DSP distribution (€8 each)
- Newsletter (up to 4 sends per week)
- Social auto-post
- Track-level analytics
- Fan-subs and downloads
- **Member of Tahti ry** — vote at AGM, eligible for annual grants

### Fan-supporter (listener side)
- Pays €1–€100/month directly to a specific artist
- Subscriber badge in chat, FLAC downloads, optional fan-only chat/newsletter
- Org takes 0% cut; ~2% operational fee covers payment processing only

## Unit economics — why €40/yr works with in-house tech

| Bucket | What it includes | At 4,000 members (Y3) | Per member |
|---|---|---|---|
| **Platform** | Servers, fiber, power, CDN spillover, chat, fan-subs, downloads, Tahti Radio, email | ~€53,500 | **~€13** |
| **Governance** | Legal, accountant, audit, board admin | ~€18,000 | **~€5** |
| **Operations** | Director / trained staff | €45,000 | **~€11** |
| **Pass-through** | Revelator per-release, Stripe on subs | (artist-paid) | — |

**In-house stack:** Liquidsoap, MinIO, Postgres, Centrifugo, FFmpeg workers on
owned Helsinki hardware. SaaS only where unavoidable (Stripe, email, Revelator).

**Break-even (subscriptions only):** at the Year 3 cost profile, roughly
**~2,960 paying artists** cover platform + governance + operations. At **4,000
members**, subscriptions leave headroom for the annual grant pool.

**Years 1–2** need grant bridge funding (~€19.5k deficit in Year 1) until the
member base scales — expected, not a pricing failure.

## Three-year projection

### Assumptions
- Year 1: 200 paying artists; Year 2: 1,200; Year 3: 4,000 (all at €40/yr)
- Free tier ≈ 3× the paid base
- 30% of paying artists buy 2 extra DSP releases/yr (€8 each)
- Foundation grants: Y1 €25k, Y2 €45k, Y3 €80k
- Fan-sub adoption grows from 5% to 8% of paying artists with more fans each year

### Revenue

| Stream | Y1 | Y2 | Y3 |
|---|---|---|---|
| Memberships (× €40) | €8,000 | €48,000 | €160,000 |
| Distribution (gross) | €960 | €5,760 | €19,200 |
| DSP referral | €150 | €900 | €3,000 |
| Foundation grants | €25,000 | €45,000 | €80,000 |
| Donations | €800 | €4,800 | €16,000 |
| Fan-sub operational fee (2%) | €36 | €504 | €3,072 |
| **Total org revenue** | **€34,946** | **€104,964** | **€281,272** |

### Fan-sub flow (separate from org books)

| | Y1 | Y2 | Y3 | 3-year total |
|---|---|---|---|---|
| Gross from fans | €1,800 | €25,200 | €153,600 | €180,600 |
| Stripe fees (~10%) | -€142 | -€1,991 | -€12,134 | -€14,267 |
| Org operational fee (2%) | -€36 | -€504 | -€3,072 | -€3,612 |
| **Net to artists (direct)** | **€1,622** | **€22,705** | **€138,394** | **€162,721** |

### Costs

| Line item | Y1 | Y2 | Y3 |
|---|---|---|---|
| Hardware amortization | €4,680 | €4,680 | €4,680 |
| Capex top-up | — | €3,000 | €6,000 |
| Business fiber | €1,080 | €1,200 | €4,800 |
| Electricity | €660 | €720 | €840 |
| CDN spillover (Bunny EU) | €60 | €400 | €1,500 |
| Backup colocation | €600 | €600 | €960 |
| Transactional email | €180 | €600 | €2,000 |
| Newsletter dispatch (SES) | €200 | €1,500 | €4,500 |
| Social auto-post infra | €0 | €600 | €1,800 |
| Embed widget CDN | €0 | €400 | €1,500 |
| Smart link routing | €0 | €200 | €600 |
| Extra storage | €150 | €1,200 | €3,500 |
| Fan-sub infrastructure | €300 | €800 | €2,000 |
| Downloads bandwidth | €100 | €600 | €3,000 |
| Tahti Radio infrastructure | €200 | €800 | €2,400 |
| Venue API infrastructure | €0 | €200 | €600 |
| Artist tagging | €0 | €100 | €300 |
| ACRCloud | €100 | €600 | €2,500 |
| Tooling SaaS | €240 | €360 | €600 |
| Legal retainer | €6,000 | €6,000 | €9,000 |
| Accountant | €2,040 | €2,400 | €3,000 |
| hCaptcha + monitoring | €400 | €800 | €1,500 |
| Customer support | €0 | €600 | €3,000 |
| Chat infrastructure | €0 | €600 | €2,400 |
| ISRC membership | €0 | €100 | €100 |
| Revelator monthly minimum | €0 | €1,200 | €1,200 |
| DSP compliance legal | €1,500 | €2,000 | €3,000 |
| **Director / operations salary** | €30,000 | €40,000 | €45,000 |
| Audit fee | €2,000 | €2,500 | €3,500 |
| Board admin | €1,500 | €2,000 | €2,500 |
| Revelator pass-through | €2,160 | €12,960 | €43,200 |
| Stripe fees (subs) | €232 | €1,392 | €4,640 |
| **Total costs** | **€54,382** | **€91,412** | **€167,120** |

### Surplus and grant pool

| | Y1 | Y2 | Y3 | 3-year total |
|---|---|---|---|---|
| Total revenue | €34,946 | €104,964 | €281,272 | €421,182 |
| Total costs | €54,382 | €91,412 | €167,120 | €312,914 |
| **Surplus** | **-€19,436** | **+€13,552** | **+€114,152** | **+€108,268** |
| Operating reserve (10%) | €0 | €1,355 | €11,415 | €12,770 |
| **Artist grant pool (90%)** | **€0** | **€12,197** | **€102,737** | **€114,934** |

### Artist economic outcome (3-year headline)

| | 3-year total |
|---|---|
| Grants distributed (via org) | €114,934 |
| Fan-sub revenue (direct to artists) | €162,721 |
| **Total artist money** | **€277,655** |

## Grant distribution (Year 3 illustration)

The €102,737 grant pool is shared among paying members by engagement-unit weight.

- **Top 10%** (~400 artists): ~70–80% of units → ~€200 each
- **Middle 30%** (~1,200 artists): ~15–20% → ~€14–18 each
- **Lower tiers:** smaller shares; below 5 units/year → ineligible (inactive)

## Sensitivity

| Scenario (Year 3) | Effect |
|---|---|
| Half the planned paying artists | Surplus ~€45k; grants ~€40k |
| No foundation grant | Surplus ~€34k; grants ~€31k |
| Half fan-sub adoption | Direct artist revenue −€77k |
| Multiple shocks combined | Grants may pause; reserve drawn |

## Year 1 funding gap

Year 1 runs ~€19.5k below break-even. Apply to Business Finland Tempo, Koneen
Säätiö, and Suomen Kulttuurirahasto in parallel (`docs/funding-strategy.md`).

## Summary

A member-funded nonprofit: ~€278k to artists over three years (grants + direct
fan-subs), transparent accounts, single €40/yr tier priced for in-house
economics at scale, and no cut of fans' direct support to their artists.
