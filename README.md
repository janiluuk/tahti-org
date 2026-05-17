# Tahti ry — implementation package (v7)

A Finnish nonprofit, open-source, channel-first broadcasting platform for independent artists.

- **Legal form:** Finnish *yhdistys* (registered nonprofit association)
- **License:** AGPL-3.0
- **Surplus:** distributed annually as engagement-unit-weighted artist grants
- **Direct artist revenue:** fan-to-artist subscriptions with 0% org take (operational fee only, ≤2%)
- **Hosting:** owned hardware in Helsinki, UpCloud (Helsinki) for spillover, no CDN
- **Mission:** give independent musicians and DJs a broadcasting home that doesn't extract from them

## Product, in one paragraph

Each artist gets a **24/7 channel** at `<their-handle>.tahti.fi` and a **modern profile page** at `tahti.fi/u/<handle>`. They broadcast live from OBS, Mixxx, Traktor, browser, or anything else. Listeners tune in anonymously, chat ephemerally, download tracks and mixes, and can subscribe directly to support their favorite artists — we take 0% of fan support (only a 2% fee covers Stripe and ops). Tahti Radio is the org-operated meta-stream that relays whichever channels are currently live, multistreamed to Mixcloud. Originals reach Spotify/Apple/Tidal via Revelator; mixes reach Mixcloud. Artists tag each other in bios and announcements. Venues publish iCalendar feeds of broadcasts on their premises. Every year the org's surplus is distributed as grants weighted by engagement units — paid downloads count 5×, free downloads count 1×, fan-sub euros count 1× each.

## Pricing (v7 — single paid tier)

| | Free | Tahti — €40/year |
|---|---|---|
| Channel | ✓ | ✓ |
| Archive uploads | ✓ | ✓ (unlimited) |
| Profile + releases | ✓ | ✓ |
| Live chat + announcements | ✓ | ✓ |
| Downloads (free + paid listeners) | ✓ | ✓ |
| Fan-subscriptions enabled | ✓ | ✓ |
| Multistream | — | ✓ (unlimited destinations) |
| Mixcloud auto-upload | — | ✓ |
| DSP distribution | — | ✓ (pay €8/release) |
| Newsletter | — | ✓ (4 sends/week) |
| Social auto-post | — | ✓ |
| Custom domain | — | ✓ |
| API access | — | ✓ |
| **Audio quality (broadcasts)** | **MP3 192 kbps** | **Lossless (FLAC stream + FLAC download)** |
| **Live broadcasting time** | **1 hour / week** | **Unlimited** |
| **Member of the association** | — | ✓ — eligible for annual grants |

**The philosophy:** free users are not forced to upgrade by friction. They get a complete, working product with MP3 audio and 1 hour of live broadcasting per week. People upgrade because they want more — not because they're frustrated.

## What changed in v7

- **Renamed Replay → Tahti.** Finnish name, registered for verification at PRH.
- **Single paid tier at €40/year.** Studio tier (€120) dropped. Cleaner membership story.
- **Free tier sharpened:** 1 hour of live broadcasting per week (otherwise full product), MP3 audio quality.
- **Lossless for paid users:** FLAC streaming + FLAC download for all paid members.
- **No CDN in financial model.** Hosting is owned hardware in Helsinki, on business fiber, with **UpCloud Helsinki** as spillover for static content.
- **Sharper competitive positioning** in `docs/strategy-and-product.md` — direct critiques of SoundCloud/Mixcloud quality, Spotify AI saturation, Bandcamp as storage-only.

## Files

| File | Purpose |
|---|---|
| `docs/AGENT.md` | Coding-agent brief — repo, milestones (M0–M19), data model, OBS guides, transparency dashboard |
| `docs/profile-and-promo-toolkit.md` | Profile spec, release model, embed/smartlink/social/newsletter/analytics |
| `docs/engagement-and-fansubs.md` | Engagement units, downloads, fan-subscriptions |
| `docs/tahti-radio-and-venues.md` | Meta-stream + venue calendar API |
| `docs/financial-model.md` | 3-year financial model |
| `docs/governance-and-legal.md` | Yhdistys structure, AGPL, bylaws sketch |
| `docs/funding-strategy.md` | Foundation grants, donations, sponsorship policy |
| `docs/transparency-policy.md` | Public ledger commitment |
| `docs/storage-policy.md` | Soft-target storage, no enforced limit |
| `docs/obs-and-broadcasting-guides.md` | Per-tool onboarding |
| `docs/infra-strategy.md` | Self-hosted infrastructure: owned hardware + UpCloud spillover, no CDN |
| `docs/strategy-and-product.md` | Channel-first positioning + competitive critiques |
| `infra/docker-stack.yml`, `Caddyfile`, etc. | Infra configs |
| `slides/Tahti-Community.pptx` | 12-slide artist-facing deck |
| `slides/Tahti-Business.pptx` | 12-slide governance + sustainability deck |

## Headline numbers (v7)

| | Y1 | Y2 | Y3 |
|---|---|---|---|
| Paying artists | 200 | 1,200 | 4,000 |
| Total org revenue | €35,426 | €107,844 | €290,872 |
| Total costs (incl. director salary €30–45k) | €54,572 | €85,692 | €146,720 |
| **Surplus** | **-€19,146** | **+€22,152** | **+€144,152** |
| **Grant pool (90% of surplus)** | **€0** | **€19,937** | **€129,737** |
| **Fan-sub gross to artists** | €1,800 | €25,200 | €153,600 |
| **Fan-sub net to artists** | €1,622 | €22,705 | €138,394 |

Cumulative 3-year:
- Grants distributed: ~€150,000
- Fan-sub revenue direct to artists: ~€163,000
- **Total artist money: ~€312,000**
- Director compensation: €115,000

Per-artist net income by scenario (inactive, typical, top decile): see
**Artist income by scenario** in `docs/financial-model.md`.

## What's on record

1. **Y1 needs a founding grant of €20-25k.** ~€19k deficit on the model; one Tempo or Koneen grant covers it. Without it, the org can't start.

2. **No CDN means no recurring CDN line — but lossless streaming at Y3 scale requires either a 10 Gbps business fiber pipe (~€18k/yr in Helsinki) or routing significant traffic through UpCloud Helsinki (also paid by the GB).** The model assumes fiber upgrade by Y3. If concurrent listeners exceed 1,500 sustained before Y3, this gets pulled forward. Sensitivity analysis in `docs/financial-model.md`.

3. **The single-tier model is cleaner but less profitable.** Studio tier would have added ~€120k/yr revenue at Y3 (~€100k more surplus, ~€90k more grants). The trade-off was simplicity of membership story.

4. **Free users get a complete product.** Not a feature-limited trial. The only restrictions are MP3 audio (vs lossless) and 1 hour of live broadcasting per week. Everything else — chat, profile, releases, downloads, fan-subs, archive playback, multistream is gated to paid — is the same as paid users. We do not break things to force conversion.

5. **AGPL means anyone can fork.** Moat is the hosted instance plus the artist network on it, not the code.

6. **Listener-hours are still a vanity metric only.** Grant share comes from engagement units (downloads + fan-sub euros). See `docs/engagement-and-fansubs.md`.

7. **Director salary unchanged.** €30k/€40k/€45k. Cumulative €115k over 3 years.

8. **Competitive positioning is sharper.** See `docs/strategy-and-product.md` for the four critiques (Mixcloud/SoundCloud quality cap, Spotify AI saturation, Bandcamp as storage-only).

— Generated 2026-05-17
