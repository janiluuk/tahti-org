# Todo history

Expired/completed docs from `docs/todo/` land here, appended in date order, oldest first. Each
entry keeps the original filename and content as a dated section — see `CLAUDE.md` for the rule.

## 2026-09-04 — export-provider-contracts.md

Branch: `feat/export-provider-contracts` (checkout: `tahti-export-api`).

### Goal

Expose versioned ExportProvider submit/status/webhook contracts so Nuclear can
move past metadata/deep-link export targets.

### Plan

1. Shared Zod DTO + list registry (Revelator real paths).
2. `GET /api/me/export-plugins` + thin submit/status aliases + webhook stub.
3. Credential lifecycle doc pointing at `/api/me/integrations`.
4. Tests + commit.

### Status

Shipped — see worklog `docs/worklogs/2026-09-04-export-plugin-contracts.md`.

## 2026-09-04 — listenbrainz-scrobble.md

Branch: `feat/listenbrainz-scrobble`.

### Goal

Submit-listens scrobbling via existing integrations credential store (not charts).

### Plan

1. Registry: `SCROBBLE` scope + `listenbrainz` provider; DTO + dashboard section.
2. `apps/api/src/lib/listenbrainz.ts` — validate-token + submit-listens.
3. Installer validates token before storing `{ userToken }`.
4. Fire-and-forget scrobble after successful listen-event create for session users.
5. Docs + unit/route tests; commit on branch.

### Status

Shipped — see worklog `docs/worklogs/2026-09-04-listenbrainz-scrobble.md`.
