-- Distinguishes an artist broadcast channel from a radio-station page (no
-- bio/links/subscribe CTA; shows programming instead). Only ever RADIO on
-- system-owned rows like tahti-radio today.
CREATE TYPE "channel"."ChannelKind" AS ENUM ('ARTIST', 'RADIO');

ALTER TABLE "channel"."Channel"
ADD COLUMN "channelKind" "channel"."ChannelKind" NOT NULL DEFAULT 'ARTIST';

UPDATE "channel"."Channel"
SET "channelKind" = 'RADIO'
WHERE "slug" = 'tahti-radio';
