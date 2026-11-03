# Docs map

Short index for humans and agents. Deep rules live in linked files.

## Aim

Build and operate **Tahti ry**'s AGPL nonprofit broadcasting platform: always-on
artist channels, anonymous listening, transparent surplus → artists. The web
app is **[Tahti Player](https://github.com/janiluuk/tahti-player)**'s
`packages/tahti-web` SPA (every public host) on this repo's API; public docs at
`https://api.tahti.live/api`.

## Start here

| Doc | Why |
| --- | --- |
| [about.md](./about.md) | Public About page text: mission, money, governance, AGPL, what we do not do |
| [CONSTITUTION.md](./CONSTITUTION.md) | **Start here for rules.** The three rules. Constitutional. |
| [DECISIONS.md](./DECISIONS.md) | Every settled decision, one table per area |
| [product-overview.md](./product-overview.md) | The problem and what Tahti solves, area by area |
| [screenshots.md](./screenshots.md) | Current web client screens |
| [AGENT.md](./AGENT.md) | Full agent / engineering brief: repo, milestones, data model, anti-patterns |

## Foundation (org, money, strategy)

| Doc | Purpose |
| --- | --- |
| [business-evaluation.md](./business-evaluation.md) | Honest "is this worth doing" memo for founder, board, grant officers |
| [strategy-and-product.md](./strategy-and-product.md) | Positioning, competitive critique (SoundCloud/Mixcloud/Spotify/Bandcamp), retention thesis |
| [project-roadmap.md](./project-roadmap.md) | Phases, build audit, milestone status |
| [financial-model.md](./financial-model.md) | 3-year model, headline numbers, what must go right |
| [budget-detailed.md](./budget-detailed.md) | Line-item monthly budget + break-even sensitivity |
| [governance-and-legal.md](./governance-and-legal.md) | Yhdistys structure, bylaws (§1-12), AGPL implications, AGM mechanics |
| [funding-strategy.md](./funding-strategy.md) | Foundation grant pipeline (Tempo, Koneen, SKR, Creative Europe), donations, sponsorship |
| [transparency-policy.md](./transparency-policy.md) | Public ledger, annual report commitment, financial visibility |

## User guides (plain language)

| Doc | Purpose |
| --- | --- |
| [features.md](./features.md) | Current implemented feature catalog and operational dependencies |
| [guides/README.md](./guides/README.md) | Index: who should read which guide |
| [guides/for-viewers.md](./guides/for-viewers.md) | Listeners and fans: listen, chat, subscribe, smart links |
| [guides/for-members.md](./guides/for-members.md) | Co-op members: membership and governance |
| [guides/for-artists.md](./guides/for-artists.md) | Members: dashboard, profile, releases, fan tiers |
| [guides/for-streamers.md](./guides/for-streamers.md) | Going live: OBS, RTMP, limits, multistream |
| [guides/multistream-simulcast.md](./guides/multistream-simulcast.md) | Simulcast to Twitch, YouTube, Kick, etc. |
| [guides/governance-explained.md](./guides/governance-explained.md) | Motions, AGM and board meetings, annotated |
| [guides/plugins-and-addons.md](./guides/plugins-and-addons.md) | Plugins, widgets, visual tools, integrations |

## Engineering

| Doc | Purpose |
| --- | --- |
| [`../AGENTS.md`](../AGENTS.md) | Agent session entry |
| [testing.md](./testing.md) | Local setup, test commands, e2e, coverage |
| [api/README.md](./api/README.md) | Topic-organized API map |
| [planning-decisions.md](./planning-decisions.md) | Open questions with options (settled ones are in DECISIONS.md) |
| [remaining-work.md](./remaining-work.md) | Collective incomplete checklist (legal, ops, engineering) |
| [future-improvements.md](./future-improvements.md) | Deferred milestones + engineering efficiency backlog |
| [todo/INDEX.md](./todo/INDEX.md) | Open agent tasks |
| [design/README.md](./design/README.md) | Design ground truth map |
| [profile-and-promo-toolkit.md](./profile-and-promo-toolkit.md) | Profile, release model, embed/smartlink/social/newsletter/analytics specs |
| [engagement-and-fansubs.md](./engagement-and-fansubs.md) | Engagement-unit grant formula + fan-to-artist subscription spec |
| [tahti-radio-and-venues.md](./tahti-radio-and-venues.md) | Meta-stream architecture + venue calendar API |
| [infra-strategy.md](./infra-strategy.md) | Self-hosted Helsinki + UpCloud spillover, no CDN, GDPR posture |
| [storage-policy.md](./storage-policy.md) | Soft-target 500MB, no enforcement, hidden 50GB abuse safeguard |
| [obs-and-broadcasting-guides.md](./obs-and-broadcasting-guides.md) | Per-tool onboarding for OBS, Mixxx, Traktor, butt, browser ingest |
| [technical/](./technical/) | Streaming / infra / plugin specs |
| [flows/](./flows/) | Persona navigation flows |
| [`../ops/DEPLOY.md`](../ops/DEPLOY.md) | Deploy order, migrations, CI releases |
| [`../ops/RUNBOOK.md`](../ops/RUNBOOK.md) | Operations runbook |

## Infrastructure templates

| File | Purpose |
| --- | --- |
| `infra/docker-stack.yml` | Production Swarm stack |
| `infra/docker-compose.dev.yml` | Local development services |
| `infra/docker-compose.stack.yml` | Full local stack used by `make stack-up` |
| `infra/Caddyfile` | Edge TLS + reverse proxy |
| `infra/liquidsoap-channel.liq.template` | Per-channel broadcaster template |

## Presentations

| File | Purpose |
| --- | --- |
| [`../slides/Tahti-Community.pptx`](../slides/Tahti-Community.pptx) | Artist-facing deck: founding-cohort recruitment + scene press |
| [`../slides/Tahti-Business.pptx`](../slides/Tahti-Business.pptx) | Governance + sustainability deck: board candidates, grant officers, auditors |

## Removed on purpose

Dated HTML/PNG mockup packs, `_archive/` design drafts, and point-in-time UX audits
were deleted so agents stop treating them as current truth. Visual truth is
**live UI + `@tahti/ui`**; [`e2e-screenshots/`](./e2e-screenshots/) holds legacy
captures of the removed Next.js client. Finished todos and session worklogs
append to [`todo/HISTORY.md`](./todo/HISTORY.md) then the source file is deleted:
`docs/todo/` and `docs/worklogs/` hold **open work only**.
