-- A correction request about a governance record can name the record.
CREATE TYPE "governance"."GovernanceCorrectionRecordKind" AS ENUM ('MEETING', 'DOCUMENT', 'RESOLUTION', 'MOTION', 'ANNUAL_REPORT');

ALTER TABLE "governance"."GovernanceCorrectionRequest" ADD COLUMN "recordKind" "governance"."GovernanceCorrectionRecordKind",
ADD COLUMN "recordId" TEXT;
