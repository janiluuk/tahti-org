# tahti.fm — implementation package 

A nonprofit, open-source, channel-first broadcasting platform for independent artists.

- **Legal form:** Finnish *yhdistys* (registered nonprofit association)
- **License:** AGPL-3.0 (copyleft — protects against extraction)
- **Surplus:** distributed annually as engagement-unit-weighted artist grants
- **Direct artist revenue:** fan-to-artist subscriptions with 0% org take (operational fee only, ≤2%)
- **Mission:** give independent musicians and DJs a free, sustainable broadcasting home

## Product, in one paragraph

Each artist gets a **24/7 channel** at `<slug>.tahti.fm` and a **modern profile page** at `tahti.fm/u/<handle>`. They broadcast live from OBS, Mixxx, Traktor, browser, or anything else. Listeners tune in anonymously, chat ephemerally, can **download tracks and mixes**, and can **subscribe directly to support their favorite artists** — money flows straight to the artist, the org takes nothing beyond a 2% operational fee. **Replay Radio** is the org-operated meta-stream that relays whichever channels are currently live, multistreamed to Mixcloud. Originals reach Spotify/Apple/Tidal via Revelator; mixes reach Mixcloud. Artists tag each other in bios and announcements. **Venues publish calendar feeds** of broadcasts on their premises. Every year the org's surplus is distributed as grants weighted by **engagement units** — paid downloads count more than free, fan-subscription euros count proportionally, passive listening doesn't count at all.

## Files

| File | Purpose |
|---|---|
| `docs/AGENT.md` | Coding-agent brief — repo, milestones (M0–M19), data model, OBS guides, transparency dashboard spec |
| `docs/profile-and-promo-toolkit.md` | Profile spec, release model, embed/smartlink/social/newsletter/analytics |
| `docs/engagement-and-fansubs.md` | v6 spec — engagement units, downloads, fan-subscriptions |
| `docs/replay-radio-and-venues.md` | v6 spec — meta-stream and venue calendar API |
| `docs/financial-model.md` | 3-year financial model with v6 lines |
| `docs/governance-and-legal.md` | Yhdistys structure, AGPL, bylaws sketch |
| `docs/funding-strategy.md` | Foundation grants, donations, sponsorship policy |
| `docs/transparency-policy.md` | Public ledger commitment |
| `docs/storage-policy.md` | Soft-target storage, no enforced limit |
| `docs/obs-and-broadcasting-guides.md` | Per-tool onboarding |
| `docs/cdn-strategy.md` | European CDN selection + DPA implications |
| `docs/strategy-and-product.md` | Channel-first positioning |
| `infra/docker-stack.yml` | Production Swarm stack |
| `infra/docker-compose.dev.yml` | Local dev |
| `infra/Caddyfile` | Edge config |
| `infra/liquidsoap-channel.liq.template` | Per-channel broadcaster |
| `slides/Replay-Community.pptx` | 12-slide artist-facing deck |
| `slides/Replay-Business.pptx` | 12-slide governance + sustainability deck |

## Headline numbers (v6)

| | Y1 | Y2 | Y3 |
|---|---|---|---|
| Paying artists | 200 | 1,200 | 4,000 |
| Total revenue | €38,946 | €128,964 | €361,272 |
| Total costs (incl. director salary €30–45k) | €54,548 | €92,108 | €169,440 |
| **Surplus** | **-€15,602** | **+€36,856** | **+€191,832** |
| **Artist grant pool (90% of surplus)** | **€0** | **€33,170** | **€172,649** |
| **Fan-sub gross to artists** | **€1,800** | **€25,200** | **€153,600** |
| **Fan-sub net to artists (after Stripe + 2% org fee)** | **€1,622** | **€22,705** | **€138,394** |

Cumulative 3-year artist grant pool: ~€206,000.
Cumulative direct fan-sub revenue to artists: ~€163,000.
**Total artist money over 3 years: ~€369,000** (75% more than v5).
Cumulative director compensation: €115,000.

## What's on record

1. **The grant model now rewards engagement, not passive listening.** Free downloads count 1×. Paid-subscriber downloads count 5×. Each €1/month of fan-subscription revenue counts 1× — so a €10/month fan contributes 10 engagement units. **Listener-hours are now a vanity metric only.** This will redistribute grants away from passive-audience channels (24/7 ambient, talk-radio) and toward artists with engaged paying fans. Expect this to be a contested governance debate within the first 18 months.

2. **Fan-subs take 0% org cut.** Bylaws (§11.b proposed) lock this in. The org charges a 2% operational fee to cover Stripe processing, GDPR/tax compliance, and fan-sub customer support — fully consumed by costs. Reviewable annually by membership.

3. **Anonymous downloads stay anonymous.** Free-listener downloads do not require an account. Anti-fraud is rate limits + browser fingerprint dedup + same-track cap (max 10 dedup'd downloads per listener per track count). Paid downloads require an account (since fan-subs have billing identity).

4. **Replay Radio is a live-relay meta-stream.** It plays whichever channels are currently live, no editorial curation. The director does not program it. Listener-hours on Replay Radio route to the originating channel's vanity counters.

5. **Multistream-out goes to Mixcloud Live only.** YouTube and Twitch will copyright-strike a stream that plays unlicensed music regardless of consent. Mixcloud has blanket licenses. This is the only legal target.

6. **Venue API is a calendar feed, not a booking marketplace.** Venues register, publish broadcasts happening at their location, artists subscribe to feeds they care about. Replay does not mediate bookings.

7. **Year 1 still needs a founding grant.** ~€16k deficit. Apply to Business Finland Tempo, Koneen Säätiö, Suomen Kulttuurirahasto in parallel. Same as v4/v5.

8. **Director salary unchanged.** €30k/€40k/€45k. Cumulative €115k over 3 years. Real but modest.

9. **AGPL means anyone can fork.** Moat is the hosted instance plus the artist network on it, not the code.

10. **The cumulative artist economic outcome is the strongest version yet.** v5 distributed €212k via grants. v6 distributes €206k via grants *plus* funnels €163k of direct fan revenue to artists, for ~€369k total — 75% more artist money than v5, achieved by routing more of the value directly rather than through the org's books.

— Generated 2026-05-15
