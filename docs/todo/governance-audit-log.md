# Governance audit log

Board audit viewer for association and business events, using the shared
`LogViewer` from `@tahti/ui` (this repo has no Storybook; the UI kit is the
shared component home).

## Topics on `/admin/governance/audit`

| Topic                    | What it covers                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Finance & grants         | Ledger, grant rounds, engagement adjustments, Stripe webhook failures, download fraud |
| Fan subscriptions        | Paid fan-sub starts                                                                   |
| Membership & register    | Suspend/reinstate, renewal/lapse, account deletion, membership-tier changes           |
| Motions & advisory votes | Advisory motions, redacted votes, quarterly feature reports                           |
| Board & roles            | Board-role changes and account suspensions                                            |
| Meetings & documents     | Meeting create/update, attendance, document archive, yearly report generation         |
| Radio bookings           | Scheduled radio slot bookings                                                         |
| Notices & delivery       | Meeting notice publication (see caveat below)                                         |
| Minutes workflow         | Minutes upload, approval, and signature as distinct steps                             |
| Official meeting votes   | Board resolutions, distinct from advisory motions                                     |

Ops noise (chat, stream keys, likes, logins) stays on `/admin/logs`, which
uses the same `LogViewer` (compact mobile rows, copy, pause-on-scroll) plus a
Filter sheet and an 80-line mobile window.

**2026-09-08 slice:** wired up three of the four previously-planned topics.

- Notices & delivery: `MEETING_NOTICE_PUBLISH` fires when `noticeAt` is set on
  create or PATCH. This only proves _publication happened_, not per-recipient
  delivery (no send/bounce/open tracking exists) — the "delivery evidence"
  half of the worklog item is still open.
- Minutes workflow: `MINUTES_UPLOAD`/`MINUTES_APPROVE`/`MINUTES_SIGN` now fire
  from the same `PATCH /api/admin/governance/meetings/:id` handler, based on
  which minutes fields are present in the request body. Redaction and a
  distinct "publish" step still have no backing field — not implemented.
- Official meeting votes: `RESOLUTION_CREATE`/`RESOLUTION_UPDATE` moved from
  `decisions` to their own `official-votes` topic (no route change — the
  audit actions already existed). `BoardResolution` is still not linked to a
  `GovernanceMeeting` row and has no `binding` flag, so "distinct from
  advisory polls" holds only by virtue of being a separate model/table.

Still planned (no events, no data model yet): conflicts/recusals.

**Also 2026-09-08:** `VOTE_CHANGE`/`VOTE_RETRACT` audit actions added
alongside `VOTE_CAST` (same `decisions` topic, same ballot-secrecy redaction)
now that changing/retracting a vote while a motion is OPEN is a real,
previously-missing member-journey capability (see `governance-worklog.md`).

## Also in this slice

- Cursor + `state` filter on `GET /api/v1/governance/motions` (`x-next-cursor`).
- Vote choice and voter identity redacted from board audit APIs.

Binding electronic voting stays out of scope.
