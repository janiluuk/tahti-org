# Documentation quality audit — 2026-10-03

Cross-check of public docs against [`features.md`](./features.md), [`remaining-work.md`](./remaining-work.md), [`engagement-and-fansubs.md`](./engagement-and-fansubs.md), and the dual-client reality (`apps/web` production vs [tahti-player](https://github.com/janiluuk/tahti-player) on beta).

## Critical accuracy gaps (fixed or flagged)

| Severity | Claim | Reality | Action |
| --- | --- | --- | --- |
| **High** | `about.md`: grants use “plays, downloads, and direct fan support” | v6 formula is **downloads + fan-sub euros only** (explicitly not plays / listener-hours) | Fixed in `about.md` |
| **High** | README / guides: “registered” yhdistys as fact | `remaining-work.md` Phase 0 still lists PRH registration & founding checklist as open | README/guides now say **association model**; point to remaining-work for incorporation status |
| **High** | README: members stream **FLAC to all listeners** | STREAM-011 B: tier-aware **MP3/AAC ABR shipped**; true lossless fMP4 HLS still deferred | Softened to “member quality tier + downloads”; link remaining-work |
| **Medium** | Guides only teach `/dashboard/*` | Beta client uses `/studio/*` on `beta.tahti.live`; production stays `/dashboard` until cutover | Guides README + artist/streamer/viewer notes updated for dual UI |
| **Medium** | Competitive gap docs (hearthis) still show open checklists | Header says “resolved” / historical | Left as historical; README points to `features.md` + `remaining-work.md` as live sources |
| **Low** | `about.md` Year-4 board seat rule | Fine if bylaws-aligned; not verified against PRH filings | Left; legal docs own the detail |

## Screenshot quality

- `docs/e2e-screenshots/` — **160** PNGs; all README-linked paths resolve.
- Mobile set `docs/e2e-screenshots-mobile/` — **51** PNGs present but **not linked** from root README/guides.
- Gap: README does not show a mobile listen/studio capture; guides do not mention phone UX limits.

## Guide gaps

| Guide | Gap |
| --- | --- |
| `for-viewers.md` | No link to beta player UX; no “no native app” note |
| `for-artists.md` | Dashboard-only paths; no Distribution / Revelator honesty (prod credentials partial) |
| `for-streamers.md` | Same `/dashboard/broadcast` only |
| `for-members.md` | Very thin vs governance-explained |
| `plugins-and-addons.md` | Easy to confuse Nuclear player plugins vs channel `@tahti/addon-sdk` widgets |

## Source-of-truth map (use these)

| Question | Read |
| --- | --- |
| What ships today? | [`features.md`](./features.md) |
| What’s still open? | [`remaining-work.md`](./remaining-work.md) |
| Grant math | [`engagement-and-fansubs.md`](./engagement-and-fansubs.md) |
| Dual web clients / cutover | README “Web clients” + `ops/nuclear-web-cutover.md` |
| Listener/artist how-to | [`guides/`](./guides/README.md) |

## Rewrite done in this pass

- Root `README.md` — current-state banner, dual clients, softened legal/audio claims, clearer doc map
- `docs/about.md` — grant formula corrected
- `docs/guides/README.md` + artist/streamer/viewer intros — dual UI paths + honesty notes
