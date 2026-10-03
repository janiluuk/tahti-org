# Documentation quality audit — 2026-10-03

Cross-check of public docs against [`features.md`](./features.md), [`remaining-work.md`](./remaining-work.md), [`engagement-and-fansubs.md`](./engagement-and-fansubs.md), and the dual-client reality (`apps/web` production vs [tahti-player](https://github.com/janiluuk/tahti-player) on beta).

Follow-up pass incorporated findings from the deep audit (screenshots, hosting tense, constitution/strategy drift, tier matrix, stack ports).

## Critical accuracy gaps (fixed or flagged)

| Severity | Claim | Reality | Action |
| --- | --- | --- | --- |
| **High** | `about.md`: grants use “plays, downloads, and direct fan support” | v6 formula is **downloads + fan-sub euros only** | Fixed in `about.md` |
| **High** | README / guides: “registered” yhdistys as fact | Phase 0 PRH registration still open | Softened to **association model** |
| **High** | CONSTITUTION / strategy: members stream **FLAC to all listeners** | STREAM-011 B: **MP3/AAC ABR** live; lossless fMP4 HLS deferred | CONSTITUTION + strategy softened; README honest limits |
| **High** | Strategy opening: “listener-hour grants” | Engagement units (downloads + fan-sub euros) | Fixed; transparency-policy aligned |
| **Medium** | “Runs on owned Helsinki hardware” as present fact | Phase 2 target topology | Hosting → **target** wording |
| **Medium** | Auto-archive unconditional | Recording / auto-publish are toggles | Softened |
| **Medium** | Guides only teach `/dashboard/*` | Beta uses `/studio/*` | Dual UI notes |
| **Medium** | README omitted STUDIO €120 tier | Code has FREE / ARTIST / STUDIO | Tier matrix in At a glance + guides |
| **Medium** | Stack ports documented as 3010/3011 | `stack-up.sh` defaults **17777 / 15011** | Fixed |
| **Medium** | `remaining-work` “Channel Designer block system” open | Blocks UI ships in `apps/web` | Row → polish / beta parity |
| **Low** | Headline numbers read as achieved | Financial model forecast | Section retitled |

## Screenshot quality

- Flat `public/listen.png`, `artist/stats.png`, and six other PNGs are **identical Loading stubs** (same MD5).
- README Discover now uses `anonymous/journey/dark/02-listen-hub.png`; Stats tile replaced with fan-subs settings (real capture).
- Channel caption no longer claims chat+live for the replay-oriented `channel.png`.
- Channel design caption drops “press kit” (lives under Settings → Artist info → Branding).
- Mobile set (~51 PNGs) is **artist/admin only** — noted in README.

## Guide gaps addressed this pass

| Guide | Fix |
| --- | --- |
| `for-viewers.md` | Dual beta URLs; honest channel caption (chat when live) |
| `for-artists.md` | Blocks row; FREE/ARTIST/STUDIO pointer |
| `for-streamers.md` | Beta `/channel/$slug`; STUDIO €120 always-mirror |
| `transparency-policy.md` | Listener-hours → engagement units |
| `about.md` | “Founded” → model + Phase 0 pointer |

## Source-of-truth map

| Question | Read |
| --- | --- |
| What ships today? | [`features.md`](./features.md) |
| What’s still open? | [`remaining-work.md`](./remaining-work.md) |
| Grant math | [`engagement-and-fansubs.md`](./engagement-and-fansubs.md) |
| Live audio quality | `/help/tier-limits` + STREAM-011 B |
| Dual web clients / cutover | README “Web clients” + `ops/nuclear-web-cutover.md` |
| Listener/artist how-to | [`guides/`](./guides/README.md) |

## Still deferred (not rewritten this pass)

- Full `project-roadmap.md` banner refresh (stale 2026-06-05 metrics / false FLAC HLS `[x]` rows)
- Regenerating stub PNGs in place (paths swapped; files still on disk for journey tooling)
- `for-members.md` depth vs `governance-explained.md`
