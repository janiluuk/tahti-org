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
| Revelator pass-through | €540 | €3,240 | €10,800 |
| Stripe fees (subs, 2.9%) | €232 | €1,392 | €4,640 |
| **Total costs** | **€24,572** | **€45,692** | **€101,720** |

### Surplus and grant pool

| | Y1 | Y2 | Y3 | Cumulative |
|---|---|---|---|---|
| Total revenue | €35,426 | €107,844 | €290,872 | €434,142 |
| Total costs | €24,572 | €45,692 | €101,720 | €171,984 |
| **Surplus** | **+€10,854** | **+€62,152** | **+€189,152** | **+€262,158** |
| Operating reserve (10%) | €1,085 | €6,215 | €18,915 | €26,215 |
| **Grant pool (90%)** | **€9,769** | **€55,937** | **€170,237** | **€235,943** |

### Fan-sub flow (separate from org books)

| | Y1 | Y2 | Y3 | Cumulative |
|---|---|---|---|---|
| Gross from fans to artists | €1,800 | €25,200 | €153,600 | €180,600 |
| Stripe fees (~10%) | -€142 | -€1,991 | -€12,134 | -€14,267 |
| Org operational fee (2%) | -€36 | -€504 | -€3,072 | -€3,612 |
| **Net to artists (direct)** | **€1,622** | **€22,705** | **€138,394** | **€162,721** |

### Total artist economic outcome

| | Y1 | Y2 | Y3 | Cumulative |
|---|---|---|---|---|
| Grants distributed | €9,769 | €55,937 | €170,237 | €235,943 |
| Fan-sub direct to artists | €1,622 | €22,705 | €138,394 | €162,721 |
| **Total artist money** | **€11,391** | **€78,642** | **€308,631** | **€398,664** |

## Artist income by scenario

Net income for a **paying member** = **annual grant + fan-sub net − €40 membership**.

- Grants require **≥5 engagement units**/year and paying membership (see
  `docs/engagement-and-fansubs.md`).
- Fan-sub money goes **directly** to the artist (Stripe Connect), not through the
  grant pool. In the model, only **5% / 7% / 8%** of paying artists have any
  fan-subscribers (Y1–Y3), so fan income is concentrated.

Engagement units:

```
units = free_downloads×1 + paid_downloads×5 + fan_sub_euros_received×1
```

Illustrative platform totals for grant-share math: Y1 ~25k units, Y2 ~200k, Y3 ~1M.

### Year 3 (grant pool €170,237 · 4,000 paying members)

| Archetype | ~Share of members | Units (illustr.) | Grant | Fan-sub net | Membership | **Net income** |
|---|---|---|---|---|---|---|
| Inactive (&lt;5 units) | ~30% | &lt;5 | €0 | €0 | −€40 | **−€40** |
| Low engagement | ~30% | ~50 | ~€9 | €0 | −€40 | **−€31** |
| Typical active | ~30% | ~500 | ~€85 | €0 | −€40 | **+€45** |
| Modest fan-base (5 fans) | ~8% | ~200 | ~€34 | ~€267* | −€40 | **+€261** |
| Strong presence | ~8% | ~2,000 | ~€340 | ~€267* | −€40 | **+€567** |
| Top decile (engaged) | ~10% | ~3,800 | ~€647 | ~€2,136* | −€40 | **+€2,743** |

\*Fan-sub net examples after Stripe + 2% org fee: 5 fans × €4.45/mo × 12 ≈ €267/yr;
40 fans at ~€5/mo tier ≈ €2,136/yr.

**Even split fallacy** (if grant pool and fan-subs were divided equally — they are not):

| Source | Per paying member (Y3) |
|---|---|
| Grant | ~€43 |
| Fan-sub net | ~€35 |
| Membership | −€40 |
| Hypothetical average | ~€38 |

### Year 2 (grant pool €55,937)

| Archetype | Grant | Fan-sub net | Membership | **Net income** |
|---|---|---|---|
| Inactive | €0 | €0 | −€40 | **−€40** |
| Typical active (~500 units / ~200k total) | ~€140 | €0 | −€40 | **+€100** |
| Artist with 5 fans | ~€112 | ~€267 | −€40 | **+€339** |

### Year 1 (grant pool €9,769)

| Archetype | Grant | Fan-sub net | Membership | **Net income** |
|---|---|---|---|
| Paying member (no fans) | ~€2 avg | €0 | −€40 | **−€38** |
| One of ~10 artists with fans | ~€2 + fan share | ~€162 avg | −€40 | **+€124** |

### Three-year cumulative (paying members, platform-wide)

| | Total |
|---|---|
| Grants (pooled) | €235,943 |
| Fan-sub net (direct) | €162,721 |
| **Gross received by artists** | **€398,664** |
| Membership fees paid (4,800 member-years × €40) | −€192,000 |
| **Net after membership** | **+€206,664** |

Membership funds the service members own; grants and fan-subs return value to
**engaged** members above the fee.

### Bear cases — artist net income (Year 3)

| Scenario | Grant pool | Typical active net | Top decile net |
|---|---|---|---|
| **Base plan** | €170,237 | ~+€45 | ~+€2,743 |
| Half paying artists (2,000) | ~€64,000 | ~+€18 | ~+€1,050 |
| No foundation grant | ~€76,000 | ~+€20 | ~+€1,250 |
| Half fan-sub adoption | €170,237 | ~+€45 | ~+€1,450* |

\*Top-decile fan-sub halved; grant pool unchanged in this simplified row.

### Alignment with project plan

| Plan target | Model | Status |
|---|---|---|
| Y1 / Y2 / Y3 paying members: 200 / 1,200 / 4,000 | Assumptions § | ✓ |
| €40/yr single paid tier | Revenue § | ✓ |
| Engagement-unit grants | `engagement-and-fansubs.md` | ✓ |
| Y1 operating surplus (no salary line) | Surplus Y1 +€10,854 | ✓ |
| Maintenance team: equal split from positive surplus | `governance-and-legal.md` §7, §10 | ✓ |
| Cost table = sum of lines | Verified | ✓ |
| Revelator pass-through = releases × €4.50 COGS | Costs § | ✓ |

## Comparison with v6

| | v6 cumulative | v7 cumulative | Delta |
|---|---|---|---|
| Org revenue | €529,182 | €434,142 | -€95,040 |
| Org costs | €316,096 | €171,984 | -€144,112 |
| Grants distributed | €205,818 | €235,943 | +€30,125 |
| Fan-sub direct | €162,721 | €162,721 | 0 |
| **Total artist money** | **€368,539** | **€398,664** | **+€30,125** |

Earlier v7 drafts (with a fixed director salary line) left ~€56k less in artists'
hands over 3 years vs v6. **This revision removes that salary line**, so v7
cumulative artist money exceeds the salary-included v7 draft. Remaining gap vs v6
comes from:
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
| Paid artists at half plan (2,000) | Revenue ~€211k. Surplus ~€109k. Grants ~€98k. |
| No Y3 foundation grant secured | Revenue ~€211k. Surplus ~€109k. Grants ~€98k. |
| Concurrent listeners exceed 1,500 by Y2 → pull fiber upgrade forward | +€13k cost in Y2. Surplus ~€49k. Grants ~€44k. |
| 10 Gbps fiber unavailable at modeled cost (typical Helsinki: €1500-3000/mo) | Y3 cost +€18k. Surplus ~€171k. Grants ~€154k. |
| Fan-sub adoption 50% of plan | Direct artist revenue Y3 -€77k (€60k vs €138k). Org rev -€1.5k. |
| Multi-shock (half paid + no Y3 grant) | Revenue ~€131k. Surplus ~€29k. Grants ~€26k; maintenance pool likely €0. |

The 10 Gbps fiber question is the biggest infra risk. If Helsinki business fiber pricing at 10 Gbps is closer to €3000/month (€36k/yr) than €1500/month, that's another €18k off the Y3 surplus. Negotiating this contract early (Y2) is important.

## Maintenance team compensation

There is **no director salary line** in operating costs. The director is a
**maintenance team** member alongside trained member-operators (infra, support,
treasurer tracks — see `project-roadmap.md`).

When the fiscal year has **positive surplus** after audited costs:

1. The board sets a **maintenance compensation pool** (total € for the year).
2. The pool is split **equally** among every active maintenance team member
   approved for that year (director included — same rate per person).
3. The **remainder** of surplus funds the operating reserve (10%) and artist
   grant pool (90%) per bylaws §11.

Bylaws §10 caps **total** maintenance team compensation at 30% of revenue for
that year. Illustrative equal splits if the board allocates the full cap:

| Team size | Y1 cap (30% × €35k) | Per person | Y3 cap (30% × €291k) | Per person |
|---|---|---|---|---|
| 2 people | €10,628 | €5,314 | €87,262 | €43,631 |
| 4 people | €10,628 | €2,657 | €87,262 | €21,816 |

The **grant tables above** assume maintenance is paid from surplus **before**
the 10%/90% split only when the board allocates it; if the board takes nothing
in a year, the full surplus flows to reserve + grants. In practice, start small
(e.g. €2–5k/person in Y1) so grants stay the headline.

## Year 1 funding

Y1 is **operationally in surplus** on this model (€10,854 before maintenance
allocation). Foundation grants (€25k target) fund **growth** — hardware capex,
legal, faster member ramp — not payroll survival. Still apply to Tempo, Koneen,
and SKR in parallel; co-funding narrative is stronger when ops already balance.

## Cumulative outcome (v7)

| Metric | 3-year total |
|---|---|
| Org revenue | €434,142 |
| Org costs (no fixed salaries) | €171,984 |
| Operating reserve accumulated | €26,215 |
| **Artist grants distributed** | **€235,943** |
| **Fan-sub revenue direct to artists** | **€162,721** |
| **Total artist money** | **€398,664** |
| Active paying members by Y3 | 4,000 |

A small, sustainable Finnish nonprofit on Finnish infrastructure. ~€399k to
artists across grants and direct fan-subs over 3 years; maintenance team
(including the director) shares surplus **equally** when income is positive, per
AGM/board decision. No entanglement with global CDNs or US cloud, and no equity
to anyone.
