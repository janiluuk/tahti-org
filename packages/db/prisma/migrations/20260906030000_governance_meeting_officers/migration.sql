-- Chair/secretary of record plus a minutes signature snapshot on the meeting.
ALTER TABLE "governance"."GovernanceMeeting"
  ADD COLUMN "chairName" TEXT,
  ADD COLUMN "secretaryName" TEXT,
  ADD COLUMN "minutesSignedByName" TEXT,
  ADD COLUMN "minutesSignedAt" TIMESTAMP(3);
