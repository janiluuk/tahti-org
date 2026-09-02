-- Rename the Archive* data model to Sound* (table, column, enum, constraint, and
-- index names) across every referencing table. Pure ALTER ... RENAME statements
-- throughout -- data-preserving, single transaction, no new/old type swap needed
-- (unlike this repo's enum *value* rename migrations, which need that dance only
-- because Postgres can't rename+drop a value atomically; irrelevant to a plain
-- table/column/enum-type rename).
BEGIN;

-- Enums
ALTER TYPE "channel"."ArchiveItemStatus" RENAME TO "SoundStatus";
ALTER TYPE "channel"."ArchiveContentType" RENAME TO "SoundContentType";
ALTER TYPE "channel"."ArchiveItemSource" RENAME TO "SoundSource";
ALTER TYPE "channel"."ArchiveQualityBadge" RENAME TO "SoundQualityBadge";
ALTER TYPE "channel"."ArchiveEmbedProvider" RENAME TO "SoundEmbedProvider";
ALTER TYPE "channel"."ArchiveLicense" RENAME TO "SoundLicense";

-- Tables
ALTER TABLE "channel"."ArchiveItem" RENAME TO "Sound";
ALTER TABLE "channel"."ArchiveItemStemJob" RENAME TO "SoundStemJob";
ALTER TABLE "channel"."ArchiveItemVersion" RENAME TO "SoundVersion";
ALTER TABLE "engagement"."ArchiveItemLike" RENAME TO "SoundLike";
ALTER TABLE "engagement"."ArchiveItemRepost" RENAME TO "SoundRepost";
ALTER TABLE "engagement"."ArchiveRepostAck" RENAME TO "SoundRepostAck";

-- Primary key constraints (cosmetic -- also renames the backing index)
ALTER TABLE "channel"."Sound" RENAME CONSTRAINT "ArchiveItem_pkey" TO "Sound_pkey";
ALTER TABLE "channel"."SoundStemJob" RENAME CONSTRAINT "ArchiveItemStemJob_pkey" TO "SoundStemJob_pkey";
ALTER TABLE "channel"."SoundVersion" RENAME CONSTRAINT "ArchiveItemVersion_pkey" TO "SoundVersion_pkey";
ALTER TABLE "engagement"."SoundLike" RENAME CONSTRAINT "ArchiveItemLike_pkey" TO "SoundLike_pkey";
ALTER TABLE "engagement"."SoundRepost" RENAME CONSTRAINT "ArchiveItemRepost_pkey" TO "SoundRepost_pkey";
ALTER TABLE "engagement"."SoundRepostAck" RENAME CONSTRAINT "ArchiveRepostAck_pkey" TO "SoundRepostAck_pkey";

-- Foreign key constraints (cosmetic -- the FK target is tracked by OID, not name,
-- so the enum/table renames above already took effect for these; only the
-- constraint's own label needs updating)
ALTER TABLE "channel"."Sound" RENAME CONSTRAINT "ArchiveItem_channelId_fkey" TO "Sound_channelId_fkey";
ALTER TABLE "channel"."Sound" RENAME CONSTRAINT "ArchiveItem_venueId_fkey" TO "Sound_venueId_fkey";
ALTER TABLE "channel"."SoundStemJob" RENAME CONSTRAINT "ArchiveItemStemJob_archiveItemId_fkey" TO "SoundStemJob_soundId_fkey";
ALTER TABLE "channel"."SoundVersion" RENAME CONSTRAINT "ArchiveItemVersion_archiveItemId_fkey" TO "SoundVersion_soundId_fkey";
ALTER TABLE "channel"."CuratedRotationItem" RENAME CONSTRAINT "CuratedRotationItem_archiveItemId_fkey" TO "CuratedRotationItem_soundId_fkey";
ALTER TABLE "channel"."LiveShowEpisode" RENAME CONSTRAINT "LiveShowEpisode_archiveItemId_fkey" TO "LiveShowEpisode_soundId_fkey";
ALTER TABLE "channel"."RadioPlayLog" RENAME CONSTRAINT "RadioPlayLog_archiveItemId_fkey" TO "RadioPlayLog_soundId_fkey";
ALTER TABLE "channel"."RadioTrackSubmissionItem" RENAME CONSTRAINT "RadioTrackSubmissionItem_archiveItemId_fkey" TO "RadioTrackSubmissionItem_soundId_fkey";
ALTER TABLE "core"."CloudImportJob" RENAME CONSTRAINT "CloudImportJob_archiveItemId_fkey" TO "CloudImportJob_soundId_fkey";
ALTER TABLE "engagement"."SoundLike" RENAME CONSTRAINT "ArchiveItemLike_userId_fkey" TO "SoundLike_userId_fkey";
ALTER TABLE "engagement"."SoundLike" RENAME CONSTRAINT "ArchiveItemLike_archiveItemId_fkey" TO "SoundLike_soundId_fkey";
ALTER TABLE "engagement"."SoundRepost" RENAME CONSTRAINT "ArchiveItemRepost_userId_fkey" TO "SoundRepost_userId_fkey";
ALTER TABLE "engagement"."SoundRepost" RENAME CONSTRAINT "ArchiveItemRepost_archiveItemId_fkey" TO "SoundRepost_soundId_fkey";
ALTER TABLE "engagement"."Comment" RENAME CONSTRAINT "Comment_archiveItemId_fkey" TO "Comment_soundId_fkey";
ALTER TABLE "engagement"."ListenEvent" RENAME CONSTRAINT "ListenEvent_archiveItemId_fkey" TO "ListenEvent_soundId_fkey";
ALTER TABLE "engagement"."TrackReaction" RENAME CONSTRAINT "TrackReaction_archiveItemId_fkey" TO "TrackReaction_soundId_fkey";
ALTER TABLE "media"."CollectionItem" RENAME CONSTRAINT "CollectionItem_archiveItemId_fkey" TO "CollectionItem_soundId_fkey";
ALTER TABLE "release"."MixUpload" RENAME CONSTRAINT "MixUpload_archiveItemId_fkey" TO "MixUpload_soundId_fkey";

-- Columns
ALTER TABLE "channel"."SoundStemJob" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "channel"."SoundVersion" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "channel"."Broadcast" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "channel"."CuratedRotationItem" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "channel"."LiveShowEpisode" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "channel"."RadioPlayLog" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "channel"."RadioTrackSubmissionItem" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "core"."CloudImportJob" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "core"."EditorProject" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."SoundLike" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."SoundRepost" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."SoundRepostAck" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."Comment" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."Download" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."ListenEvent" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."ListenSession" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "engagement"."TrackReaction" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "media"."CollectionItem" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "release"."MixUpload" RENAME COLUMN "archiveItemId" TO "soundId";
ALTER TABLE "release"."ReleaseTrack" RENAME COLUMN "archiveItemId" TO "soundId";

-- Indexes not already renamed via their owning PK constraint above
ALTER INDEX "channel"."ArchiveItem_channelId_createdAt_idx" RENAME TO "Sound_channelId_createdAt_idx";
ALTER INDEX "channel"."ArchiveItem_channelId_isPublic_status_idx" RENAME TO "Sound_channelId_isPublic_status_idx";
ALTER INDEX "channel"."ArchiveItemStemJob_archiveItemId_stemSet_key" RENAME TO "SoundStemJob_soundId_stemSet_key";
ALTER INDEX "channel"."ArchiveItemStemJob_expiresAt_idx" RENAME TO "SoundStemJob_expiresAt_idx";
ALTER INDEX "channel"."ArchiveItemVersion_archiveItemId_createdAt_idx" RENAME TO "SoundVersion_soundId_createdAt_idx";
ALTER INDEX "channel"."ArchiveItemVersion_archiveItemId_versionNumber_key" RENAME TO "SoundVersion_soundId_versionNumber_key";
ALTER INDEX "channel"."Broadcast_archiveItemId_key" RENAME TO "Broadcast_soundId_key";
ALTER INDEX "channel"."CuratedRotationItem_channelId_archiveItemId_key" RENAME TO "CuratedRotationItem_channelId_soundId_key";
ALTER INDEX "channel"."RadioTrackSubmissionItem_archiveItemId_status_idx" RENAME TO "RadioTrackSubmissionItem_soundId_status_idx";
ALTER INDEX "channel"."RadioTrackSubmissionItem_batchId_archiveItemId_key" RENAME TO "RadioTrackSubmissionItem_batchId_soundId_key";
ALTER INDEX "core"."CloudImportJob_archiveItemId_key" RENAME TO "CloudImportJob_soundId_key";
ALTER INDEX "engagement"."ArchiveItemLike_archiveItemId_idx" RENAME TO "SoundLike_soundId_idx";
ALTER INDEX "engagement"."ArchiveItemRepost_archiveItemId_idx" RENAME TO "SoundRepost_soundId_idx";
ALTER INDEX "engagement"."ArchiveRepostAck_archiveItemId_idx" RENAME TO "SoundRepostAck_soundId_idx";
ALTER INDEX "engagement"."ArchiveRepostAck_archiveItemId_byFingerprint_key" RENAME TO "SoundRepostAck_soundId_byFingerprint_key";
ALTER INDEX "engagement"."Comment_archiveItemId_createdAt_idx" RENAME TO "Comment_soundId_createdAt_idx";
ALTER INDEX "engagement"."Download_archiveItemId_createdAt_idx" RENAME TO "Download_soundId_createdAt_idx";
ALTER INDEX "engagement"."Download_byFingerprint_archiveItemId_idx" RENAME TO "Download_byFingerprint_soundId_idx";
ALTER INDEX "engagement"."ListenEvent_archiveItemId_playedAt_idx" RENAME TO "ListenEvent_soundId_playedAt_idx";
ALTER INDEX "engagement"."ListenEvent_archiveItemId_dedupeKey_dayBucket_key" RENAME TO "ListenEvent_soundId_dedupeKey_dayBucket_key";
ALTER INDEX "engagement"."ListenSession_archiveItemId_startedAt_idx" RENAME TO "ListenSession_soundId_startedAt_idx";
ALTER INDEX "engagement"."ListenSession_byFingerprint_channelId_archiveItemId_endedAt_idx" RENAME TO "ListenSession_byFingerprint_channelId_soundId_endedAt_idx";
ALTER INDEX "engagement"."TrackReaction_archiveItemId_positionSec_idx" RENAME TO "TrackReaction_soundId_positionSec_idx";
ALTER INDEX "release"."MixUpload_archiveItemId_key" RENAME TO "MixUpload_soundId_key";

-- "Auto-publish finished broadcast recording to the library" flag, renamed for clarity
ALTER TABLE "channel"."Broadcast" RENAME COLUMN "autoArchive" TO "autoPublish";
ALTER TABLE "channel"."LiveShowSeries" RENAME COLUMN "autoArchive" TO "autoPublish";
ALTER TABLE "channel"."ScheduledLiveShow" RENAME COLUMN "autoArchive" TO "autoPublish";

COMMIT;
