# Tahti ry — constitution

The package is large. This document is the smallest. If a future director, board member, contributor, or coding agent reads only one file in this repository, this is the one that matters. Everything else in `docs/` is implementation detail in service of the three rules below.

These rules are constitutional. They are not changeable by management decision. They are changeable only by a 2/3 majority of the membership at the annual general meeting, with proposed changes published 60 days in advance.

## Rule 1. This is for artists, not for corporate

Tahti exists to put money, audience, and infrastructure in the hands of independent musicians. There is no other purpose. There are no shareholders. There is no exit. There is no acquisition. There is no "growth" KPI for its own sake. The org generates surplus only to redistribute it to the artists who created the value.

**What this looks like in practice:**

- The legal form is *yhdistys* (Finnish nonprofit association). It cannot be converted to a for-profit entity without dissolving the membership.
- 90% of operating surplus is distributed annually to artists as grants. The remaining 10% builds an operating reserve, capped at 6 months of average monthly costs. Above that cap, additional retention requires AGM vote.
- The org does not raise venture capital, take equity investment, or accept any funding instrument that requires future financial returns to the funder. Grants, donations, and member subscriptions only.
- Surplus from the 2% operational fee on fan-subscriptions rolls into the next year's grant pool. It is not org profit.
- Administration is paid fairly. Below-market wages produce burnout, governance liability, and director turnover. Above-market wages siphon money away from artists. The bylaws cap director compensation at 30% of revenue; the financial model targets a salary in the €30k-€50k range that is competitive for a Finnish nonprofit director role.
- Professional people are selected for administrative roles. "Founder runs it forever" is not a plan. The director role has a defined description, a hiring process, and a succession plan documented in `docs/governance-and-legal.md`.
- The board must include at least one elected artist representative from Year 2 onward. From Year 4, the majority of the board must be elected artist representatives.

**What this rules out:**

- Selling user data, listener data, or aggregated analytics to third parties. Ever.
- Advertising of any kind in the listener-facing product. Ever. (Transparency-report sponsorship acknowledgment is allowed; logos in players are not.)
- "Premium features" gated by artist tier in ways that punish free users. The free tier is a complete product (see Rule 3).
- Pivots toward listener subscriptions as the org's main revenue line. Direct fan-to-artist subscriptions are a feature *for artists*; converting them into "Tahti Premium" subscriptions to the org is forbidden by this rule.
- Board members or director receiving any non-salary compensation from the org's operations (no bonuses tied to revenue, no equity-like instruments, no profit-share).

## Rule 2. The most high-quality, useful, and community-driven platform — by design, not aspiration

Tahti's mission is to be the *best* broadcasting platform for independent artists, not a cheap alternative or a "ethical option." Quality is constitutional. This means concrete, verifiable commitments.

**Audio quality:**

- Paid members stream FLAC 16/44 (lossless) to all their listeners. Free listeners hear the same lossless audio when listening to a paid artist's channel. We do not cap audio quality at the listener tier. (SoundCloud caps free listeners at 128 kbps Opus; Mixcloud at 64 kbps AAC. Tahti does not.)
- WAV and FLAC accepted as upload formats. Originals are preserved as-is. Studio-quality 24-bit / 96 kHz uploads are not downsampled silently.
- Free artists broadcast at MP3 192 kbps — better than what most listeners get on a paid Mixcloud Pro stream — and can upgrade to lossless any time.

**Product usefulness:**

- The platform must do real work the artist needs: 24/7 channel with seamless live-to-archive transitions, real broadcasting tools (OBS / Mixxx / Traktor / browser ingest), real distribution (Spotify / Apple / Tidal via Revelator, Mixcloud direct), **release-ops tooling** (MusicBrainz submission, ISRC/UPC/credits, release checklist — M30), real promotional tooling (embed widget, smart links, social auto-post, newsletter), real analytics (engagement units, completion rates, embed sources).
- No feature ships unless an artist would actually use it. We do not build vanity features to mark roadmap completion.
- The product roadmap is published. Members vote on priority at AGM. The director's discretion is bounded by what members have approved.
- No vendor lock-in for artists. Export of all data (releases, archive, analytics, fan-sub records) must work and is tested quarterly. Forks of Tahti are explicitly welcome under AGPL.

**Community-driven:**

- Code is AGPL-3.0. Every page links to source. Anyone can run a fork; we encourage it.
- Bylaws are public, version-tagged, in the repository.
- Annual financial report is public, audited, in the repository.
- Engagement-unit ledger entries are public (with artist consent for attribution); aggregate flows visible on a transparency dashboard.
- Member proposals are accepted year-round and addressed at the AGM. There is no "founder mode" override on member votes.
- The director's compensation is published. Board minutes are published. Vendor contracts above €5,000/year are listed in `internal/data-processors.md` and the transparency dashboard.
- Contributing artists, contributing developers, contributing translators, contributing legal/financial reviewers — all explicitly recognized in a `CONTRIBUTORS.md` file.

**What this rules out:**

- Cutting corners on audio quality to save bandwidth cost. The Year 3 fiber upgrade is non-optional; if the budget doesn't support it, we delay other things, not audio quality.
- Closed-source modules, proprietary plugins, "enterprise tier" features that aren't AGPL.
- Strategic decisions made by the director without member input (beyond the operational range defined in §7 of the bylaws).
- Withholding information from members because it's "embarrassing" or "not yet ready." If the board has acted, members can see what was decided and why.

## Rule 3. The artist shines brightest. We don't rip off anyone in the chain.

We do not engineer the product around listener metrics. Listener-hours are vanity data. Listener-engagement-as-product (the SoundCloud / Spotify model) is rejected. The artist is the protagonist of every page, every flow, every metric.

**For artists:**

- The grant pool is distributed by **engagement units**, not listener-hours. Free downloads count 1×, paid downloads 5×, fan-subscription euros 1×. Passive listening produces no grant share. This rewards artists whose audiences actually care, not artists who farm passive plays.
- Fan-to-artist subscriptions take 0% org cut. A 2% operational fee covers Stripe + GDPR + customer support; the rest goes to the artist. If a competitor's "0%" turns out to mean "0% plus 5-10% in hidden fees," ours doesn't.
- The artist's profile is their home on the internet, designed to make them findable, bookable, and supportable. It is not designed to keep listeners on Tahti. Outbound links to Bandcamp, Spotify, the artist's personal site, their tour calendar — all promoted, never hidden.
- The artist owns their data. Export at any time. Account deletion is real deletion, not "deactivation." Their content is theirs; AGPL of the code does not bind their music.
- "Recommended for you" feeds are forbidden. Tahti has no algorithmic discovery. Discovery happens through the channel (live broadcast), the smart link, the embed widget on the artist's external sites, the Tahti Radio meta-stream (live-only, fair rotation), and word of mouth. There is no playlist economy on Tahti, by design.

**For listeners:**

- Anonymous by default. Fan-subscribers have accounts because billing requires it; everyone else listens, downloads, and chats anonymously.
- No tracking that isn't strictly required to make the product work. No cookies for analytics. IP hashes rotate daily; we cannot tell that the same listener came back yesterday.
- No upsell during listening. The "support directly" CTA is on the artist's profile. We do not interrupt audio to advertise upgrades, premium tiers, or anything else.
- Listeners can subscribe to artists without subscribing to Tahti. Tahti is plumbing; the relationship is between fan and artist.
- Free downloads stay free. Anti-fraud is rate-limited; legitimate listeners are not asked for accounts they don't need.

**For ourselves:**

- We pay our director a fair Finnish wage (€30-50k/yr range, depending on year and revenue), so we don't burn out or quit and leave the org rudderless. We do not pay ourselves more than that.
- We pay our vendors fairly. Stripe gets their fees passed through. Postmark/SES gets their per-thousand rate. UpCloud gets their bandwidth bill. We do not gouge vendors any more than we want vendors to gouge us.
- We pay our auditors and lawyers professionally. Cheap legal advice is expensive legal advice eventually.
- We do not pay ourselves "founder shares" or "equity-like compensation." There is no equity. There is no exit.
- We do not engineer fake scarcity. No "limited beta seats," no "fast-track upgrade for €X." The product is simply available to whoever wants to use it.

**What this rules out:**

- A "Most Played This Week" chart on tahti.live.
- A leaderboard of top artists by listener count.
- Surfacing listener data to artists in ways that gamify behavior ("you lost 3 listeners — try posting more!").
- Tahti-branded merchandise the artist did not consent to.
- Tahti as a brand placed above the artist's brand on any page. We are the infrastructure, not the headline.

## How this constitution interacts with the bylaws

The bylaws (§1-12 in `docs/governance-and-legal.md`) implement the constitution in legally-binding form for Finnish association law. Where bylaws and constitution agree, they are interchangeable. Where bylaws are silent, the constitution governs interpretation. Where bylaws conflict with this constitution (it shouldn't happen, but if it does), the bylaws hold for legal questions and this constitution holds for moral and operational ones, and the conflict is resolved at the next AGM.

The agent building Tahti must read this document first, AGENT.md second, and the implementation-specific docs after.

## How this constitution interacts with money

Three concrete financial expressions of the rules:

1. The Year-3 grant pool is forecasted at ~€130k. Of that, ~€260 per top-decile member, ~€19 per mid-decile, ~€4 per active-rest. Bottom-decile (<5 engagement units) are ineligible. This is the implementation of "the artist shines brightest" — but it's also the implementation of "we don't reward passive consumption."

2. The 2% operational fee on fan-subscriptions is *bounded by costs*. If it ever generates surplus, the surplus rolls into the next year's grant pool. The fee is reviewable annually by AGM; if Stripe + processing costs drop, the fee drops.

3. Director compensation is capped at 30% of revenue. At Year 1 (€35k revenue, modeled), the cap is €10.5k — so the modeled €30k Y1 salary actually requires either deficit financing (the founding grant) or a board waiver. The bylaws permit a board waiver up to €40k for Y1 if revenue is insufficient to fund a competitive director wage. This is explicit, voted on, public.

## The "we don't rip off" pledge in one paragraph

Tahti will never take a cut of fan-to-artist subscriptions. Tahti will never sell, share, license, or monetize listener data. Tahti will never raise venture capital or accept investment that requires returns. Tahti will never gate audio quality at the listener tier. Tahti will never deny artists the ability to take their data and leave. Tahti will never run advertisements. Tahti will never gamify the platform to make artists post more or listeners listen more. If any of these change, the constitution has been amended at AGM with 2/3 majority and 60 days' notice — and we will publish the vote.

— Effective from incorporation. Approved by founding board on (DATE). To be confirmed by first AGM (DATE+18 months).
