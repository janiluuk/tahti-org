-- Broadcasting Setup step 3 (pre-flight): show name, public/fan-only visibility,
-- and auto-archive are set per broadcast session instead of defaulting silently.
CREATE TYPE "channel"."BroadcastVisibility" AS ENUM ('PUBLIC', 'FAN_ONLY');

ALTER TABLE "channel"."Broadcast" ADD COLUMN "title" TEXT;
ALTER TABLE "channel"."Broadcast" ADD COLUMN "visibility" "channel"."BroadcastVisibility" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "channel"."Broadcast" ADD COLUMN "autoArchive" BOOLEAN NOT NULL DEFAULT true;
