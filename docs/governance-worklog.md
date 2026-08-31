# Governance implementation worklog

This is the implementation checklist for making Tahti’s governance useful to a
real association. Product behavior must remain advisory until the adopted
bylaws and legal review authorize a binding electronic voting procedure.

## Delivered

- [x] Members can submit advisory motion drafts for board review.
- [x] Members can discuss motions before closure.
- [x] Closed advisory motion results are exposed through public transparency history.
- [x] Governance navigation links member motions, product feedback, and published results.
- [x] Persisted meeting/document schema and admin/member API foundation added.
- [x] Admin AGM page has a governance-records panel for meeting/document metadata.
- [x] Focused governance journey tests cover voting, discussion, feature requests, reports, and record visibility.

## Member journey

- [ ] View association identity, current bylaws, policies, board, auditor, and contacts.
- [x] Submit a motion draft.
- [x] Read and post discussion comments.
- [x] Vote once on an open advisory motion.
- [ ] Change/retract a vote according to approved voting rules.
- [x] Submit, vote on, and discuss product feature requests.
- [ ] Receive motion, meeting, and result notifications.
- [ ] View complete historical decisions and meeting records.
- [ ] Request correction of member-register data or governance records.

## Board and association operations

- [x] Review advisory motions and close voting.
- [ ] Review, second, schedule, and circulate member motions.
- [ ] Record agenda items, attendance, quorum, chair, and secretary.
- [ ] Publish notices and retain delivery evidence.
- [ ] Capture official meeting votes and decisions.
- [ ] Upload, approve, redact, sign, and publish minutes.
- [ ] Maintain versioned bylaws and association documents.
- [ ] Link decisions to meetings, agenda items, motions, and minutes.
- [ ] Maintain board roles, terms, elections, conflicts, and recusals.
- [x] Generate yearly transparency reports.
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
