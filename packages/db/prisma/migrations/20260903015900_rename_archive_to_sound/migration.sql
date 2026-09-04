-- Archive -> Sound rename (PR #427) never shipped a real migration — it only
-- changed schema.prisma and relied on `prisma db push --accept-data-loss`,
-- which correctly refused because it would need to add required columns
-- (TrackReaction.soundId, ListenEvent.soundId, CuratedRotationItem.soundId,
-- ScheduledLiveShow.autoPublish) to tables that already have rows, with no
-- safe default. Production has been running Sound-shaped Prisma Client
-- against an unchanged ArchiveItem-shaped database ever since, 500ing on
-- anything that touches sound data (including GET /api/auth/me, since
-- computeUserStorageUsedBytes() calls prisma.sound.aggregate()).
--
-- This migration is entirely RENAME-based (tables, columns, enum types) —
-- no data is dropped or recreated. It's timestamped to run before the
-- already-pending 20260903020000_sound_media_kind_tags_release_track_metadata
-- migration, which itself assumes channel.Sound already exists.
--
-- Two enums (AuditAction, ContentReportTargetType) renamed VALUES in place
-- rather than being renamed wholesale; existing rows using the old value
-- labels (25 AuditLog rows: ARCHIVE_ITEM_LIKE, ARCHIVE_EDIT_PUBLISH,
-- ARCHIVE_METADATA_ADMIN_EDIT) are explicitly remapped in the type-swap's
-- USING clause instead of relying on Prisma's default text-cast, which
-- would fail outright for any row using a renamed label.

BEGIN;

-- ── Rename enum types (values unchanged) ────────────────────────────────────
ALTER TYPE "channel"."ArchiveItemStatus" RENAME TO "SoundStatus";
ALTER TYPE "channel"."ArchiveContentType" RENAME TO "SoundContentType";
ALTER TYPE "channel"."ArchiveItemSource" RENAME TO "SoundSource";
ALTER TYPE "channel"."ArchiveQualityBadge" RENAME TO "SoundQualityBadge";
ALTER TYPE "channel"."ArchiveEmbedProvider" RENAME TO "SoundEmbedProvider";
ALTER TYPE "channel"."ArchiveLicense" RENAME TO "SoundLicense";

-- ── AuditAction: add the new Sound-prefixed values, remap the 5 renamed
--    labels on existing rows, drop the old type ────────────────────────────
CREATE TYPE "governance"."AuditAction_new" AS ENUM ('CHAT_BAN', 'CHAT_UNBAN', 'CHAT_MESSAGE_DELETE', 'CHAT_MESSAGE_SEND', 'STREAM_KEY_ROTATE', 'RTMP_TARGET_ADD', 'RTMP_TARGET_DELETE', 'LEDGER_ENTRY_CREATE', 'MEMBER_SUSPEND', 'MEMBER_REINSTATE', 'MOTION_CREATE', 'MOTION_OPEN', 'MOTION_CLOSE', 'MOTION_COMMENT_CREATE', 'VOTE_CAST', 'GRANT_RUN', 'STRIPE_WEBHOOK_ERROR', 'DOWNLOAD_FRAUD_ALERT', 'MEMBERSHIP_RENEWAL_REMINDER', 'MEMBERSHIP_LAPSED', 'USER_SUSPEND', 'USER_UNSUSPEND', 'BOARD_ROLE_CHANGE', 'USER_TIER_CHANGE', 'ENGAGEMENT_ADJUSTMENT', 'STREAM_FORCE_OFFLINE', 'STREAM_RESTART', 'ACCOUNT_DELETE', 'SOUND_EDIT_RENDER', 'SOUND_EDIT_BOUNCE', 'SOUND_EDIT_PUBLISH', 'FEATURE_REQUEST_CREATE', 'FEATURE_REQUEST_VOTE', 'FEATURE_REQUEST_UNVOTE', 'FEATURE_REQUEST_COMMENT_CREATE', 'FEATURE_REQUEST_STATUS_UPDATE', 'FEATURE_REQUEST_QUARTERLY_REPORT', 'SOUND_METADATA_ADMIN_EDIT', 'API_TOKEN_CREATE', 'API_TOKEN_REVOKE', 'USER_LOGIN', 'USER_REGISTER', 'CONTENT_UPLOAD', 'RELEASE_PUBLISH', 'SOUND_ITEM_LIKE', 'ARTIST_FOLLOW', 'FAN_SUBSCRIPTION_CREATE', 'RADIO_SLOT_BOOKING_CREATE', 'RADIO_SLOT_BOOKING_UPDATE', 'RADIO_SLOT_BOOKING_CANCEL', 'CHANNEL_GO_LIVE');

ALTER TABLE "governance"."AuditLog" ALTER COLUMN "action" TYPE "governance"."AuditAction_new" USING (
  (CASE "action"::text
    WHEN 'ARCHIVE_EDIT_RENDER' THEN 'SOUND_EDIT_RENDER'
    WHEN 'ARCHIVE_EDIT_BOUNCE' THEN 'SOUND_EDIT_BOUNCE'
    WHEN 'ARCHIVE_EDIT_PUBLISH' THEN 'SOUND_EDIT_PUBLISH'
    WHEN 'ARCHIVE_METADATA_ADMIN_EDIT' THEN 'SOUND_METADATA_ADMIN_EDIT'
    WHEN 'ARCHIVE_ITEM_LIKE' THEN 'SOUND_ITEM_LIKE'
    ELSE "action"::text
  END)::"governance"."AuditAction_new"
);
ALTER TYPE "governance"."AuditAction" RENAME TO "AuditAction_old";
ALTER TYPE "governance"."AuditAction_new" RENAME TO "AuditAction";
DROP TYPE "governance"."AuditAction_old";

-- ── ContentReportTargetType: ARCHIVE_ITEM -> SOUND_ITEM (0 existing rows,
--    remapped defensively anyway) ───────────────────────────────────────────
CREATE TYPE "admin"."ContentReportTargetType_new" AS ENUM ('SOUND_ITEM', 'RELEASE', 'CHANNEL', 'COLLECTION', 'MOTION_COMMENT');
ALTER TABLE "admin"."ContentReport" ALTER COLUMN "targetType" TYPE "admin"."ContentReportTargetType_new" USING (
  (CASE "targetType"::text
    WHEN 'ARCHIVE_ITEM' THEN 'SOUND_ITEM'
    ELSE "targetType"::text
  END)::"admin"."ContentReportTargetType_new"
);
ALTER TYPE "admin"."ContentReportTargetType" RENAME TO "ContentReportTargetType_old";
ALTER TYPE "admin"."ContentReportTargetType_new" RENAME TO "ContentReportTargetType";
DROP TYPE "admin"."ContentReportTargetType_old";

-- ── Rename tables ────────────────────────────────────────────────────────
ALTER TABLE "channel"."ArchiveItem" RENAME TO "Sound";
ALTER TABLE "channel"."ArchiveItemStemJob" RENAME TO "SoundStemJob";
ALTER TABLE "channel"."ArchiveItemVersion" RENAME TO "SoundVersion";
ALTER TABLE "engagement"."ArchiveItemLike" RENAME TO "SoundLike";
ALTER TABLE "engagement"."ArchiveItemRepost" RENAME TO "SoundRepost";
ALTER TABLE "engagement"."ArchiveRepostAck" RENAME TO "SoundRepostAck";

-- ── Rename archiveItemId -> soundId columns ─────────────────────────────
ALTER TABLE "core"."CloudImportJob" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "core"."EditorProject" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "channel"."RadioPlayLog" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "channel"."Broadcast" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "channel"."LiveShowEpisode" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "channel"."SoundStemJob" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "channel"."SoundVersion" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "channel"."CuratedRotationItem" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "channel"."RadioTrackSubmissionItem" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."SoundLike" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."SoundRepost" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."TrackReaction" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."ListenEvent" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."Comment" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."SoundRepostAck" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."Download" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."ListenSession" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "release"."MixUpload" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "release"."ReleaseTrack" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "media"."CollectionItem" RENAME COLUMN "archiveItemId" TO "soundId";

-- ── Rename autoArchive -> autoPublish columns (pure relabel, same
--    type/default/meaning — see LiveShowSeries/Broadcast/ScheduledLiveShow
--    in schema.prisma) ───────────────────────────────────────────────────
ALTER TABLE "channel"."Broadcast" RENAME COLUMN "autoArchive" TO "autoPublish";
ALTER TABLE "channel"."LiveShowSeries" RENAME COLUMN "autoArchive" TO "autoPublish";
ALTER TABLE "channel"."ScheduledLiveShow" RENAME COLUMN "autoArchive" TO "autoPublish";

-- ── Rename FK constraints to match the new table/column names ──────────
ALTER TABLE "channel"."Sound" RENAME CONSTRAINT "ArchiveItem_channelId_fkey" TO "Sound_channelId_fkey";
ALTER TABLE "channel"."Sound" RENAME CONSTRAINT "ArchiveItem_purchaseTierId_fkey" TO "Sound_purchaseTierId_fkey";
ALTER TABLE "channel"."Sound" RENAME CONSTRAINT "ArchiveItem_venueId_fkey" TO "Sound_venueId_fkey";
ALTER TABLE "channel"."SoundStemJob" RENAME CONSTRAINT "ArchiveItemStemJob_archiveItemId_fkey" TO "SoundStemJob_soundId_fkey";
ALTER TABLE "channel"."SoundVersion" RENAME CONSTRAINT "ArchiveItemVersion_archiveItemId_fkey" TO "SoundVersion_soundId_fkey";
ALTER TABLE "channel"."CuratedRotationItem" RENAME CONSTRAINT "CuratedRotationItem_archiveItemId_fkey" TO "CuratedRotationItem_soundId_fkey";
ALTER TABLE "channel"."LiveShowEpisode" RENAME CONSTRAINT "LiveShowEpisode_archiveItemId_fkey" TO "LiveShowEpisode_soundId_fkey";
ALTER TABLE "channel"."RadioPlayLog" RENAME CONSTRAINT "RadioPlayLog_archiveItemId_fkey" TO "RadioPlayLog_soundId_fkey";
ALTER TABLE "channel"."RadioTrackSubmissionItem" RENAME CONSTRAINT "RadioTrackSubmissionItem_archiveItemId_fkey" TO "RadioTrackSubmissionItem_soundId_fkey";
ALTER TABLE "core"."CloudImportJob" RENAME CONSTRAINT "CloudImportJob_archiveItemId_fkey" TO "CloudImportJob_soundId_fkey";
ALTER TABLE "engagement"."SoundLike" RENAME CONSTRAINT "ArchiveItemLike_archiveItemId_fkey" TO "SoundLike_soundId_fkey";
ALTER TABLE "engagement"."SoundLike" RENAME CONSTRAINT "ArchiveItemLike_userId_fkey" TO "SoundLike_userId_fkey";
ALTER TABLE "engagement"."SoundRepost" RENAME CONSTRAINT "ArchiveItemRepost_archiveItemId_fkey" TO "SoundRepost_soundId_fkey";
ALTER TABLE "engagement"."SoundRepost" RENAME CONSTRAINT "ArchiveItemRepost_userId_fkey" TO "SoundRepost_userId_fkey";
ALTER TABLE "engagement"."Comment" RENAME CONSTRAINT "Comment_archiveItemId_fkey" TO "Comment_soundId_fkey";
ALTER TABLE "engagement"."ListenEvent" RENAME CONSTRAINT "ListenEvent_archiveItemId_fkey" TO "ListenEvent_soundId_fkey";
ALTER TABLE "engagement"."TrackReaction" RENAME CONSTRAINT "TrackReaction_archiveItemId_fkey" TO "TrackReaction_soundId_fkey";
ALTER TABLE "media"."CollectionItem" RENAME CONSTRAINT "CollectionItem_archiveItemId_fkey" TO "CollectionItem_soundId_fkey";
ALTER TABLE "release"."MixUpload" RENAME CONSTRAINT "MixUpload_archiveItemId_fkey" TO "MixUpload_soundId_fkey";

-- ── Rename indexes to match ──────────────────────────────────────────────
ALTER INDEX "channel"."ArchiveItem_channelId_createdAt_idx" RENAME TO "Sound_channelId_createdAt_idx";
ALTER INDEX "channel"."ArchiveItem_channelId_isPublic_status_idx" RENAME TO "Sound_channelId_isPublic_status_idx";
ALTER INDEX "channel"."ArchiveItem_pkey" RENAME TO "Sound_pkey";
ALTER INDEX "channel"."ArchiveItem_purchaseTierId_idx" RENAME TO "Sound_purchaseTierId_idx";
ALTER INDEX "channel"."ArchiveItemStemJob_archiveItemId_stemSet_key" RENAME TO "SoundStemJob_soundId_stemSet_key";
ALTER INDEX "channel"."ArchiveItemStemJob_expiresAt_idx" RENAME TO "SoundStemJob_expiresAt_idx";
ALTER INDEX "channel"."ArchiveItemStemJob_pkey" RENAME TO "SoundStemJob_pkey";
ALTER INDEX "channel"."ArchiveItemVersion_archiveItemId_createdAt_idx" RENAME TO "SoundVersion_soundId_createdAt_idx";
ALTER INDEX "channel"."ArchiveItemVersion_archiveItemId_versionNumber_key" RENAME TO "SoundVersion_soundId_versionNumber_key";
ALTER INDEX "channel"."ArchiveItemVersion_pkey" RENAME TO "SoundVersion_pkey";
ALTER INDEX "engagement"."ArchiveItemLike_archiveItemId_idx" RENAME TO "SoundLike_soundId_idx";
ALTER INDEX "engagement"."ArchiveItemLike_pkey" RENAME TO "SoundLike_pkey";
ALTER INDEX "engagement"."ArchiveItemLike_userId_createdAt_idx" RENAME TO "SoundLike_userId_createdAt_idx";
ALTER INDEX "engagement"."ArchiveItemRepost_archiveItemId_idx" RENAME TO "SoundRepost_soundId_idx";
ALTER INDEX "engagement"."ArchiveItemRepost_pkey" RENAME TO "SoundRepost_pkey";
ALTER INDEX "engagement"."ArchiveRepostAck_archiveItemId_byFingerprint_key" RENAME TO "SoundRepostAck_soundId_byFingerprint_key";
ALTER INDEX "engagement"."ArchiveRepostAck_archiveItemId_idx" RENAME TO "SoundRepostAck_soundId_idx";
ALTER INDEX "engagement"."ArchiveRepostAck_pkey" RENAME TO "SoundRepostAck_pkey";
ALTER INDEX "core"."CloudImportJob_archiveItemId_key" RENAME TO "CloudImportJob_soundId_key";
ALTER INDEX "channel"."Broadcast_archiveItemId_key" RENAME TO "Broadcast_soundId_key";
ALTER INDEX "channel"."CuratedRotationItem_channelId_archiveItemId_key" RENAME TO "CuratedRotationItem_channelId_soundId_key";
ALTER INDEX "channel"."RadioTrackSubmissionItem_archiveItemId_status_idx" RENAME TO "RadioTrackSubmissionItem_soundId_status_idx";
ALTER INDEX "channel"."RadioTrackSubmissionItem_batchId_archiveItemId_key" RENAME TO "RadioTrackSubmissionItem_batchId_soundId_key";
ALTER INDEX "engagement"."Download_byFingerprint_archiveItemId_idx" RENAME TO "Download_byFingerprint_soundId_idx";
ALTER INDEX "engagement"."Download_archiveItemId_createdAt_idx" RENAME TO "Download_soundId_createdAt_idx";
ALTER INDEX "engagement"."ListenSession_archiveItemId_startedAt_idx" RENAME TO "ListenSession_soundId_startedAt_idx";
ALTER INDEX "engagement"."ListenSession_byFingerprint_channelId_archiveItemId_endedAt_idx" RENAME TO "ListenSession_byFingerprint_channelId_soundId_endedAt_idx";
ALTER INDEX "engagement"."TrackReaction_archiveItemId_positionSec_idx" RENAME TO "TrackReaction_soundId_positionSec_idx";
ALTER INDEX "engagement"."ListenEvent_archiveItemId_playedAt_idx" RENAME TO "ListenEvent_soundId_playedAt_idx";
ALTER INDEX "engagement"."ListenEvent_archiveItemId_dedupeKey_dayBucket_key" RENAME TO "ListenEvent_soundId_dedupeKey_dayBucket_key";
ALTER INDEX "engagement"."Comment_archiveItemId_createdAt_idx" RENAME TO "Comment_soundId_createdAt_idx";
ALTER INDEX "release"."MixUpload_archiveItemId_key" RENAME TO "MixUpload_soundId_key";

COMMIT;
