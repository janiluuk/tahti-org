# Tahti ry — pro audio editor (artist baseline)

Every **artist account** gets a full **browser-based pro audio editor** — not a
paid add-on, not a stripped-down teaser. It is a core reason to use Tahti instead
of juggling Audacity, a DAW subscription, and a separate host.

Spec for implementation: **M20** in `docs/AGENT.md`.

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

## Technical notes (for agents)

- **Frontend:** `apps/web` route `/dashboard/editor/[projectId]` — canvas timeline + Web Audio graph
- **Project format:** JSON document in Postgres (`editor.projects`) + blob refs to `sourceKey`s
- **Heavy DSP:** offline bounce via BullMQ worker (`bounce-editor-project`) using FFmpeg filters mirroring preview chain where possible
- **Storage:** project autosaves small; bounced masters follow normal archive/release storage policy
- **Cost:** CPU on owned hardware; no per-minute SaaS editor API. Budget ~€0 marginal at scale beyond existing transcode workers.

## Acceptance criteria

**Done when:** I open a live-archive WAV in the editor, trim the start, apply EQ + limiter, bounce to FLAC, publish as a release track, and the channel plays the bounced file from archive fallback without leaving Tahti.
