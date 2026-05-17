# Tahti — project roadmap & handover checklist

Master task list to go from **documentation package → funded nonprofit → working
platform → tested beta → operation by Tahti ry** (with trained member-operators).

**Status today:** specs, infra templates, and financial model exist; **application
code is not started** (`docs/AGENT.md` milestones M0–M20).

**Target Year 1 plan:** 200 paying members · founding grant for capex/growth ·
first AGM · handover-ready ops by month 12–18. Ops balance without a fixed
salary line; maintenance team paid equally from surplus when positive.

Use this as a GitHub Project / issue checklist (`- [ ]` = open).

---

## How to read this

| Column | Meaning |
|---|---|
| **Owner** | Who does the work: `Director`, `Board`, `Dev`, `Treasurer`, `Members` |
| **Depends** | Must be done first |
| **Doc** | Detailed spec |

**Recommended build order:** legal + grants in parallel with **MVP (M0–M5)** →
closed beta → **M7–M9, M19** (money + grants) → remaining features → handover.

---

## Phase 0 — Association exists (blocking everything)

Without Tahti ry registered, you cannot sign grant agreements, employ a director,
or collect memberships.

| Done | Task | Owner | Depends | Doc |
|:---:|---|---|---|---|
| [ ] | Agree founding purpose, name **Tahti ry**, fiscal year (calendar) | Board | — | `governance-and-legal.md` |
| [ ] | Draft bylaws (*säännöt*) from sketch → Finnish legal review | Board | purpose | `governance-and-legal.md` |
| [ ] | Hold founding meeting (min. 3 founders); sign minutes | Board | bylaws draft | — |
| [ ] | Register association at PRH (~€100) | Board | founding meeting | `governance-and-legal.md` |
| [ ] | Open association bank account | Treasurer | PRH registration | — |
| [ ] | Elect interim board (chair, treasurer, tech trustee) | Board | registration | `governance-and-legal.md` |
| [ ] | Appoint director + define maintenance team roster (equal surplus share, §10 cap) | Board | bank account | `governance-and-legal.md` |
| [ ] | Register VAT if revenue expected >€15k in Y1 | Treasurer | bank account | `governance-and-legal.md` |
| [ ] | GDPR processing register + privacy policy published | Director | — | `governance-and-legal.md` |
| [ ] | Sign DPAs: Stripe, Revelator, Mixcloud, UpCloud, email provider | Director | accounts | `cdn-strategy.md`, `infra-strategy.md` |

**Exit criteria:** PRH registration number, bank account, board elected, director
employed, bylaws filed.

---

## Phase 1 — Grants & runway (start in parallel with Phase 0)

Goal: secure **≥€20k** to bridge Year 1 deficit (`financial-model.md`).

| Done | Task | Owner | Effort | Doc |
|:---:|---|---|---|---|
| [ ] | One-page project summary + budget (Y1–Y3 from financial model) | Director | 1 day | `financial-model.md` |
| [ ] | Deck / leave-behind for foundations (community + business slides) | Director | 1 day | `slides/` |
| [ ] | **Business Finland Tempo** — gap analysis + application | Director | 30–50 h | `funding-strategy.md` |
| [ ] | **Koneen Säätiö** — application (cultural innovation angle) | Director | 20–30 h | `funding-strategy.md` |
| [ ] | **Suomen Kulttuurirahasto** — regional/central application | Director | 15–25 h | `funding-strategy.md` |
| [ ] | Track co-funding narrative (membership ramp + committed director time) | Treasurer | 4 h | `funding-strategy.md` |
| [ ] | Grant income recorded in transparency ledger when awarded | Treasurer | — | `transparency-policy.md` |
| [ ] | Plan B if only €15k lands: defer capex, trim legal, maintenance unpaid until surplus | Board | 2 h | `funding-strategy.md` |

**Milestones:**

- [ ] **G1** — at least one application submitted (all three preferred)
- [ ] **G2** — ≥€20k grant committed or equivalent donation + member pre-sales
- [ ] **G3** — Y2 grant pipeline started (Koneen renewal, Helsinki culture, Musex)

---

## Phase 2 — Infrastructure & hardware (before public beta)

| Done | Task | Owner | Depends | Doc |
|:---:|---|---|---|---|
| [ ] | Procure Y1 hardware (servers, NVMe, UPS) per capex budget | Director | G2 or bootstrapped | `financial-model.md` |
| [ ] | Helsinki business fiber contract (symmetric gigabit) | Director | hardware | `infra-strategy.md` |
| [ ] | UpCloud Helsinki account for spillover/static | Dev | — | `infra-strategy.md` |
| [ ] | Backup colocation / DR target chosen | Dev | — | `infra-strategy.md` |
| [ ] | Domain **tahti.fm** + DNS → Caddy on owned edge | Dev | association exists | `infra/Caddyfile` |
| [ ] | Docker Swarm (or Compose staging) from `infra/docker-stack.yml` | Dev | hardware | `infra/docker-stack.yml` |
| [ ] | Secrets management (Docker secrets / sops) documented | Dev | stack up | — |
| [ ] | Staging environment mirrors production topology | Dev | M0 | — |
| [ ] | Monitoring + alerting (uptime, disk, Liquidsoap health) | Dev | stack up | — |
| [ ] | Negotiate 10 Gbps fiber quote for Y3 (risk item in financial model) | Director | Y1 running | `financial-model.md` |

**Exit criteria:** staging URL serves health checks; production hardware racked;
runbook for reboot / failover exists.

---

## Phase 3 — Implementation: MVP (broadcasting beta)

Minimum to put **20–50 scene artists** on air. Full acceptance criteria in
`docs/AGENT.md`.

| Done | Milestone | Summary | Owner |
|:---:|---|---|---|
| [ ] | **M0** | Monorepo, AGPL, CI, dev compose, `/health`, `/source` | Dev |
| [ ] | **M1** | Artist signup, email verify, €40 membership, member register export | Dev |
| [ ] | **M2** | Channel, resumable archive upload, transcode pipeline | Dev |
| [ ] | **M3** | Icecast + RTMP + browser live; Liquidsoap per channel; public channel page | Dev |
| [ ] | **M4** | Auto-archive live sets to archive | Dev |
| [ ] | **M5** | Live chat (Centrifugo), announcements, moderation | Dev |
| [ ] | **M20** (partial) | Free tier: 1 hr/week live + MP3; paid: FLAC + unlimited live | Dev |

**MVP test matrix (must pass before inviting beta artists):**

| Done | Test | Method |
|:---:|---|---|
| [ ] | Register → verify email → pay €40 → appear in member export | manual + automated |
| [ ] | OBS guide: copy-paste RTMP → LIVE within 5s | `obs-and-broadcasting-guides.md` |
| [ ] | Mixxx / Icecast path works | manual |
| [ ] | Stop broadcast → archive within 10s, no silence | manual |
| [ ] | Chat: anonymous join, 24h expiry, artist ban | manual |
| [ ] | Free user hits weekly hour cap gracefully | M20 |
| [ ] | Paid channel streams FLAC; free channel MP3 | M20 |
| [ ] | Load test: N concurrent listeners on one channel | script |

**Exit criteria:** 5 internal dogfood channels running 48h without intervention.

---

## Phase 4 — Implementation: money, transparency, grants

Required before first **real** membership money and first grant cycle.

| Done | Milestone | Summary | Owner |
|:---:|---|---|---|
| [ ] | **M8** | Public transparency ledger + monthly rollup API | Dev |
| [ ] | **M7** | Mixcloud upload + Revelator wizard (€8/release) | Dev |
| [ ] | **M9** | Annual engagement-unit grant cron + payout + report | Dev |
| [ ] | **M19** | Fan-subscriptions (Stripe Connect, 0% org take, 2% ops fee) | Dev |
| [ ] | **M10** (core) | Member directory, motions, voting, bylaws display | Dev |

**Test matrix:**

| Done | Test |
|:---:|---|
| [ ] | Stripe membership + webhook → ledger entry |
| [ ] | Fan-sub: listener pays → artist Connect payout → 2% ops fee line |
| [ ] | Download → engagement unit increments (see `engagement-and-fansubs.md`) |
| [ ] | Grant dry-run on synthetic Y1 data matches spreadsheet |
| [ ] | `/transparency` matches ledger exports |

---

## Phase 5 — Implementation: artist-facing product (post-MVP)

Can ship incrementally during beta.

| Done | Milestone | Summary | Priority |
|:---:|---|---|---|
| [ ] | **M12** | Profile + releases + smart links | High |
| [ ] | **M20** (complete) | Tier gating polish, upgrade UX | High |
| [ ] | **M18** | Anonymous + fan downloads, anti-fraud | High |
| [ ] | **M14** | Embed, smart links, social auto-post, analytics | Medium |
| [ ] | **M13** | Newsletter | Medium |
| [ ] | **M6** | Multistream (Mixcloud Live only) | Medium |
| [ ] | **M16** | Tahti Radio meta-stream | Medium |
| [ ] | **M15** | Artist @-mentions | Low |
| [ ] | **M17** | Venue calendar API | Low |
| [ ] | **M11** | Rate limits, hCaptcha, audit export for accountant | High before Y2 audit |

**Exit criteria:** profile URL shareable; downloads + fan-subs used by ≥10 beta artists.

---

## Phase 6 — Implementation: pro audio editor

Spec in `audio-editor.md` (add as **M21** in `AGENT.md` when implementation starts).

| Done | Task | Owner | Doc |
|:---:|---|---|---|
| [ ] | Browser editor (waveform, trim, normalize, export) | Dev | `audio-editor.md` |
| [ ] | Bounce worker → archive / release pipeline | Dev | `AGENT.md` |
| [ ] | Editor load test (large WAV, 1h DJ mix) | Dev | — |

---

## Phase 7 — Closed beta → open beta (200 artists)

Aligned with `strategy-and-product.md` acquisition plan.

| Done | Task | Owner | When |
|:---:|---|---|---|
| [ ] | Recruit **10 anchor artists** (director network, invite-only) | Director | Month 1–3 |
| [ ] | Beta feedback form + issue triage process | Dev | Month 2 |
| [ ] | Weekly beta office hours (Discord/video) | Director | Month 2–6 |
| [ ] | Fix P0 bugs within 48h SLA | Dev | ongoing |
| [ ] | Publish OBS / Mixxx / Traktor guides on dashboard | Dev | M3 done |
| [ ] | Expand to **50 artists**; stress-test storage + fiber | Dev | Month 4–6 |
| [ ] | Press: RA tools / Wire / scene blogs (nonprofit + AGPL angle) | Director | Month 6 |
| [ ] | Open free tier widely; target **200 paying** by month 12 | Director | Month 6–12 |
| [ ] | First **AGM**: approve accounts, grant formula, board | Board | Month 12–15 |
| [ ] | First real **grant distribution** (if surplus > 0) | Treasurer | after AGM |

**Beta acceptance per artist:**

- [ ] Channel live ≥1h/week or archive fallback audible
- [ ] Profile published
- [ ] At least one broadcast tool guide completed
- [ ] Consent to beta terms + GDPR

---

## Phase 8 — Handover to the association

Goal: Tahti ry runs the platform **without depending on a single external
contractor**. Director may remain employed, but **members can operate it**.

### 8a — Documentation package

| Done | Deliverable | Owner |
|:---:|---|---|
| [ ] | `ops/RUNBOOK.md` — deploy, rollback, backup restore | Dev |
| [ ] | `ops/INCIDENTS.md` — outage comms, escalation | Dev |
| [ ] | `ops/ONBOARDING-OPERATOR.md` — training syllabus | Director |
| [ ] | `ops/TREASURER.md` — ledger import, grant payout, PRH export | Treasurer |
| [ ] | `ops/AGM-PLAYBOOK.md` — motions, voting, minutes template | Board |
| [ ] | Architecture diagram (hardware, Swarm, data flows) | Dev |
| [ ] | Credential inventory (who has access to what) | Director |
| [ ] | Vendor contact list (fiber, UpCloud, Stripe, Revelator) | Director |

### 8b — Operator training (target: 5 members by end Y1)

Tracks from `governance-and-legal.md` §7.b:

| Done | Trainee completes | Trainer |
|:---:|---|---|
| [ ] | **Infra track** — deploy, restart Liquidsoap, read monitoring | Dev |
| [ ] | **Support track** — credentials, chat abuse, membership billing | Director |
| [ ] | **Treasurer track** — transparency dashboard, Stripe, grant export | Treasurer |
| [ ] | Operators roster approved at AGM | Board |
| [ ] | Runbook dry-run: restore from backup | Operators |

### 8c — Legal & asset transfer

| Done | Task | Owner |
|:---:|---|
| [ ] | GitHub org **tahti-ry** owns repo; director has admin, not sole owner | Board |
| [ ] | Domains, TLS certs, Stripe account owned by association | Board |
| [ ] | Hardware asset register (association property) | Treasurer |
| [ ] | Director role description + maintenance team compensation policy (equal split) | Board |
| [ ] | Director liability insurance (~€500/yr) | Board |
| [ ] | Annual audit firm engaged before €100k revenue (Y2) | Treasurer |

### 8d — Governance rhythms

| Done | Rhythm | Owner |
|:---:|---|---|
| [ ] | Monthly transparency rollup published ≤30 days | Treasurer |
| [ ] | Board meeting monthly (director report) | Board |
| [ ] | AGM annually (March): accounts, grants, board election | Board |
| [ ] | Member motions: 7-day circulation before vote | Board |
| [ ] | Bylaws changes via PR + member vote (⅔ if required) | Board |

**Handover exit criteria:**

- [ ] At least **3 trained operators** + director can take 2-week vacation without outage
- [ ] AGM completed with audited narrative (or qualified review if below threshold)
- [ ] All credentials in association name or shared vault with board access
- [ ] New member can join, pay €40, broadcast, and receive grant statement without director intervention

---

## Phase 9 — Ongoing (post-handover)

| Done | Task | Cadence |
|:---:|---|---|
| [ ] | Renew foundation grants (Y2 €45k, Y3 €80k targets) | annual |
| [ ] | Review €40 membership vs costs (storage, fiber) | annual AGM |
| [ ] | Engagement-unit formula review (membership debate) | annual AGM |
| [ ] | Security updates on Swarm nodes | monthly |
| [ ] | AGPL `/source` tarball matches deployed commit | each release |
| [ ] | PRH annual filing + tax return | annual |
| [ ] | Member count vs plan (200 → 1,200 → 4,000) | quarterly |

---

## Suggested timeline (single team, realistic)

```text
Month  1–2   Phase 0 legal + Phase 1 grant applications + M0–M1
Month  3–4   Phase 2 infra + M2–M3 + internal dogfood
Month  5–6   M4–M5 + M20 partial + 10-artist closed beta
Month  7–9   M7–M9, M19, M8 + 50-artist beta
Month 10–12  M12, M18, M14 + push to 200 paying + first AGM
Month 13–18  Remaining features + operator training + handover package
```

Adjust if grants land late: **do not launch public beta without G2 funding**
unless maintenance team works unpaid until surplus and capex is deferred.

---

## Quick reference — doc map

| Question | Read |
|---|---|
| What to build? | `AGENT.md` (M0–M20) |
| How much money? | `financial-model.md` |
| Which grants? | `funding-strategy.md` |
| Who owns the org? | `governance-and-legal.md`, `strategy-and-product.md` |
| How do grants to artists work? | `engagement-and-fansubs.md` |
| How to broadcast? | `obs-and-broadcasting-guides.md` |
| Infra choices? | `infra-strategy.md` |

---

## Issue labels (for GitHub Projects)

- `legal` · `grant` · `infra` · `milestone/M*` · `test` · `beta` · `handover` · `ops`

Create one issue per milestone sub-task or per checkbox row as you begin execution.
