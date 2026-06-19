# Tahti vs hearthis.at — obvious shortcomings & backlog

Reference: [hearthis.at](https://hearthis.at) (upload host + live streaming + per-track
presentation). Tahti is **channel-first** and nonprofit; hearthis is **track/set-first**
and commercial. This doc lists gaps artists will notice when comparing the two, and
what to build to close them.

**Status:** most items below are **not implemented** (docs-only package). The in-browser
editor is **specified** in `audio-editor.md` but not built.

---

## Where Tahti is already stronger (context)

| Area | Tahti | hearthis.at |
|---|---|---|
| Primary object | 24/7 channel (live → archive fallback) | Uploads + optional live; “Replay” radio is separate product |
| Economics | Surplus → engagement grants; fan-subs direct | Commercial host; no grant pool |
| Audio quality (membership) | FLAC to all listeners on member channels | Lossless tier advertised; quality tied to account tier |
| Governance | Member-owned yhdistys, public ledger | Standard commercial ToS |
| Live social | Per-channel live chat | No equivalent real-time chat layer in core product |
| Open source | AGPL, forkable | Closed platform |

These do not remove the gaps below — artists still expect hearthis-level **library UX**
even when they choose Tahti for broadcasting.

---

## 1. Rich metadata on every piece of content

### hearthis.at

- Per-upload **title, description, genre/tags, release date**
- **Automatic tracklisting** (ACRCloud) on mixes
- Stream **metadata** during live (Icecast-style)
- Stats tied to each track (plays, downloads, podcast subscribers)

### Tahti today

| Capability | Spec / build | Gap |
|---|---|---|
| Release title, type, date, description | M12 profile releases | Partial — **releases** only, not every archive/live item |
| Tracklist with timestamps | ACRCloud optional on archive (M4) | Not exposed as editable **user metadata**; no manual tracklist UI; **no @artist tags** yet |
| Track type (original, mix, live recording, podcast, etc.) | — | **Missing** enum + UI |
| Release date on archive items | — | **Missing** on auto-archived sets |
| Genre / mood tags | Explicitly out of scope on profile | **Missing** for browse and self-organization |
| ISRC / catalog numbers on tracks | Release model only | **Partial** — release tracks; **M30:** MusicBrainz MBIDs + export pack |

### Should build

- [ ] **Content metadata schema** on `archive_items` and live sessions: `title`, `description`, `contentType`, `releasedAt`, `genreTags[]`, `bpm`, `key` (optional)
- [ ] **Tracklist editor**: ordered `{startSec, title, artist, artistUsername?}` rows; **`@handle` autocomplete** to tag Tahti artists (profile links + M15 notifications); import from ACRCloud; export to profile + RSS
- [ ] **Bulk edit** from dashboard (same date/type on a selection)

---

## 2. Per-track visual identity (banner / cover / motion)

### hearthis.at

- **Cover** per track/set
- **Background** image per track
- **Image slideshow** on the track page
- Profile-level branding consistent across catalog

### Tahti today

| Capability | Spec / build | Gap |
|---|---|---|
| Profile hero image | M12 — 3000×1000 optional | **Profile only**, not per track/set |
| Release cover art | M12 | Releases only |
| Archive item cover | Channel-level default | **No per-mix cover** in archive list |
| Background banner on playback page | — | **Missing** |
| Slideshow while playing | — | **Missing** |
| YouTube (or Vimeo) as visual backdrop | Bio embed only (YouTube/Vimeo in markdown) | **Not on track/channel player** |

### Should build

- [ ] **`visualMode`** per content: `cover_only` | `static_banner` | `slideshow` | `youtube` | `vimeo`
- [ ] Asset uploads (images) or URL allowlist for video IDs
- [ ] Player chrome: audio from Tahti stream/archive; video layer muted (YouTube iframe or `<video>` for slideshow)
- [ ] Fallback when video blocked: static cover
- [ ] Respect performance: no autoplay sound from YouTube; lazy-load iframe on play

---

## 3. Commentary on tracks

### hearthis.at

- Community platform positioning (“music community”)
- Listener engagement around uploads (comments / feedback patterns familiar from SoundCloud-era hosts)

### Tahti today

| Capability | Spec / build | Gap |
|---|---|---|
| Track-level listener comments | **Explicitly excluded** in `profile-and-promo-toolkit.md` | **Missing** vs hearthis |
| Artist “liner notes” on a set | Release description ~300 chars | **Weak** for long-form mix notes |
| Chat | M5 — **live only**, ephemeral | No comment thread on archived sets |

### Product choice (resolve in bylaws/AGM if listener comments are added)

**Option A — Artist commentary only (fits current anti-feed stance)**  
Long-form markdown per archive item / release: tracklist + story + gear list + date.
No public listener threads.

**Option B — Listener comments per track (hearthis parity)**  
Moderation tools, spam/hCaptcha, artist pin/hide, no algorithmic ranking.
Conflicts with “no track-level comments” in current profile spec — **update spec if chosen**.

### Should build (minimum to close “obvious” gap)

- [ ] **Artist commentary** field (markdown, ≥2k chars) on every archive item and release
- [ ] Display on channel archive view + profile release page
- [ ] (Optional) **Listener comments** — if approved: `content_comments` table, artist moderation, AGPL-safe export

---

## 4. Grouping: albums, DJ mix collections, sets

### hearthis.at

- Uploads organized in **sets** and **profiles**
- **Genre/category** pages for discovery
- **Groups/labels** can link multiple artists on one page
- Podcast + **RSS** per profile and per set

### Tahti today

| Capability | Spec / build | Gap |
|---|---|---|
| Albums / EPs / singles | M12 `Release` types | **Releases ≠ archive** — live archives sit outside album structure |
| User-defined **collections** (“Trance sets”, “Techno 2024”) | — | **Missing** |
| Drag-and-drop ordering inside a collection | Release pin/reorder only | **Missing** for arbitrary groups |
| One mix in multiple collections | — | **Missing** |
| Archive playlist (channel fallback) | M2 rotation | **Operational**, not a public catalog view |
| Public RSS of artist catalog | — | **Missing** (hearthis podcast/RSS) |
| Genre landing pages | Out of scope | **Missing** (may stay out of scope; artist-local tags still needed) |

### Should build

- [ ] **`Collection`** model: `{slug, title, description, coverUrl, kind}` where `kind` = `album` | `mix_series` | `podcast` | `custom`
- [ ] **`CollectionItem`** join: ordered list of `archive_item_id` and/or `release_id`
- [ ] Dashboard: create “Techno sets”, drag mixes in, reorder
- [ ] Public URL: `tahti.live/u/<handle>/c/<collection-slug>` with same visual modes as §2
- [ ] **RSS/Atom** per collection + per artist (enclosures point to MP3/FLAC URLs per tier policy)
- [ ] Smart link block on profile: featured collections above full release timeline

Example artist-facing groups:

| Collection kind | Example title | Contents |
|---|---|---|
| `mix_series` | Trance sets | 12 archived live sets |
| `mix_series` | Techno 2024 | 8 mixes + 2 studio mixes |
| `album` | Album: North EP | Release object |
| `podcast` | Monthly show | Dated archive items |

---

## 5. In-browser audio editor (full tooling)

### hearthis.at

- **No** multitrack DAW in the browser — upload finished files, optional live stream
- Editing happens in external tools

### Tahti today

| Capability | `audio-editor.md` | Gap |
|---|---|---|
| Trim, split, fade, crossfade | Specified | **Not built** |
| Dynamics: compressor, limiter, gate, expander | Specified | **Not built** |
| EQ, filters, de-esser | Specified | **Not built** |
| Normalize, LUFS targets | Specified | **Not built** |
| Multitrack + offline bounce to archive/release | Specified | **Not built** |
| “Quick trim” only | — | hearthis is weaker here — **Tahti wins once shipped** |

### Should build (treat as **M21** — see `project-roadmap.md`)

Ship the full spec, not a minimal trimmer:

- [ ] Waveform editor: trim in/out, split regions, fade curves
- [ ] **Dynamics chain**: gain → EQ → compressor → limiter (with meters)
- [ ] **Normalize** (peak + LUFS integrated)
- [ ] Presets: “podcast voice”, “club master -9 LUFS”, “stream -14 LUFS”
- [ ] Non-destructive project save; bounce to FLAC/WAV → archive or release
- [ ] Open from: live archive, upload, existing release track

**Acceptance:** edit a 90-minute DJ mix: trim intro, normalize, limiter, bounce FLAC, publish to collection “Techno 2024” with tracklist + banner — without leaving Tahti.

---

## 6. Other hearthis gaps (secondary but visible)

| Feature | hearthis | Tahti | Priority |
|---|---|---|---|
| Per-track play/download stats on public page | Yes | Dashboard only | Medium |
| Waveform style on embed | Yes | No public waveform on channel player | Low (channel is continuous) |
| Weekly upload quota UI | 400 MB/wk free | Soft storage policy, no weekly cap UX | Low |
| oEmbed / embed per track | Yes | M14 embed for releases | Medium — extend to archive items |
| Group / label multi-artist page | Yes | Single artist per channel | Low (collectives = future) |
| Explore-by-genre on platform | Yes | Explicitly out of scope | Low — use artist collections instead |
| Mobile upload app | Implied | Browser upload | Low |

---

## Summary checklist (artist asks “why not just hearthis?”)

| # | Shortcoming | Fix |
|---|---|---|
| 1 | Can’t edit tracklist / type / date on mixes | Content metadata + tracklist UI + **@artist tags** |
| 2 | Can’t set banner / slideshow / YouTube on a set page | Per-content `visualMode` |
| 3 | No commentary on individual tracks/sets | Artist notes + optional listener comments |
| 4 | Can’t group mixes into “Trance sets”, albums, etc. | Collections + RSS |
| 5 | No real in-browser editor yet | Ship M21 per `audio-editor.md` |

---

## Suggested milestone mapping

| Milestone | Scope |
|---|---|
| **M22** | Content metadata + tracklist editor (archive + live); **@artist tagging** per tracklist row |
| **M23** | Collections (`mix_series`, albums, podcast feeds) |
| **M24** | Per-content visuals (cover, banner, slideshow, YouTube/Vimeo) |
| **M25** | Artist commentary (+ optional moderated listener comments) |
| **M21** | Full audio editor (parallel track — already specified) |

Add these to `docs/AGENT.md` when implementation starts. Update `profile-and-promo-toolkit.md` §“What NOT to build” if listener comments are approved.

---

## Spec files to update when building

| File | Change |
|---|---|
| `docs/profile-and-promo-toolkit.md` | Collections, per-item visuals, commentary policy |
| `docs/audio-editor.md` | M21 spec + **implementation options** (waveform-playlist + audio + phased v0–v2) |
| `docs/AGENT.md` | Prisma models, API routes, player UI |
| `docs/engagement-and-fansubs.md` | Whether downloads from collections count (yes, same rules) |
