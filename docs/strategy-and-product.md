# Tahti ry — strategy & product positioning

## Positioning, in one sentence

A **member-owned** broadcasting platform for independent artists: the people
who use it govern it, and the nonprofit handles membership and maintenance
until they can run it themselves.

## Positioning, in three sentences

Each artist gets a 24/7 channel — live when they're broadcasting, their archive
when they're not. The platform is open source under AGPL, operated by **Tahti
ry**, a Finnish nonprofit. Paying artists are **members** with a vote; surplus
returns as grants weighted by real engagement (downloads and fan-support), on a
public ledger anyone can audit.

## Who owns Tahti

| Role | Who | What they do |
|---|---|---|
| **Owners** | Paying artists (members of Tahti ry) | Vote at the annual general meeting, propose bylaws changes, elect the board, approve accounts and grant formulas |
| **Legal operator** | Tahti ry (*yhdistys*) | Registers members, collects €40/yr membership fees, signs contracts, employs staff, files taxes and audits |
| **Day-to-day operations** | Director + trained members | Runs servers, deploys software, handles support — with a deliberate path from "one hired operator" to "member-maintained" |
| **Listeners** | Not members | Tune in free; optional fan-subscriptions pay artists directly |

**Tahti ry is not a startup with shareholders.** It is the nonprofit shell that
lets a community of artists own a shared tool without each person incorporating
alone. The association exists to:

1. **Hold membership** — one paying artist = one member = one vote
2. **Maintain the service** — hardware, software, backups, security, billing
3. **Train operators** — document runbooks; teach members who volunteer to help
4. **Publish transparent accounts** — monthly ledger, annual audit, public API
5. **Distribute surplus** — grants to members after costs and reserve

### Training and handoff

Early years: a **director** (paid employee of the association) runs
infrastructure and teaches interested members.

**Goal:** trained **member-operators** take on documented maintenance under
board supervision — monitoring, deploys, first-line support, treasurer
workflows. The nonprofit should not depend forever on a single external tech
hire. Capability transfers to the people on the platform.

**Training covers (minimum):**

- Reading the public transparency dashboard and monthly rollup
- Docker Swarm deploy and rollback (`docs/AGENT.md` runbooks)
- Channel orchestrator health checks and Liquidsoap restarts
- Member support triage (billing, broadcast credentials, archive uploads)
- AGM preparation (motions, member register export for PRH)

Members who complete training are listed in an internal **operators roster**
(roles: infra, support, treasurer — not all required). The board approves
roster changes at each AGM.

### If leadership fails

All code is **AGPL-3.0**. Members can export data, fork the codebase, and
continue on another host. Ownership is meaningful because **exit is real** —
the community is never locked to one vendor or one director.

## Who we serve

Working independent artists in EU electronic and adjacent scenes:

- DJs who run weekly or monthly broadcasts and want a permanent home
- Producers releasing originals who want broadcasting alongside DSP distribution
- Ambient artists running 24/7 mood stations
- Talk-radio podcasters wanting always-on with chat
- Scene collectives wanting a shared channel with rotating broadcasters

We are not for:

- Casual listeners browsing for new music (Spotify exists)
- Discovery-seekers (algorithmic platforms exist)
- Major labels (different power dynamic)
- Influencers building social audiences (Instagram exists)

## What the product is

Two artist tiers on owned infrastructure in Helsinki:

| Free-tier artist | Paying artist (€40/yr membership) |
|---|---|
| 1 channel, 5 archive items | Unlimited archive |
| **Pro audio editor (full)** | Same editor — export to archive, releases, channel |
| Live + basic chat | Auto-archive, moderation, analytics |
| Embed + smart link | 1 multistream (Mixcloud Live) |
| Inactive deletion after 60d | Fan-subs, downloads, newsletter |
|  | Pay-per-release DSP (€8 each) |
|  | **Member of Tahti ry** — vote, grants eligible |

**Unit economics:** €40/yr is set so that, at roughly **3,000+ paying artists**,
membership fees cover **running the service** on owned infrastructure. Early
years need grant bridge funding; at 4,000 members the model carries platform,
governance, and operations with surplus for grants. See `docs/financial-model.md`.

## Differentiation

Three things make Tahti distinct:

1. **Channel-first.** The channel is the primary object — live and archive
   stitched on one URL, with a **pro audio editor** included for every artist.
2. **Member-owned nonprofit.** Not a commercial platform extracting margin.
   Surplus returns to artists; governance belongs to members.
3. **Open source under AGPL.** Anyone running the code as a service must
   publish changes. Forks and self-hosting are encouraged.

## Why this works as a nonprofit

The competitive set is narrow (Mixcloud, SoundCloud, Bandcamp, Patreon-for-music).
None offer a 24/7 channel with live + archive fallback **and** member ownership.
We're filling a structural gap, not out-featuring a giant.

## Acquisition strategy

### Year 1 — hand-recruit 200 paying artists

- Director's network: Helsinki/Tallinn scene, collectives, university programs
- Invite-only beta; artists who will broadcast immediately
- Niche press (Resident Advisor tools, Wire, Native Instruments Blog)
- Conferences: Mutek, CTM, Sónar, Flow Helsinki — network, don't sponsor

### Year 2 — grow to 1,200

- Word of mouth; open free tier widely
- Open-source community presence (FOSDEM, audio conferences)
- Artist case studies
- Light social promotion to electronic-music micro-influencers

### Year 3 — 4,000 artists

- EU artist-development partnerships
- Cultural-org residencies broadcasting on Tahti
- Member-driven growth at AGM and beyond

## Geographic strategy

**Year 1:** Helsinki-centric (legal home, foundations, director).  
**Year 2:** EU/Nordic (Tallinn, Stockholm, Copenhagen, Berlin).  
**Year 3+:** English-language global availability; marketing stays EU-focused.

## Retention

**Engagement units** reward artists whose fans download and subscribe — not
passive listening. Secondary retention: channel as home base on flyers and bios,
archive as property, chat audience over time.

## What success looks like (Year 3)

- 4,000 paying members, ~70% renewal
- ~50 anchor channels with engaged audiences
- ~€103k in annual grants distributed
- Audited financials and functioning board
- **At least 5 trained member-operators** sharing maintenance with the director
- Mention in at least one major industry publication

## What failure looks like (early signals)

- **Q3 Year 1: <50 paying members** — pricing or product gap; consider temporary €25 membership
- **End Year 1: no founding grant** — defer features, reduce director hours, extend beta
- **End Year 2: renewal <50%** — diagnose product vs governance vs grant model
- **End Year 3: no member-operators trained** — operations still single-point-of-failure
- **Top 1% eats 80% of grants** — membership debates formula (square-root, floor, etc.)

## Why no venture capital

Nonprofits cannot issue equity. Mission returns surplus to artists, not investors.
Capital comes from **membership fees**, **grants**, and **donations** — not VC.

## What we're building toward

A durable **commons**: artists own the institution that hosts their channels,
learn to maintain it, and share the surplus fairly. Tahti ry is the legal and
operational wrapper that makes that possible — not a company selling access to
their own work back to them.
