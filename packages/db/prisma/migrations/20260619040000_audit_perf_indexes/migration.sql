-- PERF-002: dashboard / admin live-channel queries and download history pagination
CREATE INDEX IF NOT EXISTS "Channel_state_idx" ON "channel"."Channel"("state");
CREATE INDEX IF NOT EXISTS "Download_channelId_createdAt_idx" ON "engagement"."Download"("channelId", "createdAt" DESC);
