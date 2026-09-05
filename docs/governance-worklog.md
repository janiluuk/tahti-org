# Governance implementation checklist

Open items only. Shipped advisory motions, discussion, transparency history,
meeting/attendance records, and related tests — see `docs/todo/HISTORY.md`
(2026-09-05 governance). Product behavior stays advisory until adopted bylaws
and legal review authorize binding electronic voting.

## Member journey

- [ ] View association identity, current bylaws, policies, board, auditor, and contacts.
- [ ] Change/retract a vote according to approved voting rules.
- [ ] Receive motion, meeting, and result notifications.
- [ ] View complete historical decisions and meeting records.
- [ ] Request correction of member-register data or governance records.

## Board and association operations

- [ ] Review, second, schedule, and circulate member motions.
- [ ] Record chair/secretary role fields on meetings (attendance/quorum already persist).
- [ ] Publish notices and retain delivery evidence.
- [ ] Capture official meeting votes and decisions.
- [ ] Upload, approve, redact, sign, and publish minutes.
- [ ] Maintain versioned bylaws and association documents.
- [ ] Link decisions to meetings, agenda items, motions, and minutes.
- [ ] Maintain board roles, terms, elections, conflicts, and recusals.
- [ ] Approve, publish, correct, and archive yearly reports with filing status.

## Technical integrity

- [ ] Snapshot voting eligibility and quorum denominators.
- [ ] Separate advisory polls from binding ballots.
- [ ] Protect secret ballots from operational audit-log disclosure.
- [ ] Provide immutable result certificates and correction history.
- [ ] Add pagination and remove governance list N+1 comment loading.
- [ ] Add backups, retention, legal hold, and restore verification for official records.

## Plugin registry boundary

Start separating the registry as an independently owned boundary, but do not
break or migrate the current registry yet. First inventory callers and the
persisted format, define a compatibility interface, and add contract tests for
install, enable/disable, warnings, updates, and removal. Keep the existing
registry as runtime source of truth until adapter, rollback, and ownership
decisions are accepted.
