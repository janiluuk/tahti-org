-- Live session format: music/DJ set vs spoken talk show (solo or with guests).
CREATE TYPE "channel"."BroadcastShowType" AS ENUM ('LIVE_SET', 'TALK');

ALTER TABLE "channel"."Broadcast"
  ADD COLUMN "showType" "channel"."BroadcastShowType" NOT NULL DEFAULT 'LIVE_SET';

ALTER TABLE "channel"."RadioSlotBooking"
  ADD COLUMN "showType" "channel"."BroadcastShowType" NOT NULL DEFAULT 'LIVE_SET';
