# Tahti ry — roadmap & project plan

This document is the concrete plan for turning the package into a living organization with a working product. It complements `AGENT.md` (which is the coding-agent brief). This is the *human* project plan — what happens, when, who does it, what depends on what.

Three phases: **Pre-incorporation**, **Phase 1 (Months 1-9)**, **Phase 2 (Months 10-24)**, **Phase 3 (Months 25-36)**.

## Phase 0: Pre-incorporation (Months -3 to 0)

Before any code is written or any subscription is taken, six things must be done. None of them are technical.

### Month -3 to Month -2: Legal & governance foundation

| Task | Owner | Output | Dependency |
|---|---|---|---|
| Register tahti.fi domain at Traficom | Founder | Domain ownership | — |
| Verify "Tahti" trademark availability (PRH search, EUIPO TMview) | Lawyer | Clearance memo | — |
| Draft yhdistys bylaws based on `docs/governance-and-legal.md` | Lawyer + founder | Signed bylaws | Constitution finalized |
| Recruit founding board (3 people incl. founder) | Founder | Board appointment letter | — |
| File yhdistys registration with PRH (Patent and Registration Office) | Lawyer | Y-tunnus issued | Bylaws signed |
| Open business bank account at OP, Nordea, or Aktia | Founder | Account number | Y-tunnus issued |

**Output of Month -2:** registered yhdistys with bylaws, Y-tunnus, bank account.

### Month -2 to Month -1: Funding round

| Task | Owner | Output | Dependency |
|---|---|---|---|
| Prepare Business Finland Tempo application | Founder + Tempo coach | Submitted application | Y-tunnus, financial model |
| Prepare Koneen Säätiö application | Founder | Submitted application | Y-tunnus |
| Prepare Suomen Kulttuurirahasto application | Founder | Submitted application | Y-tunnus |
| Soft-confirm any aligned donors (founding-circle gifts up to €5k each) | Founder | Pledge letters | — |
| Set Founder's personal financial floor (3 months runway in personal savings minimum, to survive grant-decision lag) | Founder | Bank statement check | — |

**Output of Month -1:** 3-4 applications submitted with €25-50k targeted total; founder has personal runway.

**Critical gate:** if no grant funding lands by Month 0, the project pauses. Do not start hiring or building until at least one €15k+ grant is confirmed. This is the constitution speaking: we do not run on personal credit cards.

### Month 0: Incorporation complete

| Task | Owner | Output |
|---|---|---|
| First grant decision received (estimated: Koneen Säätiö March round or Tempo within 4 weeks) | Foundation | Funding confirmation |
| Director hired (could be founder, formalized contract) | Board | Employment contract |
| Treasurer appointed (could be board member with finance background) | Board | Letter of appointment |
| Initial accountant retained | Director | Contract signed |

---

## Phase 1: MVP build (Months 1-9)

**Goal:** ship a working channel-first product to a private beta of 30-50 hand-recruited Helsinki artists. Get to the point where an artist can broadcast OBS → channel → archive, listeners can tune in and chat, and the artist can publish a release.

The agent reference is `docs/AGENT.md` with milestones M0-M11. This roadmap maps those to calendar weeks and adds operational/community tasks the agent doesn't see.

### Months 1-2: Foundation (M0-M2)

**Agent work:**
- M0 — skeleton (repo, CI, infra/dev compose, Caddy + nginx baseline)
- M1 — artist accounts + membership
- M2 — channel + archive uploads

**Director work:**
- Set up DevOps: server racked in Helsinki, business fiber installed, UpCloud account created with DPA signed
- Set up Stripe account (Connect Express enabled)
- Set up Postmark + SES accounts, DPAs signed
- Write privacy policy + terms of service (lawyer-reviewed)
- Set up GitHub/Gitea repository, AGPL LICENSE committed at root

**Decision gate (end of Month 2):**
- Is the infrastructure stable enough to begin alpha testing?
- Are legal docs ready for first user signup?
- If no, push back beta launch.

### Months 3-4: Live broadcasting (M3-M5)

**Agent work:**
- M3 — live ingress + channel orchestrator (RTMP + Icecast)
- M4 — auto-archive of live broadcasts
- M5 — live chat (Centrifugo, ephemeral, fingerprint moderation)

**Director work:**
- Recruit 5 alpha-testing artists (close friends, willing to bear with bugs)
- Write `docs/obs-and-broadcasting-guides.md` field-tested guides
- Establish support channel (email + Matrix room)

**Decision gate (end of Month 4):**
- Can a non-technical artist follow the OBS guide and broadcast?
- Does the channel-to-archive transition work without listener drop-off?
- Does chat hold up under 50 concurrent users?

### Months 5-6: Distribution + transparency (M6-M8)

**Agent work:**
- M6 — multistream out (RTMP push to Mixcloud, optional artist-side destinations)
- M7 — distribution: Mixcloud auto-upload + Revelator DSP submission
- M8 — transparency ledger (append-only Postgres schema, public dashboard)

**Director work:**
- Sign contract with Revelator (negotiate startup pricing)
- Apply for ISRC membership through IFPI Finland
- Open Mixcloud Pro account in Tahti's name (for Tahti Radio)
- Begin private beta recruitment: 30 artists across Helsinki + Tampere + Turku scenes
- Run first AGM (incorporation requirement: within 6 months)

**Decision gate (end of Month 6):**
- Has at least one release been distributed to Spotify successfully?
- Is the transparency ledger live and showing real ledger entries?
- Has a friendly auditor reviewed the codebase + financial pipeline?

### Months 7-8: Grants + governance (M9-M10)

**Agent work:**
- M9 — annual grant calculation + disbursement (engagement-unit math, Stripe Connect payout, manual review queue)
- M10 — member governance UI (AGM voting, proposal submission)

**Director work:**
- Document financial year close procedure
- First end-of-year audit prep (even if pro-forma in Y1)
- Recruit elected artist board member candidate for Year 2 AGM
- Begin engaging with Finnish music industry orgs (Music Finland / Musex, Finnish Musicians' Union)

### Month 9: Hardening + launch (M11)

**Agent work:**
- M11 — hardening + audit prep (rate limiting, audit log, backup verification, security review)

**Director work:**
- Open public signup at tahti.fi
- Launch announcement to scene press (Rumba magazine, Soundi, regional radio)
- Onboard founding cohort: target 200 paid members by end of Month 12

**Decision gate (end of Month 9):**
- Is the product good enough to charge €40 for?
- Are professional services in place (accountant, lawyer, auditor)?
- Have at least 50 alpha-beta artists actively used the platform?

If all three are yes, launch publicly. If any are no, delay launch.

---

## Phase 2: Profile + promo + scale (Months 10-24)

**Goal:** reach 1,200 paid members, ship the promo toolkit, prove the engagement-unit grant model works on a real fiscal year.

### Months 10-12: Profile & releases (M12)

**Agent work:**
- M12 — modern artist profile + releases (bio, release timeline, embed widget, smart links)

**Director work:**
- Hire second engineer (contractor first, full-time when revenue allows) — by Month 18 at the latest
- Run grants distribution dry-run on Q4 data (test the math without distributing)
- Recruit artist board representative; hold election at second AGM

### Months 13-15: Newsletter & social (M13)

**Agent work:**
- M13 — newsletter & fan email list

**Director work:**
- Sign vendor contracts (Postmark scaled, ACRCloud quota)
- File first full audit (revenue should be >€50k at this point)
- Apply for Y2 foundation grants (continuing grants from Tempo, new from Creative Europe Culture)

### Months 16-18: Promo toolkit (M14)

**Agent work:**
- M14 — embed widget, smart links, social auto-post, track analytics

**Director work:**
- Hire customer support contractor (part-time, escalation only)
- Run second AGM with elected artist board seat
- **First real grant distribution** to artists (Q1 of Y2, based on Y1 engagement units)

### Months 19-21: Tagging + radio + venues (M15-M17)

**Agent work:**
- M15 — artist tagging (@-mentions, opt-in notifications)
- M16 — Tahti Radio meta-stream (Liquidsoap container, Mixcloud Live multistream)
- M17 — venue calendar API (iCalendar feeds, venue profiles)

**Director work:**
- Onboard first venue partners (5-10 Helsinki/Tampere/Turku venues)
- Press cycle for Tahti Radio launch
- Begin EU expansion conversations (Estonia, Sweden, Germany)

### Months 22-24: Engagement features (M18-M20)

**Agent work:**
- M18 — downloads as first-class action (anti-fraud, dedup, weighted scoring)
- M19 — fan-to-artist subscriptions (Stripe Connect onboarding, fan tiers, payout cron)
- M20 — tier gating (free 1hr/week + paid lossless, graceful transitions)

**Director work:**
- Y2 close + audit
- Y2 grants distributed (forecast: ~€20k pool across active members)
- Y3 grant funding round (Tempo / Koneen / SKR continuation)
- Begin hiring discussion for full-time second engineer

**Decision gate (end of Month 24):**
- Has the org distributed real grants to real artists?
- Has the engagement-unit model held up against scrutiny at AGM?
- Is the org self-funding from operations (revenue covers cost ex-grants)?

If yes, Phase 3 is execution. If no, retrench and re-plan with the membership.

---

## Phase 3: Scale + sustainability (Months 25-36)

**Goal:** reach 4,000 paid members, distribute €130k+ in grants, establish Tahti as the credible nonprofit broadcasting platform for EU independent artists.

### Months 25-30: Infrastructure scale-up

- 10 Gbps business fiber upgrade installed in Helsinki (Y3 budget line)
- Storage capacity expansion (NVMe + cold tier)
- Second engineer fully hired
- First customer support FTE (or scaled contractor)
- Second director-track hire begins (succession planning)

### Months 31-33: Geographic expansion

- Estonia: tahti.ee redirected + Estonian-language UI; onboard Tallinn scene
- Sweden: tahti.se redirected + Swedish UI
- Germany: tahti.de redirected + German UI
- Translate critical docs (privacy, terms, OBS guide)

### Months 34-36: First real fiscal-year grant distribution

- Q1 Y4: ~€130k distributed across ~3,200 eligible artists
- Public transparency report published
- Press cycle highlighting the model's first full proof
- AGM #4: artist majority on board now mandatory per bylaws

---

## Critical dependencies

The roadmap is sequential; certain things must happen in order.

### Blocking dependencies

```
Y-tunnus → bank account → Stripe account → fan-subs feature
            ↓
            grant applications → founding funding → director hired
                                                    ↓
                                                    code begins (M0)
```

### Risk concentration points

1. **Month 0 grant landing:** if no grant lands by Month 0, the whole plan is delayed. Founder's personal runway has to cover personal expenses; otherwise founder has to take other employment and Tahti pauses.

2. **Month 9 launch readiness:** if M0-M11 takes 12 months instead of 9 (likely scenario, given solo founder + occasional contractor), the launch slips and Year 1 paid count is below 200.

3. **Month 12 paid-member count:** if Tahti has fewer than 100 paid members by end of Y1, Year 2 grant applications become harder. Recovery requires renewed grant-application focus and possibly a director-salary reduction.

4. **Month 24 grant distribution:** if the engagement-unit math produces controversial results (e.g. top-decile gets 80% of pool), the AGM may amend the formula. Build the M9 grant code to be parameter-driven, not hardcoded, so amendments are configuration changes, not engineering work.

5. **Month 30 fiber upgrade:** if 10 Gbps fiber in Helsinki costs >€2,500/month (vs the budget €1,500/month), the org may need to defer the upgrade. The fallback is routing more egress through UpCloud (cheaper per-GB, but lower SLA). Negotiate the fiber contract in Month 24, lock in pricing.

---

## Quarterly review cadence

Every quarter the board reviews:

1. Financial position (revenue, cost, runway, grant-pipeline status)
2. Membership growth + retention
3. Engagement units accumulated (for grant projection)
4. Open complaints/disputes (from artists and from fans)
5. Roadmap progress vs plan
6. One specific bylaws-or-constitution question (rotating)

The director publishes the board minutes (redacted only for personnel privacy) on the transparency dashboard within 30 days.

---

## What we will not do

A list of things proposed but rejected as scope creep that would compromise Phase 1 delivery:

- Native mobile apps in Year 1 (PWA only; native by Year 3 if member demand justifies it)
- Custom-built ingest hardware (we use commodity x86 + open-source stack)
- Multi-region deployment in Year 1 (all-Helsinki; EU expansion via UI/lang, not separate infra)
- Video broadcasting (audio-only platform; video is YouTube's job)
- Direct-to-fan merch sales (link out to Bandcamp)
- Listener subscription tier called "Tahti Premium" (forbidden by constitution Rule 3)
- Algorithmic discovery features (forbidden by constitution Rule 3)
- A "Tahti app" for listeners separate from the web player (PWA covers this need at lower cost)

---

## How this differs from a typical SaaS roadmap

Three structural differences worth naming:

1. **Phase 0 is non-negotiable and unbudgeable.** A typical SaaS roadmap starts with "ship MVP in 90 days." Tahti's Phase 0 (legal + governance + grants) is 3 months before Month 1. If you compress this phase, you build on sand.

2. **The director-salary line item is real and not aspirational.** Many nonprofits ship Year 1 with the founder unpaid or paid €0. The constitution rejects this. If the budget doesn't fund a director, the project should not proceed to Phase 1.

3. **No "growth hacking" milestones.** No "viral loop" feature, no "growth team" hire, no "performance marketing budget." Growth comes from the product working, the artists telling their networks, and grant officers vouching for the model. If it doesn't grow this way, it shouldn't grow.
