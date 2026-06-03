# Tahti ry — pro audio editor (artist baseline)

Every **artist account** gets a full **browser-based pro audio editor** — not a
paid add-on, not a stripped-down teaser. It is a core reason to use Tahti instead
of juggling Audacity, a DAW subscription, and a separate host.

Spec for implementation: **M21** in `docs/AGENT.md` and `docs/project-roadmap.md` Phase 7.

## Design principle

- **Included for all artists** (free-tier and paying). Same editor, same feature set.
- **In-browser, no install.** Works on desktop and tablet; mobile view is listen-only / light trim (optional later).
- **Non-destructive.** Projects reference source blobs in MinIO; exports create new archive/release objects.
- **AGPL-friendly stack.** Prefer Web Audio API, AudioWorklet, and WASM builds of open DSP (no proprietary plugin host at launch).
- **Flows into the channel.** Export directly to archive, release track, or channel playlist — no re-upload friction.

## Feature set (baseline — all artists)

### Timeline & editing

- Multitrack session (audio tracks + optional reference track)
- Waveform and overview display; zoom, scroll, snap to zero-crossings
- Split, trim, slip, fade in/out, crossfade between regions
- Ripple edit mode, region markers, loop regions
- Unlimited undo/redo; autosave every 30s; recover crashed sessions
- DAW-style keyboard shortcuts (cut, copy, paste, split, nudge, zoom)

### Metering & loudness

- Per-track peak and RMS meters
- Master bus LUFS meter (integrated + short-term) with export loudness target presets (e.g. -14 LUFS stream, -9 LUFS club)

### Built-in processing (real-time preview + offline bounce)

Full **dynamics and loudness** tooling — not a toy trimmer:

- Parametric EQ (minimum 4 bands)
- **Compressor** with threshold, ratio, attack, release, makeup gain
- **Limiter** on master (ceiling, lookahead where supported)
- **Gate / expander** for noise floors and DJ pauses
- De-esser (voice/podcast)
- **Normalize**: peak normalize, RMS target, **LUFS** integrated normalize with
  post-bounce verification
- Gain staging per track and master bus
- High-pass / low-pass filters
- Stereo width (mid/side balance) on stereo masters
- **Trim** region in/out with sample-accurate handles; split and join regions

### DJ & broadcast workflows

- Beat grid / BPM detection on single files
- Mix-length projects (import multiple sources, crossfade segments)
- Chapter markers for podcast/talk exports
- Quick “trim silence” and “fade ending” macros for live-archive cleanup

### Import & export

| Source | Action |
|---|---|
| Live auto-archive | Open recording in editor |
| Archive library | Open any archive item |
| Release upload | Edit before publish |
| External file | Drag-drop WAV, FLAC, AIFF, MP3 (same rules as release upload) |

| Destination | Action |
|---|---|
| Archive | New or replace archive item |
| Release | New or replace track on draft release |
| Channel playlist | Append to fallback rotation |
| Download | Export WAV/FLAC/MP3 locally (artist’s machine) |

Exports run through the same FFmpeg worker pipeline as M12 (Opus/HLS derivatives generated after bounce).

## Explicitly out of scope at launch

- VST/AU/LV2 plugin hosting (legal + sandbox complexity; revisit post-launch)
- Collaborative multi-user sessions on one timeline
- Video timeline editing (audio-only; video stays in OBS)

## M21 implementation options

**Decision (2026-06):** adopt a **hybrid stack** — not a single monolithic editor fork.
The full feature set above remains the **north star**; delivery is **phased** so artists
get useful editing early without waiting for a complete DAW.

### Chosen base stack

| Layer | Library | Role | License |
|---|---|---|---|
| **Timeline UI** | [`@waveform-playlist/browser`](https://github.com/naomiaro/waveform-playlist) | Multitrack clips, trim/split/fade/crossfade, zoom, Tone.js FX preview, in-browser WAV export | MIT |
| **Offline DSP** | [`audio`](https://github.com/audiojs/audio) | Sample-accurate crop/trim, **LUFS normalize** (EBU R128-style), gain/fade/resample for bounce | MIT |
| **Derivatives** | Existing FFmpeg worker (`bounce-editor-project` → M12 pipeline) | Opus/HLS/FLAC/MP3 after master bounce; optional `loudnorm` verify on master | — |

**Why this over alternatives:** Only combination that covers **multitrack + modern FX +
LUFS + React in `apps/web` + AGPL-friendly deps** without maintaining a monolith UI fork.

**Route:** `/dashboard/editor/[projectId]` — open from archive item, release draft, or
live auto-archive; project JSON in Postgres + blob refs in MinIO (see Technical notes).

### Options considered (not chosen as primary)

| Option | Pros | Cons | When to use |
|---|---|---|---|
| **[AudioMass](https://github.com/pkalogiros/AudioMass)** | Full editor quickly; **AGPL-3.0** matches Tahti; client-side | iframe/fork; weak project/autosave/publish integration; below multitrack/LUFS bar | **v0 shortcut** only (see below) |
| **[wavesurfer.js](https://wavesurfer.xyz/)** + Regions | Small; great single-file waveform + trim | No multitrack, no effect rack — build every panel | **v0 trim** UI |
| **`audio` only + custom UI** | Maximum control | Build entire timeline yourself | Rejected — too much UI work |
| **WebAudacity-style forks** | Audacity-like UX | Maintenance risk, demo quality | Rejected |
| **Commercial SDKs / hosted SaaS** | Polished | Cost, privacy, vendor lock-in | Out of scope for Tahti |

**Avoid:** FFmpeg.wasm as the *interactive* editor (fine for export worker, not UX).

### Phased delivery plan

| Phase | Scope | Stack | Done when |
|---|---|---|---|
| **v0 — trim** | Single-file **crop/trim**, fade in/out, peak normalize; open live-archive; **Save to archive** (new item or M28 version) | **wavesurfer.js** Regions + **`audio`** crop/trim + worker transcode | Artist trims dead air off a broadcast recording and republishes without leaving Tahti |
| **v1 — multitrack** | Clips on timeline, split, crossfade, basic Tone.js FX (EQ, delay, reverb), export mixdown WAV | **`@waveform-playlist/browser`** + project autosave | Artist builds a two-segment mix with crossfade and bounces to archive |
| **v2 — loudness** | Master **LUFS meter**, integrated normalize presets (-14 stream / -9 club), **limiter** on master bus, offline verify via FFmpeg `loudnorm` | **`audio`** `.normalize()` + worker mirror + UI meters | Bounced FLAC meets chosen LUFS target; limiter prevents inter-sample overs on export |

**Optional v0 bridge:** self-hosted **[AudioMass](https://github.com/pkalogiros/AudioMass)** at
`/dashboard/editor/external` while v0/v1 ship — same AGPL, zero backend, “open in editor”
link from archive row. Replace with integrated editor before calling M21 complete.

**Out of scope until post-M21:** VST/AU hosting, collaborative sessions, video timeline
(unchanged from below).

### hearthis / Tahti field mapping

| Need | v0 | v1 | v2 |
|---|---|---|---|
| Crop / trim | wavesurfer + `audio` | waveform-playlist regions | — |
| Fade / crossfade | Fade macros | Native crossfade | — |
| Multitrack | — | **Native** | — |
| EQ / creative FX | — | Tone.js chain | — |
| LUFS normalize | Peak only | — | **`audio` + loudnorm verify** |
| Limiter on master | — | — | **Master bus + offline** |
| Replace file / versions | **M28** on top of any phase | M28 | M28 |
| Publish to release | Worker → M12 derivatives | Same | Same |

## Technical notes (for agents)

- **Frontend:** `apps/web` route `/dashboard/editor/[projectId]` — see **M21 implementation options** for phased stack (v0 wavesurfer → v1 waveform-playlist → v2 LUFS/limiter)
- **Dependencies (target):** `@waveform-playlist/browser`, `audio`, `wavesurfer.js` (v0 only), Tone.js (via waveform-playlist)
- **Project format:** JSON document in Postgres (`editor.projects`) + blob refs to `sourceKey`s
- **Heavy DSP:** offline bounce via BullMQ worker (`bounce-editor-project`) using FFmpeg filters mirroring preview chain where possible
- **Storage:** project autosaves small; bounced masters follow normal archive/release storage policy
- **Cost:** CPU on owned hardware; no per-minute SaaS editor API. Budget ~€0 marginal at scale beyond existing transcode workers.

## Acceptance criteria

**M21 complete (all phases)** when the full baseline in this doc is met.

**v0 exit:** open live-archive WAV → trim start/end → fade → save to archive → channel plays bounced file.

**v1 exit:** multitrack session → crossfade two regions → bounce WAV → publish as release track.

**v2 exit:** apply master limiter + LUFS preset → bounce → integrated loudness within ±0.5 LU of target.

**Full M21 done when:** I open a live-archive WAV in the editor, trim the start, apply EQ + limiter, bounce to FLAC, publish as a release track, and the channel plays the bounced file from archive fallback without leaving Tahti.
