# Governance meeting officers

Worklog item: record chair/secretary role fields on meetings (attendance/quorum
already persist). Also store a minutes signature snapshot on the same record.

## Plan

1. Additive `GovernanceMeeting` columns: `chairName`, `secretaryName`,
   `minutesSignedByName`, `minutesSignedAt`.
2. Create/patch DTOs + member/admin meeting payloads.
3. Admin AGM panel: set officers on create and update from the meeting detail.
4. Member governance hub: show chair/secretary on published meetings.

## Status

Implemented on `cursor/governance-meeting-officers-5cae`. Binding electronic
voting stays out of scope.
