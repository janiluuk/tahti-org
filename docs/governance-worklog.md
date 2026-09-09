# Governance implementation checklist

Open items only. Shipped advisory motions, discussion, transparency history,
meeting/attendance records, meeting officer/minutes sign-off metadata, and
related tests — see `docs/todo/HISTORY.md` (2026-09-05 governance). Product
behavior stays advisory until adopted bylaws and legal review authorize
binding electronic voting.

## Member journey

- [ ] View association identity, current bylaws, policies, board, auditor, and contacts.
- [x] Change/retract a vote according to approved voting rules: `POST .../motions/:id/vote` now updates an existing OPEN vote instead of rejecting it, and `DELETE .../motions/:id/vote` retracts it. Fixes the documented gap where motion-card.tsx offered this and the API rejected it with 409.
- [ ] Receive motion, meeting, and result notifications.
- [ ] View complete historical decisions and meeting records.
- [ ] Request correction of member-register data or governance records.

## Board and association operations

- [ ] Review, second, schedule, and circulate member motions.
- [x] Publish notices and retain delivery evidence: notice publication is audited (`MEETING_NOTICE_PUBLISH`), and on first publish a `GovernanceNoticeDelivery` row records send evidence per recipient, with bounce evidence filled in later by the email-bounce webhook. No open-tracking (no tracking-pixel infra exists in this codebase). Landed in #484, frontend wired in #487.
- [x] Capture official meeting votes and decisions: `BoardResolution` audited under its own "Official meeting votes" topic (`RESOLUTION_CREATE`/`RESOLUTION_UPDATE`), optionally linked to a `GovernanceMeeting` via `meetingId`, and flagged `binding` (default `true`, distinguishing it from advisory `Motion`) vs. non-binding at the schema level. Landed in #484, frontend wired in #487.
- [x] Upload, approve, redact, sign, and publish minutes: upload/approve/sign, redact (a flag on the stored file, not partial-document redaction), and publish (distinct from internal sign-off) are all individually audited (`MINUTES_UPLOAD`/`MINUTES_APPROVE`/`MINUTES_SIGN`/`MINUTES_REDACT`/`MINUTES_PUBLISH`). Landed in #484, frontend wired in #487.
- [ ] Maintain versioned bylaws and association documents.
- [ ] Link decisions to meetings, agenda items, motions, and minutes.
- [ ] Maintain board roles, terms, elections, conflicts, and recusals.
- [ ] Approve, publish, correct, and archive yearly reports with filing status.

## Technical integrity

- [~] Snapshot voting eligibility and quorum denominators: `Motion.eligibleMemberCount` now freezes the `isMember` count when a motion opens (mirrors `GovernanceMeeting`'s pattern), so turnout % on a closed motion no longer drifts as membership changes. No "quorum" concept applies here — advisory motions have no quorum rule; only meeting-linked (official) decisions do, and `GovernanceMeeting.quorumRequired` already covers that.
- [x] Separate advisory polls from binding ballots: already true by construction (`Motion.advisory`, `BoardResolution` as a wholly separate model/route/topic) — no code change needed this pass, just confirmed and closed out.
- [ ] Provide immutable result certificates and correction history.
- [x] Motion lists support bounded cursor continuation through `x-next-cursor`; the member directory (`/dashboard/governance/motions`) now paginates client-side via `MemberDirectoryTable`'s "Show more" — the full list is already fetched server-side for the turnout-% stat on the same page, so a second network-paginated round trip would be redundant. No remaining archive consumers identified.
- [ ] Add backups, retention, legal hold, and restore verification for official records.

## Plugin registry boundary

Start separating the registry as an independently owned boundary, but do not
break or migrate the current registry yet. First inventory callers and the
persisted format, define a compatibility interface, and add contract tests for
install, enable/disable, warnings, updates, and removal. Keep the existing
registry as runtime source of truth until adapter, rollback, and ownership
decisions are accepted.
