# Governance implementation checklist

Open items only. Shipped advisory motions, discussion, transparency history,
meeting/attendance records, meeting officer/minutes sign-off metadata, and
related tests — see `docs/todo/HISTORY.md` (2026-09-05 governance). Product
behavior stays advisory until adopted bylaws and legal review authorize
binding electronic voting.

## Member journey

- [~] View association identity, current bylaws, policies, board, auditor, and contacts: `GET /api/v1/governance/documents` serves published bylaws/policy documents and `GET /api/v1/governance/members` exposes board membership (`isBoard`); no "auditor" or association-identity/contacts concept exists anywhere.
- [x] Change/retract a vote according to approved voting rules: `POST .../motions/:id/vote` now updates an existing OPEN vote instead of rejecting it, and `DELETE .../motions/:id/vote` retracts it. Fixes the documented gap where motion-card.tsx offered this and the API rejected it with 409.
- [~] Receive motion, meeting, and result notifications: meeting notices are emailed with per-recipient delivery evidence (see below); members are told in-app when a motion opens and when it closes with its result, and a proposer when their motion is seconded or commented on. No email for motions.
- [x] View complete historical decisions and meeting records: `GET /api/v1/governance/meetings` (non-DRAFT), `GET /api/v1/transparency/resolutions` (published), and `GET /api/v1/transparency/motions` (closed advisory motions) together cover this.
- [~] Request correction of member-register data or governance records: `POST`/`GET /api/v1/governance/corrections` (member files and follows a request), `GET`/`PATCH /api/admin/governance/corrections` (board queue and answer, audited, member notified). API only — no page in the web app yet, and accepting a request changes no data by itself.

## Board and association operations

- [~] Review, second, schedule, and circulate member motions: board can transition a motion DRAFT→OPEN→CLOSED and `openAt`/`closeAt` scheduling exists; members can second a draft (`POST`/`DELETE .../motions/:id/second`, seconders listed at `.../seconds`), and a proposer can edit or withdraw their own draft. No explicit circulation step beyond the plain list endpoint, and no web UI for seconding yet.
- [x] Publish notices and retain delivery evidence: notice publication is audited (`MEETING_NOTICE_PUBLISH`), and on first publish a `GovernanceNoticeDelivery` row records send evidence per recipient, with bounce evidence filled in later by the email-bounce webhook. No open-tracking (no tracking-pixel infra exists in this codebase). Landed in #484, frontend wired in #487.
- [x] Capture official meeting votes and decisions: `BoardResolution` audited under its own "Official meeting votes" topic (`RESOLUTION_CREATE`/`RESOLUTION_UPDATE`), optionally linked to a `GovernanceMeeting` via `meetingId`, and flagged `binding` (default `true`, distinguishing it from advisory `Motion`) vs. non-binding at the schema level. Landed in #484, frontend wired in #487.
- [x] Upload, approve, redact, sign, and publish minutes: upload/approve/sign, redact (a flag on the stored file, not partial-document redaction), and publish (distinct from internal sign-off) are all individually audited (`MINUTES_UPLOAD`/`MINUTES_APPROVE`/`MINUTES_SIGN`/`MINUTES_REDACT`/`MINUTES_PUBLISH`). Landed in #484, frontend wired in #487.
- [~] Maintain versioned bylaws and association documents: `GovernanceDocument.version` plus create/list endpoints exist, a new version can name the one it replaces (`supersedesId`, one successor per version), and the board can archive/restore a document (`PATCH /api/admin/governance/documents/:id`). Still no route to edit a document's own fields, and no web UI for either.
- [~] Link decisions to meetings, agenda items, motions, and minutes: `BoardResolution.meetingId` and `GovernanceDocument.meetingId` link resolutions/documents to a meeting, but `GovernanceMeeting.agenda` is an unstructured JSON blob (no linked agenda-item entities) and a motion can be linked to a meeting (`PUT .../motions/:id/meeting`) but not to an agenda item.
- [~] Maintain board roles, terms, elections, conflicts, and recusals: conflict-of-interest declarations (`GovernanceConflictDeclaration`, with a `recused` flag) are modeled, routed, audited (`CONFLICT_DECLARE`), and tested per #487, but have no frontend UI yet. Board roles, terms, and elections remain unmodeled beyond the free-text `chairName`/`secretaryName` on `GovernanceMeeting`.
- [ ] Approve, publish, correct, and archive yearly reports with filing status.

## Technical integrity

- [~] Snapshot voting eligibility and quorum denominators: `Motion.eligibleMemberCount` now freezes the `isMember` count when a motion opens (mirrors `GovernanceMeeting`'s pattern), so turnout % on a closed motion no longer drifts as membership changes. No "quorum" concept applies here — advisory motions have no quorum rule; only meeting-linked (official) decisions do, and `GovernanceMeeting.quorumRequired` already covers that.
- [x] Separate advisory polls from binding ballots: already true by construction (`Motion.advisory`, `BoardResolution` as a wholly separate model/route/topic) — no code change needed this pass, just confirmed and closed out.
- [~] Provide immutable result certificates and correction history: closing a motion stores its tally, closing time and a sha256 digest once (`GET .../motions/:id/certificate`, which also reports if the record no longer matches). Motions closed earlier have none. No correction history, and the list/detail/transparency tallies still count live vote rows.
- [x] Motion lists support bounded cursor continuation through `x-next-cursor`; the member directory (`/dashboard/governance/motions`) now paginates client-side via `MemberDirectoryTable`'s "Show more" — the full list is already fetched server-side for the turnout-% stat on the same page, so a second network-paginated round trip would be redundant. No remaining archive consumers identified.
- [~] Add backups, retention, legal hold, and restore verification for official records: whole-DB backup/retention/restore-verification infra exists (`scripts/backup.sh`, `LOCAL_RETENTION_DAYS`, weekly restore-test cron per `ops/BACKUP.md`, monitored by `apps/api/src/lib/backup-metrics.ts`), but it's generic (not record-specific) and there is no "legal hold" concept anywhere in the repo.

## Plugin registry boundary

Start separating the registry as an independently owned boundary, but do not
break or migrate the current registry yet. First inventory callers and the
persisted format, define a compatibility interface, and add contract tests for
install, enable/disable, warnings, updates, and removal. Keep the existing
registry as runtime source of truth until adapter, rollback, and ownership
decisions are accepted.
