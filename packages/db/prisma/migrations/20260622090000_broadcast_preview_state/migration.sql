-- Broadcasting Setup UX: private PREVIEW state between OFFLINE and LIVE.
-- Ingest connect now lands here first; an explicit "go live" action promotes to LIVE.
ALTER TYPE "channel"."ChannelState" ADD VALUE 'PREVIEW';

-- Tracks whether a broadcast session was ever promoted to public LIVE, so a
-- preview-only test session (never promoted) is not finalized into an archive item.
ALTER TABLE "channel"."Broadcast" ADD COLUMN "wentLiveAt" TIMESTAMP(3);
