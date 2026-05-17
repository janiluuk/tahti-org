# tahti.fm — implementation package 

A **member-owned**, open-source, channel-first broadcasting platform for independent artists.

- **Who owns it:** paying artists (members of Tahti ry) — one member, one vote
- **Who runs it:** Tahti ry, a Finnish nonprofit that handles membership, maintenance, and transparent accounts until trained members share the work
- **License:** AGPL-3.0 (copyleft — the community can fork and continue)
- **Surplus:** distributed annually as engagement-weighted grants to members
- **Direct artist revenue:** fan-to-artist subscriptions with 0% org take (≤2% operational fee for payment processing)

## Product, in one paragraph

Each artist gets a **24/7 channel** at `<slug>.tahti.fm` and a profile at `tahti.fm/u/<handle>`. They broadcast live from OBS, Mixxx, Traktor, or the browser, and edit in a **built-in pro audio editor**. Listeners tune in anonymously, chat ephemerally, download tracks, and can **subscribe directly to support artists** — money goes to the artist, not the org. **Tahti Radio** relays whichever channels are live. Venues publish calendar feeds. Each year, surplus returns to members as **grants** weighted by engagement (downloads and fan-support — not passive listening).

## Files

| File | Purpose |
|---|---|
| `docs/AGENT.md` | Build brief — milestones, data model, API, runbooks |
| `docs/strategy-and-product.md` | Positioning, member ownership, training handoff |
| `docs/governance-and-legal.md` | Yhdistys structure, bylaws sketch, AGPL |
| `docs/financial-model.md` | 3-year projections and unit economics |
| `docs/audio-editor.md` | In-browser pro editor — included for all artists |
| `docs/engagement-and-fansubs.md` | Grants, downloads, fan-subscriptions |
| `docs/tahti-radio-and-venues.md` | Meta-stream and venue calendars |
| `docs/profile-and-promo-toolkit.md` | Profile, releases, promo tools |
| `docs/funding-strategy.md` | Foundation grants and donations |
| `docs/transparency-policy.md` | Public ledger |
| `docs/storage-policy.md` | Storage approach |
| `docs/obs-and-broadcasting-guides.md` | OBS, Mixxx, Traktor onboarding |
| `docs/cdn-strategy.md` | European CDN |
| `infra/` | Docker Swarm stack, Caddy, Liquidsoap template |
| `slides/` | Community and business deck sources |

## Headline numbers (3-year plan)

| | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Paying members (€40/yr) | 200 | 1,200 | 4,000 |
| Total revenue | €34,946 | €104,964 | €281,272 |
| Surplus | −€19,436 | +€13,552 | +€114,152 |
| Artist grant pool | €0 | €12,197 | €102,737 |
| Fan-sub net to artists | €1,622 | €22,705 | €138,394 |

Over three years: ~€115k in grants + ~€163k direct fan-sub revenue to artists (~€278k total).

## Key decisions

1. **Member-owned.** Paying artists govern Tahti ry; the nonprofit is their legal and operational vehicle.
2. **Training then handoff.** Director trains member-operators; maintenance is shared, not outsourced forever.
3. **Grants reward engagement**, not passive listening.
4. **Fan-subs: 0% org cut** (2% ops fee covers Stripe/compliance only).
5. **Two tiers:** free-tier artist or paying member (€40/yr). At ~3,000+ members, fees cover in-house running costs.
6. **Pro audio editor** for every artist — not upsold.
7. **AGPL + forkable.** If leadership fails, the community can take the code and data and continue.
8. **Year 1 needs a founding grant** (~€19.5k bridge). See `docs/funding-strategy.md`.

— Tahti ry · Helsinki · 2026
