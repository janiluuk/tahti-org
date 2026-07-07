# Tahti ry — home-hosted capacity & cost recalculation (Aug 2026 – Aug 2027)

Scenario: instead of the Year-1 plan in `hosting-budget.md` (owned colo or Hetzner HEL1),
run primary infrastructure on **owner-supplied i7 machines at a home location**, on a
**250 Mbps home connection**, targeting **1,000 total registered users** by the end of
the period. This document recalculates capacity needs and cost for that specific
scenario, and checks it against the existing org-wide financial model in
`financial-model.md` / `budget-detailed.md` to answer "is €40/year enough."

**This does not replace `hosting-budget.md`.** It's a fourth scenario for comparison,
using the same methodology (bandwidth math from `infra-strategy.md`) so the numbers are
directly comparable to the colo and Hetzner figures already in that document.

## The one number that decides everything: upload speed, not download speed

**"250 Mbps connection" is ambiguous in a way that changes every number below by 10×.**
Serving audio to listeners is *egress* — from the home network's perspective, that's the
**upload** direction. A residential/cable connection commonly advertised as "250 Mbps" is
often 250 Mbps *down* / 20–50 Mbps *up* (DOCSIS-style asymmetry). A genuine 250 Mbps
**symmetric** business or FTTH line is a different, much more capable thing.

**Confirm this before trusting any number in this document**: run a speed test and read
the *upload* number specifically, and check whether the ISP contract is residential
(commonly prohibits "server"/commercial use in its terms) or business-grade. If it's
asymmetric or residential-ToS, skip to [If upload is the bottleneck](#if-upload-is-the-bottleneck-asymmetric-or-residential-line) below —
the rest of this section assumes a genuine 250 Mbps symmetric line.

## 1. Traffic model at 1,000 users

Reusing `infra-strategy.md`'s methodology (blended FLAC-equivalent listener-hour
estimate — conservative, since member-artist channels serve lossless audio to *free*
listeners too, per the constitution: quality follows the broadcaster's tier, not the
listener's) and `financial-model.md`'s Y1 ratio (200 paid : 600 free ≈ 25:75), scaled to
1,000 total users:

| | Assumption | Value |
|---|---|---|
| Total registered users | Every account is an artist account (per `/help/tier-limits`) | 1,000 |
| Paid members (€40/yr, unlimited live, FLAC) | 25% ratio, matching official Y1 model | 250 |
| Free-tier artists (1 hr/week live cap, MP3 192 kbps) | 75% ratio | 750 |
| Listener-hours/year | Scaled from official Y1 (400k @ 800 users) × 1,000/800 | **500,000** |

### Streaming egress

500,000 hours × 800 kbps blended (100 KB/s) = **~180 TB/year** streaming egress.
Cross-checked against `hosting-budget.md`'s own table (400k hrs → ~128 TB, 1M hrs →
~320 TB) — 500k hours sits consistently between those two points.

### Download egress

Assumption (state clearly, adjust as needed): ~10 downloads/user/year platform-wide
(10,000 downloads/year), mixed 70% MP3 / 20% FLAC / 10% WAV, 4-minute average track:

| Format | Bitrate | Size/track | Share | Downloads | Subtotal |
|---|---|---|---|---|---|
| MP3 192 kbps | 192 kbps | 5.6 MB | 70% | 7,000 | 39.2 GB |
| FLAC (~900 kbps) | 900 kbps | 26.4 MB | 20% | 2,000 | 52.8 GB |
| WAV (1,411 kbps) | 1,411 kbps | 41.3 MB | 10% | 1,000 | 41.3 GB |
| **Total** | | | | **10,000** | **~133 GB/year** |

**This is the direct answer to "does WAV increase costs": yes, per-file WAV downloads
cost ~7.4× more egress than MP3 (41.3 MB vs 5.6 MB) — but downloads overall (even
WAV-heavy) are a rounding error against the ~180 TB streaming figure.** WAV's real cost
impact is on *storage*, not bandwidth — see below.

**Total egress: ~180.1 TB/year.**

### Pipe capacity check (assumes genuine 250 Mbps symmetric)

- Theoretical max: 250 Mbps = 31.25 MB/s → **~985 TB/year** at 100% utilization
- Practical sustained ceiling for a *home* line: use 40% (more conservative than the
  60% `hosting-budget.md` uses for dedicated business fiber — home connections have more
  contention, less predictable QoS, and real risk of informal ISP throttling under
  sustained heavy use) → **~394 TB/year practical**
- **180 TB / 394 TB ≈ 46% of practical capacity.** Comfortable margin *on average*.

**Peak-hour check** (the real risk — averages hide evening listening spikes): if 35% of
daily traffic concentrates into a 5-hour evening peak (493 GB/day average × 0.35 ÷ 5h),
that's **~77 Mbps average during peak** — well inside a 250 Mbps pipe, with real headroom
for bursts above that average.

**Verdict if the connection is genuinely 250 Mbps symmetric: it is enough for 1,000
users, with roughly 2× headroom on average and comfortable peak-hour margin.** Revisit
this math immediately if user count or average listening time tracks meaningfully above
this document's assumptions — 2,000 users at the same per-user habits would consume the
full practical ceiling.

## 2. Storage growth

Assumption: ~15 uploads/user/year (15,000 tracks/year total), split 70% short tracks
(~4 min) / 30% long sets (~60 min, DJ sets and live recordings — this platform is
broadcast/archive-first, not just singles), format mix 60% MP3 / 25% FLAC / 15% WAV
(originals — per the constitution, "originals are preserved as-is," so the *uploaded*
file is stored regardless of what gets transcoded for streaming):

| | Size | Count | Subtotal |
|---|---|---|---|
| Short tracks (mixed format) | 5.6–41.3 MB avg ~16 MB | 10,500 | ~166 GB |
| Long sets (mixed format) | 84–620 MB avg ~243 MB | 4,500 | ~1,066 GB |
| **Original masters** | | 15,000 | **~1.2 TB** |
| + derivative transcodes, waveform/peak data, artwork (+40%) | | | **~1.7 TB** |

**Total new storage: ~1.7 TB/year**, doubled to **~3.4 TB/year** once the redundancy
requirement below is applied. This is the concrete cost of "using WAV increases costs"
on the *storage* side — WAV originals in the mix add roughly 3–4× the storage a
pure-MP3 catalog of the same size would need.

**Redundancy requirement (don't skip this):** at least one local mirror/RAID copy of the
~1.7 TB/year of new content, plus the existing off-site DR policy
(`infra-strategy.md`: daily `mc mirror` to a Finnish-jurisdiction bucket, RPO 24h) —
home hosting has *more* single-location risk (fire, theft, flood, residential power
loss) than a proper colo, not less, so the existing DR discipline matters more here, not
less.

### 2026 storage pricing — don't use pre-2025 drive prices

Consumer NVMe/SSD pricing rose sharply through 2025 into 2026, driven by AI-datacenter
demand pulling NAND and DRAM supply away from the consumer market — reported increases
in the 30–50%+ range year-over-year depending on capacity tier, with spot pricing more
volatile than that. **Don't budget storage purchases at older per-GB prices** — a 4 TB
consumer NVMe that priced around €180–220 in 2024 is realistically **€260–320** in the
2026 buying environment, and enterprise-grade drives (the more sensible choice for a
server that needs to survive 24/7 write load, not a desktop drive) command a further
premium over consumer NVMe.

Sized for this scenario: covering the ~3.4 TB/year (content + local redundancy) figure
above needs roughly one 4 TB drive/year at 2026 prices — **~€280–320/year**, not the
~€200 a pre-2026 estimate would suggest. This is folded into the hardware
maintenance/replacement line in the budget below rather than broken out separately,
since it's the single biggest driver of that line.

## 3. Compute — is "an army of i7 servers" actually enough?

Almost certainly yes, and bandwidth (not CPU) is the real constraint. Reasoning:

- **Live broadcast encode** (Liquidsoap + ffmpeg per channel) is audio-only, low per-stream
  CPU cost. Even a generous peak-concurrency estimate — 5% of 1,000 users live
  simultaneously at once (50 concurrent channels) — is a workload a single modern
  multi-core i7 handles without strain; spread across several machines it's comfortable.
- **Archive/HLS playback** doesn't scale with listener count the way encode does —
  segments are generated once and served many times by Caddy/nginx, which is I/O and
  network-bound, not CPU-bound.
- **Background transcode jobs** (uploads → streaming derivatives) run through the
  worker's lane system (`apps/worker`, `packages/shared/src/worker-job-lanes.ts` —
  media/dist/light/edge-log lanes) — this maps naturally onto "an army of machines":
  put the ffmpeg-heavy `media` lane on the beefiest box, `light`/`dist` lanes on
  whatever's left over.

**Recommendation:** split roles across the fleet rather than running everything on one
box — one machine for Postgres + Redis + MinIO (the stateful core, put this on your most
reliable/UPS-protected machine), one or two for the worker lanes above, one for the web/API
containers, with Caddy/reverse-proxy on whichever has the most reliable network path. This
also gives you a natural DR story: the stateful box is the one that actually needs the UPS
and the backup discipline; the others are stateless and replaceable.

## 4. Home-hosting cost budget (incremental, hardware already owned)

Since the i7 machines themselves are a sunk cost (already owned, "for a moment" — see
[risk note](#risk-if-the-hardware-is-only-temporarily-available) below), the *incremental*
annual cost vs. the official colo (€8,460/yr) or Hetzner (€2,868/yr) plans in
`hosting-budget.md` is much smaller:

| Line item | Annual | Note |
|---|---|---|
| Electricity | **~€1,580** | 5 machines × ~180W avg × 24/7 × €0.20/kWh — recompute with your real machine count/wattage/rate; formula: `kW × 24 × 365 × €/kWh` |
| UpCloud Helsinki (DR mirror + spillover) | **~€500** | Kept from official plan — data-loss protection matters *more* at a single home location, not less |
| UPS / power-protection upkeep | **~€150** | Battery replacement/expansion; assumes base UPS gear already exists |
| Hardware maintenance/replacement contingency | **~€700** | Includes ~€300 for one 4 TB storage drive/year **at 2026 pricing** (see above — NAND/DRAM prices are up 30–50%+ YoY on AI-datacenter demand; don't budget storage at pre-2025 per-GB prices), plus ~€400 general parts/fans/PSU contingency for consumer-grade hardware that wasn't built for 24/7 server duty |
| Domain, TLS (Let's Encrypt is free), misc | **~€50** | |
| **Total (symmetric-connection case)** | **~€2,980/yr (~€248/mo)** | |

Comparable to the Hetzner scenario (€2,868/yr) and **~€5,480/yr cheaper than the official
colo plan** (€8,460/yr) — because there's no fiber contract and no hardware capex to
amortize.

### If upload is the bottleneck (asymmetric or residential line)

If the real upload speed turns out to be a fraction of 250 Mbps (common on
cable/residential contracts), most egress needs to route through spillover capacity
instead — the same UpCloud/Hetzner pattern `hosting-budget.md` already plans for at
higher scale, just triggered earlier. Two paths, either usable:

| Path | Annual | Note |
|---|---|---|
| Upgrade to genuine symmetric business line | **+€2,400–3,600** | `hosting-budget.md`'s own 1 Gbps business-fiber estimate (€200–300/mo) also solves the ISP ToS risk (ban on hosting/commercial use) and typically includes a static IP |
| Route most egress through Hetzner HEL1 spillover, home boxes handle storage/compute only | **+€1,200–2,000** | AX41/AX52 at €43–68/mo covers the bulk of 180 TB egress within Hetzner's 20 TB/server included transfer once split across 2–3 servers |

Either pushes the home-hosting total to **~€4,900–6,300/yr** — still meaningfully
cheaper than the official colo plan, though the margin over Hetzner-only narrows. If you
confirm the connection is genuinely symmetric, ignore this subsection.

### Risk: if the hardware is only temporarily available

"For a moment" is worth being explicit about. If these i7 machines aren't a permanent
fixture, home-hosting isn't a stable Year-1 plan — it's a bridge. Two honest options:
(a) treat this as a temporary cost-saving measure with a defined migration date back to
Hetzner/colo already budgeted in `hosting-budget.md`, or (b) budget for replacement
hardware (`hosting-budget.md`'s original €6,000 capex line) once the borrowed machines
are no longer available. Worth deciding explicitly rather than discovering it mid-year.

## 5. Full org budget with home-hosting substituted in

Keeping `budget-detailed.md`'s Y1 structure (professional services, platform services,
operations, variable/pass-through don't depend on the hosting choice) and substituting
only the infrastructure line, scaled lightly to 1,000 users / 250 paid:

| Category | Official Y1 (colo, 800 users) | Home-hosted (1,000 users, symmetric case, 2026 storage pricing) |
|---|---|---|
| Infrastructure | €9,140 | **€2,980** |
| Platform services | €1,380 | €1,600 (light scale-up) |
| Operations | €240 | €240 |
| Professional services (director, legal, accountant, audit, board) | €43,040 | €43,040 (unchanged — doesn't depend on hosting) |
| Variable / pass-through (250 vs 200 paid) | €772 | €965 |
| **Total costs** | **€54,572** | **~€48,825** |

| Revenue (1,000 users: 250 paid / 750 free) | Amount |
|---|---|
| Subscriptions (250 × €40) | €10,000 |
| Distribution (30% × 250 × 3 × €8) | €1,800 |
| DSP referral (15% × 250 × €5) | €188 |
| Donations (5% × 1,000 × €20) | €1,000 |
| Foundation grants (unchanged target — external funding, not a function of user count) | €25,000 |
| Fan-sub operational fee (2%) | €45 |
| **Total revenue** | **€38,033** |

**Result: €38,033 − €48,825 = −€10,792 deficit.**

Better than the official Y1 colo scenario (−€19,146) by about **€8,350** — home-hosting
is a real, meaningful improvement — but still a deficit, still needing a grant bridge.

## 6. The actual answer to "is €40/year enough"

**Not on its own — but this isn't a new problem home-hosting created; it's already the
documented conclusion in `budget-detailed.md`, which this recalculation confirms rather
than contradicts.**

`budget-detailed.md`'s own break-even analysis found Year 1 needs **~600 paid members**
to self-fund without a grant, at the *official colo* cost structure. Redoing that
calculation at the home-hosting cost structure (fixed costs minus revenue that doesn't
scale with subscriptions, divided by €40):

```
Fixed costs (home-hosted):        €48,825
Non-subscription, non-grant rev:  €1,800 + €188 + €1,000 + €45 = €3,033
Gap to close with dues alone:     €45,792
÷ €40/member:                     ~1,145 paid members needed
```

At 1,000 *total* users and a realistic 25% paid ratio (250 paying), dues cover about
**20% of the fixed cost base**. Home-hosting's ~€5.7k/year infrastructure saving helps,
but it doesn't change the structural reason: **professional services (director salary,
legal, accountant, statutory audit — required by Finnish association law to operate with
paid staff) are 88% of the home-hosted cost base (€43,040 of €48,825), and hosting
choice doesn't touch that number at all.**

**Conclusion:**
1. €40/year is a reasonable, sustainable *per-member* price — it's not too low relative
   to what a member gets (unlimited live + lossless audio + governance vote), and raising
   it doesn't obviously close the gap faster than growing membership does.
2. At 1,000 total users, Tahti is **not** self-funding on dues alone, with or without
   home-hosting — a grant/donation bridge of roughly **€10.8k** (home-hosted) to **€19.1k**
   (official colo) is structurally necessary at this scale, exactly as `budget-detailed.md`
   already concluded.
3. Home-hosting is worth doing **as a cost-reduction lever**, not as the thing that makes
   €40/year "enough" by itself — it shrinks the grant ask by ~44%, which is genuinely
   significant for a founding-year grant application, but the org still needs Tempo/Koneen/
   SKR-style bridge funding this year regardless of which hosting path is chosen.
4. The break-even point (~1,100+ paid members needed for dues alone to cover the fixed
   cost base) is a Year-2/Year-3 target, not realistic at 1,000 total users — consistent
   with the official model's own Y2 crossover at 1,200 paid members.

## What to verify before treating this as a real plan

1. **Upload speed, specifically** — not the advertised "250 Mbps," the actual upload
   number from a speed test, plus whether the ISP contract permits server/commercial use.
2. **Exact machine count, CPU/RAM/storage per box, and existing UPS coverage** — this
   document estimated "5 machines × 180W" for the electricity line; substitute your real
   numbers.
3. **Whether the hardware is permanent or temporary** — changes whether this is a
   Year-1 plan or a bridge to a later Hetzner/colo migration.
