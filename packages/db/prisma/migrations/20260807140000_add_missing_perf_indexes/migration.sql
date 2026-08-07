-- Performance audit: add missing indexes on hot query paths (admin + artist dashboards).
-- All additive, no data changes.

CREATE INDEX "ChatBan_channelId_bannedAt_idx" ON "chat"."ChatBan"("channelId", "bannedAt");

CREATE INDEX "AuditLog_createdAt_idx" ON "governance"."AuditLog"("createdAt");

CREATE INDEX "Download_countedAt_idx" ON "engagement"."Download"("countedAt");

CREATE INDEX "ListenEvent_playedAt_idx" ON "engagement"."ListenEvent"("playedAt");

CREATE INDEX "FanSubscription_state_idx" ON "fansubs"."FanSubscription"("state");

CREATE INDEX "FanSubPayout_artistUserId_state_paidAt_idx" ON "fansubs"."FanSubPayout"("artistUserId", "state", "paidAt");

CREATE INDEX "FanSubPayout_state_createdAt_idx" ON "fansubs"."FanSubPayout"("state", "createdAt");

CREATE INDEX "Venue_createdBy_idx" ON "venue"."Venue"("createdBy");
