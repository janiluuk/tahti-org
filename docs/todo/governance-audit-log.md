# Governance audit log

Board audit viewer for association and business events, using the shared
`LogViewer` from `@tahti/ui` (this repo has no Storybook; the UI kit is the
shared component home).

## Topics on `/admin/governance/audit`

| Topic                        | What it covers                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| Finance & grants             | Ledger, grant rounds, engagement adjustments, Stripe webhook failures, download fraud |
| Fan subscriptions            | Paid fan-sub starts                                                                   |
| Membership & register        | Suspend/reinstate, renewal/lapse, account deletion, membership-tier changes           |
| Motions, votes & resolutions | Advisory motions, redacted votes, board resolutions, quarterly feature reports        |
| Board & roles                | Board-role changes and account suspensions                                            |
| Meetings & documents         | Meeting create/update, attendance, document archive, yearly report generation         |
| Radio bookings               | Scheduled radio slot bookings                                                         |

Ops noise (chat, stream keys, likes, logins) stays on `/admin/logs`, which
uses the same `LogViewer` (compact mobile rows, copy, pause-on-scroll) plus a
Filter sheet and an 80-line mobile window.

Planned (no events yet): notices & delivery evidence; minutes upload/redact/sign/publish steps; conflicts/recusals; official meeting votes distinct from advisory polls.

## Also in this slice

- Cursor + `state` filter on `GET /api/v1/governance/motions` (`x-next-cursor`).
- Vote choice and voter identity redacted from board audit APIs.

Binding electronic voting stays out of scope.
