# Replay ry — financial model (v6)

Reference date: May 2026. Self-hosted in Helsinki. Pricing: Artist €40/yr, Studio €120/yr.
Legal form: Finnish *yhdistys*. Surplus distributed annually as artist grants weighted by engagement units.

## What changed in v6

- **Grant model:** listener-hours replaced by engagement units (downloads × commitment + fan-sub euros)
- **Fan-to-artist subscriptions:** new product, 0% org take, 2% operational fee
- **Downloads:** first-class action with anti-fraud rate limiting
- **Replay Radio meta-stream:** live-relay multistreamed to Mixcloud
- **Venue calendar API:** lightweight iCalendar feeds
- **Artist tagging:** @-mention system
- **European CDN strategy:** Bunny CDN primary, EU-jurisdiction-first

These add ~€8k of cost over 3 years vs v5. Grants drop ~€7k cumulative. But fan-subs route ~€163k of direct revenue to artists outside the grant pool — net effect is ~75% more total artist money than v5.

## Revenue model

Six income streams now:

1. **Subscriptions** (Artist €40 + Studio €120)
2. **Distribution** (Revelator pass-through)
3. **DSP referral** (DistroKid affiliate)
4. **Foundation grants** — Business Finland, Koneen, SKR, Creative Europe
5. **Donations**
6. **Fan-sub operational fee** — 2% of fan-sub gross, covers Stripe + GDPR/ops overhead (operationally break-even, not a profit center)

## Pricing tier features (artist side, unchanged from v5)

### Free
- 1 channel + 1 profile page
- Up to 5 archive items
- Live broadcasting (Icecast, RTMP, browser)
- Basic chat
- Embed widget (with Replay attribution)
- Smart link auto-generated
- **Can enable fan-subs** — though most artists need Artist tier to feel ready
- Channel auto-archives if no broadcast in 60 days

### Artist — €40/year
- Unlimited archive (no enforced limit)
- Unlimited releases on profile
- Auto-archive every live set
- 1 multistream destination
- Mixcloud auto-upload
- Pinned announcements + chat moderation
- Pay-per-release DSP distribution at €8 each
- Newsletter: up to 4 sends per week
- Social auto-post: all platforms
- Track-level analytics
- **Fan-subs enabled** — set tiers, receive direct support
- **Downloads enabled** — listeners can download tracks/mixes
- **Member of the association** — eligible for annual grants

### Studio — €120/year
- Everything in Artist
- 12 DSP releases/yr included
- Unlimited multistream destinations
- Custom domain
- Detailed listener insights
- Live recording in FLAC
- FLAC download for any track they own
- Press kit page
- Newsletter: unlimited sends
- API access
- **Member of the association** — eligible for annual grants

### Fan-Supporter (NEW — listener side, paid directly to artists)
- Listener pays €1–€100/month directly to a specific artist
- Subscriber badge in chat
- Unlimited downloads of that artist's content
- FLAC download option
- Access to fan-only chat (if artist enabled it)
- Access to fan-only newsletter (if artist enabled it)

## 3-year projection

### Assumptions
- Y1: 200 paying artists (150 Artist, 50 Studio)
- Y2: 1,200 paying artists (900 Artist, 300 Studio)
- Y3: 4,000 paying artists (3,000 Artist, 1,000 Studio)
- Free tier ≈ 3× the paid base
- 30% of Artist buy 2 extra releases/yr (€16 each)
- 20% of Studio buy 3 extras beyond included 12 (€24 each)
- 15% of paying artists use DistroKid referral (~€4.65 each)
- 5% of all artists make a small annual donation (~€20)
- Grant funding: Y1 €25k, Y2 €45k, Y3 €80k
- **Fan-sub adoption:** Y1: 5% of paying artists, 3 fans each at avg €5/mo; Y2: 7%, 5 fans each; Y3: 8%, 8 fans each
- **Downloads:** Y1: ~5k/yr, Y2: ~80k/yr, Y3: ~400k/yr (driven by engaged fans + occasional viral mix)

### Revenue

| Stream | Y1 | Y2 | Y3 |
|---|---|---|---|
| Artist subs (Artist × €40) | €6,000 | €36,000 | €120,000 |
| Studio subs (Studio × €120) | €6,000 | €36,000 | €120,000 |
| Distribution (gross) | €960 | €5,760 | €19,200 |
| DSP referral | €150 | €900 | €3,000 |
| Foundation grants | €25,000 | €45,000 | €80,000 |
| Donations | €800 | €4,800 | €16,000 |
| **Fan-sub operational fee (2%)** | **€36** | **€504** | **€3,072** |
| **Total org revenue** | **€38,946** | **€128,964** | **€361,272** |

### Fan-sub flow (separate from org books, but tracked)

| | Y1 | Y2 | Y3 | Cumulative |
|---|---|---|---|---|
| Gross from fans | €1,800 | €25,200 | €153,600 | €180,600 |
| Stripe fees (~10%) | -€142 | -€1,991 | -€12,134 | -€14,267 |
| Org operational fee (2%) | -€36 | -€504 | -€3,072 | -€3,612 |
| **Net to artists (direct, not via org)** | **€1,622** | **€22,705** | **€138,394** | **€162,721** |

### Costs (v6)

| Line item | Y1 | Y2 | Y3 |
|---|---|---|---|
| Hardware amortization | €4,680 | €4,680 | €4,680 |
| Capex top-up | — | €3,000 | €6,000 |
| Business fiber | €1,080 | €1,200 | €4,800 |
| Electricity | €660 | €720 | €840 |
| CDN spillover (Bunny EU) | €60 | €400 | €1,500 |
| Backup colocation | €600 | €600 | €960 |
| Transactional email (Postmark) | €180 | €600 | €2,000 |
| Newsletter dispatch (SES) | €200 | €1,500 | €4,500 |
| Social auto-post infra | €0 | €600 | €1,800 |
| Embed widget CDN | €0 | €400 | €1,500 |
| Smart link routing | €0 | €200 | €600 |
| Extra storage (WAV/FLAC + downloads) | €200 | €1,500 | €4,500 |
| **Fan-sub infrastructure** | **€300** | **€800** | **€2,000** |
| **Downloads bandwidth** | **€100** | **€600** | **€3,000** |
| **Replay Radio infrastructure** | **€200** | **€800** | **€2,400** |
| **Venue API infrastructure** | **€0** | **€200** | **€600** |
| **Artist tagging infrastructure** | **€0** | **€100** | **€300** |
| ACRCloud | €100 | €600 | €2,500 |
| Tooling SaaS | €240 | €360 | €600 |
| Legal retainer | €6,000 | €6,000 | €9,000 |
| Accountant | €2,040 | €2,400 | €3,000 |
| hCaptcha + monitoring | €400 | €800 | €1,500 |
| Customer support | €0 | €600 | €3,000 |
| Chat infrastructure | €0 | €600 | €2,400 |
| ISRC membership (IFPI Finland) | €0 | €100 | €100 |
| Revelator monthly minimum | €0 | €1,200 | €1,200 |
| DSP compliance legal | €1,500 | €2,000 | €3,000 |
| **Director salary** | €30,000 | €40,000 | €45,000 |
| **Yhdistys audit fee** | €2,000 | €2,500 | €3,500 |
| **Board admin** | €1,500 | €2,000 | €2,500 |
| Revelator pass-through | €2,160 | €12,960 | €43,200 |
| Stripe fees (subs, 2.9%) | €348 | €2,088 | €6,960 |
| **Total costs** | **€54,548** | **€92,108** | **€169,440** |

### Surplus and grant pool (v6)

| | Y1 | Y2 | Y3 | Cumulative |
|---|---|---|---|---|
| Total revenue | €38,946 | €128,964 | €361,272 | €529,182 |
| Total costs | €54,548 | €92,108 | €169,440 | €316,096 |
| **Surplus** | **-€15,602** | **+€36,856** | **+€191,832** | **+€213,086** |
| Operating reserve (10%) | €0 | €3,686 | €19,183 | €22,869 |
| **Artist grant pool (90%)** | **€0** | **€33,170** | **€172,649** | **€205,818** |

### Cumulative artist economic outcome (the headline)

| | v4 | v5 | **v6** |
|---|---|---|---|
| Cumulative grants distributed | €228,971 | €212,320 | €205,818 |
| Cumulative direct fan-sub to artists | — | — | €162,721 |
| **Total artist money over 3 years** | **€228,971** | **€212,320** | **€368,539** |
| vs v5 | — | baseline | **+74%** |

The v6 model puts **74% more money into artists' hands** than v5 over 3 years, despite a slightly smaller grant pool, by funneling fan-sub revenue directly rather than through the org's books.

## v5 → v6 comparison

| | v5 cumulative | v6 cumulative | Delta |
|---|---|---|---|
| Org revenue | €525,570 | €529,182 | +€3,612 |
| Org costs | €304,696 | €316,096 | +€11,400 |
| Org surplus | €220,874 | €213,086 | -€7,788 |
| Grants distributed | €212,320 | €205,818 | -€6,502 |
| **Direct fan-sub to artists** | — | €162,721 | +€162,721 |
| **Total artist money** | €212,320 | €368,539 | **+€156,219** |
| Director comp | €115,000 | €115,000 | — |

## Engagement-unit distribution (Y3 illustration)

The €172,649 Y3 grant pool is distributed across paying artists by engagement-unit share.

Indicative unit distribution at Y3 (4,000 paying artists):

- **Top 10% (400 artists with active fan-bases):** ~70-80% of total units. Per-artist grant: ~€300-345.
- **Middle 30% (1,200 artists with some download activity):** ~15-20% of units. Per-artist grant: ~€22-30.
- **Next 30% (1,200 artists with minimal engagement):** ~3-5% units. Per-artist grant: ~€4-7.
- **Bottom 30% (1,200 artists with <5 units, below threshold):** ineligible.

This is more concentrated than v5's listener-hour model, which had a more
gradual curve. Top decile gets ~70-80% of the pool in v6 vs ~50% in v5.

This concentration is *intentional* under v6's philosophy ("reward
intentional engagement"), but it's the kind of thing the membership will
debate. The bylaws explicitly allow the membership to vote on formula
adjustments — for example, a square-root weighting could compress the
distribution, or a floor amount could guarantee €5 to every eligible artist.

**Minimum threshold:** 5 engagement units/year. Below that, the artist is
inactive and their would-be share rolls into the next year.

## Salary scenarios

| | Y1 | Y2 | Y3 | 3-yr cum |
|---|---|---|---|---|
| €30k director (modeled) | -€15,602 | +€36,856 | +€191,832 | +€213,086 |
| €40k director | -€25,602 | +€26,856 | +€181,832 | +€183,086 |
| €50k director | -€35,602 | +€16,856 | +€171,832 | +€153,086 |

Bylaws §10 caps director comp at 30% of revenue. Y3 ceiling = €108k. Plenty of headroom.

## Sensitivity (bear cases)

| Variable | Y3 impact |
|---|---|
| Paid artists half of plan (2,000) | Revenue ~€237k. Surplus ~€72k. Grants ~€65k. |
| No Year-3 foundation grant secured | Revenue ~€281k. Surplus ~€112k. Grants ~€101k. |
| Fan-sub adoption 50% of plan | Revenue -€1.5k. Surplus -€1.5k. Direct artist revenue -€77k. |
| Downloads 50% of plan | Cost -€1.5k. Surplus +€1.5k. Grant distribution becomes more even. |
| Multi-shock (half paid + no Y3 grant + half fan-subs) | Revenue ~€155k. Surplus ~-€5k. **Grants suspended, reserve drawn.** |

## Year 1 deficit unchanged

Y1 still needs ~€16k bridge funding (slightly worse than v5 due to new infra). Tempo/Koneen/SKR strategy unchanged.

## Cumulative outcome (v6)

| Metric | 3-year total |
|---|---|
| Org revenue | €529,182 |
| Org costs (incl director salary) | €316,096 |
| Director compensation | €115,000 |
| Operating reserve accumulated | €22,869 |
| **Artist grants distributed** | **€205,818** |
| **Fan-sub revenue direct to artists** | **€162,721** |
| **Total artist money** | **€368,539** |
| Active members by Y3 | 4,000 |

A small, sustainable nonprofit that has shipped a focused product, distributed ~€369k to artists across grants and fan-subs by Year 3, paid its director fairly, and built the tools artists actually use — without ever taking equity, ad revenue, or a cut of fans' direct support to their favorite artists.
