# Tahti ry — financial model (v7)

Reference date: May 2026. Self-hosted in Helsinki on owned hardware + UpCloud spillover. No CDN. Single paid tier: €40/year. Free tier: MP3 192 kbps, 1 hr/week live broadcasting, otherwise full product.

## What changed in v7

- Renamed from Replay to **Tahti ry**
- **One paid tier (€40/yr)**, Studio dropped
- **Free tier:** MP3 audio + 1 hr/week live, everything else included
- **Lossless audio for paid users:** FLAC streaming + FLAC download
- **No CDN.** Hosting on owned hardware in Helsinki + UpCloud Helsinki for spillover
- Sharper competitive positioning (see `strategy-and-product.md`)

## Revenue model

Six income streams:

1. **Subscriptions** — €40/yr × N paid members
2. **Distribution** — Revelator pass-through, no included releases now, €8/release for everyone
3. **DSP referral** — DistroKid affiliate
4. **Foundation grants** — Tempo, Koneen, SKR, Creative Europe
5. **Donations** — listener and aligned-org gifts
6. **Fan-sub operational fee** — 2% of fan-sub gross (operationally break-even)

## 3-year projection

### Assumptions

- Y1: 200 paid / 600 free
- Y2: 1,200 paid / 3,600 free
- Y3: 4,000 paid / 12,000 free
- 30% of paid buy 3 releases/yr (€8 each = €24/yr)
- 15% of paid use DistroKid referral (~€5 each)
- 5% of all artists donate (~€20 each)
- Grant funding: Y1 €25k, Y2 €45k, Y3 €80k
- Fan-sub adoption: Y1: 5% paid × 3 fans × €5/mo; Y2: 7% × 5 × €5; Y3: 8% × 8 × €5

### Revenue

| Stream | Y1 | Y2 | Y3 |
|---|---|---|---|
| Subscriptions (€40) | €8,000 | €48,000 | €160,000 |
| Distribution (gross) | €1,440 | €8,640 | €28,800 |
| DSP referral | €150 | €900 | €3,000 |
| Foundation grants | €25,000 | €45,000 | €80,000 |
| Donations | €800 | €4,800 | €16,000 |
| Fan-sub operational fee (2%) | €36 | €504 | €3,072 |
| **Total org revenue** | **€35,426** | **€107,844** | **€290,872** |

### Costs

| Line item | Y1 | Y2 | Y3 |
|---|---|---|---|
| Business fiber | €2,400 | €4,800 | €18,000 |
| UpCloud Helsinki (spillover) | €600 | €1,800 | €4,800 |
| Hardware amortization | €4,680 | €4,680 | €4,680 |
| Capex top-up | — | €3,000 | €6,000 |
| Electricity | €660 | €720 | €840 |
| Backup colocation | €600 | €600 | €960 |
| Extra storage (lossless + downloads) | €200 | €1,500 | €4,500 |
| Fan-sub infrastructure | €300 | €800 | €2,000 |
| Tahti Radio meta-stream | €200 | €800 | €2,400 |
| Venue API + tagging | €0 | €300 | €900 |
| **Infra subtotal** | **€9,640** | **€19,000** | **€45,080** |
| Transactional email | €180 | €600 | €2,000 |
| Newsletter dispatch | €200 | €1,500 | €4,500 |
| Social auto-post infra | €0 | €600 | €1,800 |
| Smart link routing | €0 | €200 | €600 |
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
| Yhdistys audit fee | €2,000 | €2,500 | €3,500 |
| Board admin | €1,500 | €2,000 | €2,500 |
| **Operations subtotal** | **€14,160** | **€22,060** | **€41,200** |
| **Director salary** | €30,000 | €40,000 | €45,000 |
| Revelator pass-through | €540 | €3,240 | €10,800 |
| Stripe fees (subs, 2.9%) | €232 | €1,392 | €4,640 |
| **Total costs** | **€54,572** | **€85,692** | **€146,720** |

### Surplus and grant pool

| | Y1 | Y2 | Y3 | Cumulative |
|---|---|---|---|---|
| Total revenue | €35,426 | €107,844 | €290,872 | €434,142 |
| Total costs | €54,572 | €85,692 | €146,720 | €286,984 |
| **Surplus** | **-€19,146** | **+€22,152** | **+€144,152** | **+€147,158** |
| Operating reserve (10%) | €0 | €2,215 | €14,415 | €16,630 |
| **Grant pool (90%)** | **€0** | **€19,937** | **€129,737** | **€149,674** |

### Fan-sub flow (separate from org books)

| | Y1 | Y2 | Y3 | Cumulative |
|---|---|---|---|---|
| Gross from fans to artists | €1,800 | €25,200 | €153,600 | €180,600 |
| Stripe fees (~10%) | -€142 | -€1,991 | -€12,134 | -€14,267 |
| Org operational fee (2%) | -€36 | -€504 | -€3,072 | -€3,612 |
| **Net to artists (direct)** | **€1,622** | **€22,705** | **€138,394** | **€162,721** |

Per-artist illustrations (membership + fan-subs + small grant → **+€50**,
membership only → **−€50**, one supporter ≈ break-even) are in
[`engagement-and-fansubs.md`](engagement-and-fansubs.md#artist-year-economics--worked-examples).
Source of truth: `packages/ledger/src/artist-year-economics.ts`.

### Total artist economic outcome

| | Y1 | Y2 | Y3 | Cumulative |
|---|---|---|---|---|
| Grants distributed | €0 | €19,937 | €129,737 | €149,674 |
| Fan-sub direct to artists | €1,622 | €22,705 | €138,394 | €162,721 |
| **Total artist money** | **€1,622** | **€42,642** | **€268,131** | **€312,395** |

## Comparison with v6

| | v6 cumulative | v7 cumulative | Delta |
|---|---|---|---|
| Org revenue | €529,182 | €434,142 | -€95,040 |
| Org costs | €316,096 | €286,984 | -€29,112 |
| Grants distributed | €205,818 | €149,674 | -€56,144 |
| Fan-sub direct | €162,721 | €162,721 | 0 |
| **Total artist money** | **€368,539** | **€312,395** | **-€56,144** |

The v7 model leaves ~€56k less in artists' hands over 3 years vs v6. The losses come from:
1. **Dropping Studio tier:** ~€120k/yr less revenue at Y3 from the lost €80 premium per Studio member
2. **Bigger Y3 infra:** ~€33k more in fiber + UpCloud + storage (offset partially by no CDN line)

The gains:
1. **Cleaner story:** one tier, one member class, one vote per artist regardless
2. **No CDN dependency:** the org is not contractually entangled with a third-party network provider
3. **Sharper free tier:** the "MP3 + 1 hr/week" structure is easy to explain and easy to convert from

## Infrastructure model

### Year 1-2 baseline

- **Primary:** owned hardware in Helsinki — Postgres, Redis, MinIO, Liquidsoap containers, Centrifugo, Nginx-RTMP
- **Business fiber:** symmetric gigabit (~€200-400/month in Helsinki via Elisa/DNA business)
- **UpCloud Helsinki:** spillover for static content (artwork, archive items not in active rotation, embed widget assets). ~€50-150/month
- **Backup colocation:** off-site DR copy of MinIO + Postgres backups at a Finnish provider

### Year 3 scale-up

- **10 Gbps business fiber** (~€1,500/month in Helsinki): required because FLAC streaming at 4,000 paid users × engaged listeners exceeds gigabit-pipe theoretical max
- **UpCloud spillover scales up** to ~€400/month for HLS segment serving when business fiber saturates
- **Storage tier upgrade** to accommodate FLAC originals (vs Opus 256 derivatives) — extra NVMe + cold-tier archive

### What we don't pay for

- No CDN recurring contract (e.g. Bunny, BlazingCDN, Fastly)
- No AWS / GCP / Azure infrastructure
- No Cloudflare (concerns documented in `docs/infra-strategy.md`)
- No third-party email broadcast service beyond what newsletter requires

## Sensitivity (bear cases)

| Variable | Y3 impact |
|---|---|
| Paid artists at half plan (2,000) | Revenue ~€211k. Surplus ~€64k. Grants ~€58k. |
| No Y3 foundation grant secured | Revenue ~€211k. Surplus ~€64k. Grants ~€58k. |
| Concurrent listeners exceed 1,500 by Y2 → pull fiber upgrade forward | +€13k cost in Y2. Surplus +€9k → +€0k. Grants ~€8k → €0. |
| 10 Gbps fiber unavailable at modeled cost (typical Helsinki: €1500-3000/mo) | Y3 cost +€18k (top of band). Surplus -€18k → ~€126k. Grants ~€113k. |
| Fan-sub adoption 50% of plan | Direct artist revenue Y3 -€77k (€60k vs €138k). Org rev -€1.5k. |
| Multi-shock (half paid + no Y3 grant) | Revenue ~€131k. Surplus ~-€16k. **Grants suspended, reserve drawn.** |

The 10 Gbps fiber question is the biggest infra risk. If Helsinki business fiber pricing at 10 Gbps is closer to €3000/month (€36k/yr) than €1500/month, that's another €18k off the Y3 surplus. Negotiating this contract early (Y2) is important.

## Director salary scenarios

| | Y1 | Y2 | Y3 | 3-yr cum |
|---|---|---|---|---|
| €30k modeled | -€19,146 | +€22,152 | +€144,152 | +€147,158 |
| €40k director Y1 | -€29,146 | +€12,152 | +€134,152 | +€117,158 |
| €50k director Y3 | -€19,146 | +€22,152 | +€139,152 | +€142,158 |

Bylaws §10 caps director comp at 30% of revenue. Y3 ceiling = €87k. Plenty of headroom.

## Year 1 deficit

Y1 needs a ~€20k bridge from foundation grants. Tempo (Business Finland) up to €50k; Koneen Säätiö 15-40k; Suomen Kulttuurirahasto 5-20k. Apply to all three in parallel.

## Cumulative outcome (v7)

| Metric | 3-year total |
|---|---|
| Org revenue | €434,142 |
| Org costs (incl director salary) | €286,984 |
| Director compensation | €115,000 |
| Operating reserve accumulated | €16,630 |
| **Artist grants distributed** | **€149,674** |
| **Fan-sub revenue direct to artists** | **€162,721** |
| **Total artist money** | **€312,395** |
| Active paying members by Y3 | 4,000 |

A small, sustainable Finnish nonprofit on Finnish infrastructure. ~€312k to artists across grants and direct fan-subs over 3 years, with a fair director wage, an honest story for foundations, no entanglement with global CDNs or US cloud, and no equity to anyone.
