-- Tahti Radio live-slot switch-over: lets one channel's Liquidsoap process
-- relay another channel's live input mount (used to switch Tahti Radio to a
-- booked artist's live source during their slot, falling back automatically
-- when unset since fallback() already handles an empty/unreachable input).

ALTER TABLE "channel"."Channel" ADD COLUMN "liveInputOverrideSlug" TEXT;
