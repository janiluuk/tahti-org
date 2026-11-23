-- Each index duplicates a unique index or primary key on the same leading
-- column(s). The tables are small, so plain DROP INDEX (brief ACCESS EXCLUSIVE
-- lock per table, held until this migration commits) is fine here.
DROP INDEX IF EXISTS "core"."PasswordSetup_token_idx";
DROP INDEX IF EXISTS "core"."StashShare_token_idx";
DROP INDEX IF EXISTS "core"."EmailVerification_token_idx";
DROP INDEX IF EXISTS "core"."IntegrationCredential_userId_idx";
DROP INDEX IF EXISTS "channel"."ChannelVisualPreset_channelId_idx";
DROP INDEX IF EXISTS "channel"."BroadcastGreenRoomInvite_broadcastId_idx";
DROP INDEX IF EXISTS "governance"."GovernanceNoticeDelivery_meetingId_idx";
DROP INDEX IF EXISTS "governance"."Vote_motionId_idx";
DROP INDEX IF EXISTS "governance"."MotionSecond_motionId_idx";
DROP INDEX IF EXISTS "governance"."FeatureRequestVote_featureRequestId_idx";
DROP INDEX IF EXISTS "engagement"."SoundRepostAck_soundId_idx";
DROP INDEX IF EXISTS "engagement"."JamParticipant_sessionId_idx";
DROP INDEX IF EXISTS "release"."ReleaseTrackStem_releaseTrackId_idx";
