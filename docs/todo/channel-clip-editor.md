# Channel clip editor

**Status:** open

Product design prepared 2026-10-27. Implementation has not started.

## Placement and purpose

Put **Clips between programs** inside Studio → Channel → Radio → **24/7**, below the rotation. Keep the rotation, its settings, and clip library on the same surface. Redirect existing Announcements tab links to this section rather than breaking bookmarks. Keep page-background music assignment available, but visually separate from broadcast placement.

Use “program” consistently with the existing rotation's playback unit; clarify that recurring insertion counts complete rotation items, not individual tracks inside a mix. Specific scheduled-show boundaries need separate scheduler support and must not be presented as supported by the fallback rotation.

## Main surface

- Header: **Clips between programs**, **Record voice**, **Upload audio**.
- Master switch: **Play clips between programs**. Save it immediately with visible pending/error state; avoid a second unsaved switch elsewhere in the rotation settings.
- Compact library rows: title, duration, Preview, placement summary, Draft / Processing / Active / Paused / Error status, Edit, and Delete.
- Empty state: “Give your channel a voice. Record a station ID or upload an announcement.”
- New clips start as drafts. Uploading or recording must never put unreviewed audio on air.
- “Active” means a ready clip with enabled placement and the channel master switch on. When the master is off, show “Paused — channel clips are off,” not a misleading active indicator.

## Editor

Use one roomy dialog or side panel, with three numbered sections visible together on desktop and stacked on mobile. Do not send the user to the full multitrack editor.

### 1. Audio

Record voice or upload a file. Display editable title, duration, source format, and waveform with draggable trim handles plus keyboard-accessible start/end fields. Provide play/pause, seek, selected-region loop, and short fade-in/out controls. Keep the original available for resetting edits.

Recording: microphone selector, input meter, explicit Start, elapsed time, Stop, playback, Record again, and **Use recording**. Handle permission denial, missing/disconnected microphones, silence, and unsupported recording without losing an existing draft. Stop microphone tracks on stop, cancel, navigation, and unmount. Do not monitor the microphone through speakers by default. Warn before discarding a take or unsaved edits.

Capture PCM through AudioWorklet and encode WAV for lossless voice takes. If a lossy browser recording fallback is offered, label its actual format; converting Opus to WAV does not restore quality. Define recording duration/file-size limits from the server contract and show remaining recording time.

### 2. Voice sound

Start with **Original**, **Natural voice**, **Warm voice**, and **Radio voice** presets. Natural voice is the suggested starting point, but applying a preset is explicit. Each preset expands to editable effect toggles with restrained defaults:

- Remove rumble: high-pass filter.
- Even out voice: compressor with gentle/medium/strong amount.
- Soften “s” sounds: de-esser with strength.
- Tone: warmth and clarity controls.
- Reduce background noise: optional conservative noise reduction, off by default.
- Reverb: optional subtle room, off by default.

**Match channel volume** applies loudness normalization using the channel's playback target, with a true-peak ceiling. Do not use peak-only normalization or make up a second broadcast loudness target. Provide measured before/after loudness and overload feedback in advanced details, with sensible behavior for silence and very short clips.

Preview switch: **Original / Processed** at the same playback position. Offer loudness-matched comparison so louder is not mistaken for better; separately allow listening at the final broadcast level. Preview must include trim, fades, and selected processing. The final saved preview must use the actual server render; any fast local preview is explicitly provisional.

### 3. When it plays

Default: **Between programs**, with **Every program** or **Every N programs** and a plain-language example. Use a deterministic sequence when multiple clips match a gap; do not unexpectedly play the entire library at every boundary.

Additional placement: **Before / After [program]**, using stable rotation-item identities and accessible dropdowns; dragging a clip into a visible gap can be an optional shortcut. Show “Program A → Station ID → Program B” in the rotation. Report removed or unavailable program targets instead of silently moving the clip.

Actions: **Save draft** and **Save & activate**. During rendering, show progress/status and prevent activation until a valid render exists. Editing an active clip keeps its previous ready version on air until the replacement is ready. Render failure retains the draft and existing playable version, with Retry. Activation takes effect at the next eligible boundary and never interrupts a playing program. Explain this timing in the success message.

## Delete and pause

Pause is a reversible one-click action that retains audio and placement. Delete asks once, names the clip, and lists affected placements (including page music if assigned). Remove all references atomically. Preserve the dialog and show an error when deletion fails. Prefer recoverable deletion with Undo and delayed blob cleanup; do not claim Undo if the backend permanently deletes immediately.

## Audio preservation

- Retain uploaded originals byte-for-byte, including WAV, FLAC, and AIFF.
- Store editing parameters separately; every render starts from the original, never an earlier processed copy.
- Render processed masters as lossless FLAC or PCM WAV, retaining source sample rate and appropriate precision. Processing changes samples; “lossless” describes storage encoding, not a bit-identical edited result.
- Keep compressed broadcast/preview derivatives separate from masters. Do not promise a lossless live stream.
- Show original and processed formats; offer original/master download. A lossy original remains identified as lossy even when its processed master uses FLAC.

## Verified existing implementation

- `packages/tahti-web/src/components/ChannelAnnouncementsPanel.tsx`: upload, preview, enable, trim, delete, page-background assignment.
- `packages/tahti-web/src/components/ChannelRadioPlaylistPanel.tsx`: channel-wide announcement switch, currently saved with rotation settings.
- `packages/tahti-web/src/views/studio/StudioChannelView.tsx`: separate 24/7 and Announcements tabs today.
- `../tahti-org/apps/api/src/routes/me/announcements.ts`: original preserved during upload; editor source returns current and original URLs. Owner PATCH supports title and enabled only. Scheduling fields are explicitly ignored for owner clips.
- `../tahti-org/apps/worker/src/jobs/render-announcement-trim.ts`: trim/fade only; hard-coded 192 kbps MP3 output. It needs changing before claiming edited lossless preservation.
- `../tahti-org/apps/worker/src/lib/sound-fallback-cache.ts`: integrates enabled owner announcements into fallback playback. Precise placement needs work here and in shared scheduling logic.

## Implementation sequence

1. Extend sibling contracts and storage for inactive drafts, versioned editing settings, vocal processing, lossless masters, render status, and owner placement. Confirm rotation versus scheduled-program scope and insertion arbitration. This repo's instructions require an explicit ask before modifying `../tahti-org`.
2. Add Storybook editor/library states using catalog components: empty, recording, microphone denied, editing, processing, active, master paused, failed render, missing placement, and failed delete.
3. Build the audio recorder, accessible waveform editing, effect controls, and server-render preview. Integrate into 24/7 and retain legacy links.
4. Verify upload bytes/format retention, WAV recording validity, DSP/normalization output, render version races, activation boundaries, deterministic placement, deletion references, and failed requests. Browser-check microphone cleanup, responsive layout, keyboard use, and persistent Studio navigation.
5. Update view catalog, source-of-truth docs, version/worklog, and close this todo only after implementation checks pass. Do not deploy or commit without a request.
