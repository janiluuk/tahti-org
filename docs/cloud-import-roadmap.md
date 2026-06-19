# Cloud drive import — roadmap

Sprint 9 already ships OAuth import from Bandcamp and SoundCloud
(`docs/technical/phase-9.md` / roadmap memory). This doc plans the next
import source: letting an artist pull tracks directly from their own cloud
storage instead of a drag-and-drop upload from disk.

## Phase 1 — Google Drive (minimum viable)

Google Drive is the only generic cloud-storage provider with a mature,
well-documented OAuth + file-picker API that doesn't require a paid
developer tier. Concretely:

1. **Auth**: Google OAuth 2.0, `drive.file` scope only (not full `drive` —
   `drive.file` limits access to files the user explicitly picks/creates via
   our app, which is the correct least-privilege scope and avoids a Google
   verification/security-assessment review that broader scopes trigger).
2. **Picker**: Google Picker API (client-side JS) lets the artist browse
   their own Drive and select audio files without our backend ever listing
   their whole drive.
3. **Transfer**: backend exchanges the picker's OAuth token for the
   selected `fileId`s, streams each file server-side via
   `drive.files.get(fileId, {alt: 'media'})` straight into the existing tus
   upload/ingest pipeline (same path as a disk upload — reuse
   `music-metadata` first-1MB parsing, same archive-item creation code).
4. **Config shape**: mirror `bandcamp`/`soundcloud` blocks already in
   `apps/api/src/config.ts` — `GOOGLE_DRIVE_CLIENT_ID` /
   `GOOGLE_DRIVE_CLIENT_SECRET`, optional (omitted = feature hidden, same
   convention as the other import sources).
5. **New surface**: an "Import from Google Drive" tile next to the existing
   Bandcamp/SoundCloud import tiles on `/dashboard/upload`.

## Phase 2 — other providers, only if there's a generic abstraction

Dropbox and Microsoft OneDrive both have comparable picker + scoped-token
APIs and could follow the same shape as Phase 1. iCloud Drive has no public
file API for third-party apps and is not feasible.

Rather than hand-writing a fourth near-identical OAuth+picker integration,
once a second provider is requested, extract a small `CloudImportProvider`
interface (`getPickerConfig()`, `fetchFile(token, fileId)`) that Google
Drive Phase 1 already satisfies, and implement Dropbox/OneDrive against
that interface. Do not build this abstraction speculatively before a second
provider is actually needed — Bandcamp/SoundCloud already prove that two
near-identical integrations are tolerable without a shared interface.

## Out of scope for now

- Full Drive sync / "watch a folder" — one-shot picker import only.
- Non-audio file types — audio only, validated by the same `music-metadata`
  sniff already used for disk uploads.
