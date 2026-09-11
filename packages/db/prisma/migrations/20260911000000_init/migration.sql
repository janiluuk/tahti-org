-- Squashed baseline: replaces all pre-2026-09-11 migrations now that the
-- project is still in dev phase and doesn't need per-change migration
-- history. Generated via `prisma migrate diff --from-empty
-- --to-schema-datamodel prisma/schema.prisma --script`, verified to produce
-- a database with zero drift against schema.prisma.
--
-- Any environment with the old migration history already applied (this
-- covers production) must run, once, before its next `prisma migrate
-- deploy`:
--   prisma migrate resolve --applied 20260911000000_init
-- so this migration is recorded as already applied instead of re-run.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "admin";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "channel";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "chat";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "core";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "engagement";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "fansubs";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "governance";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ledger";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "media";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "newsletter";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "release";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "venue";

-- CreateEnum
CREATE TYPE "core"."ArtistTier" AS ENUM ('FREE', 'ARTIST', 'STUDIO');

-- CreateEnum
CREATE TYPE "core"."MembershipStatus" AS ENUM ('PENDING_EMAIL', 'PENDING_PAYMENT', 'ACTIVE', 'SUSPENDED', 'RESIGNED');

-- CreateEnum
CREATE TYPE "core"."BetaApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "channel"."ChannelState" AS ENUM ('OFFLINE', 'PREVIEW', 'LIVE');

-- CreateEnum
CREATE TYPE "channel"."ArtistKind" AS ENUM ('SINGLE', 'COLLECTIVE');

-- CreateEnum
CREATE TYPE "channel"."TrackAccessMode" AS ENUM ('FREE', 'SUBSCRIBERS_ONLY', 'PURCHASE');

-- CreateEnum
CREATE TYPE "channel"."ChannelGalleryMode" AS ENUM ('NONE', 'STATIC_SLIDESHOW', 'TWISTED_WAVE_GLSL', 'ZOOM_BLUR_GLSL', 'RGB_SHIFT_GLSL', 'POSTER_WALL_GLSL', 'SHATTER_CAROUSEL_GLSL');

-- CreateEnum
CREATE TYPE "channel"."ChannelHeaderStyle" AS ENUM ('GRADIENT', 'SOLID', 'VIDEO_LOOP');

-- CreateEnum
CREATE TYPE "channel"."ChannelTextLayerMode" AS ENUM ('NONE', 'GRADIENT_SHIMMER', 'COSMIC_NEON', 'LAYERED_WAVE_3D', 'SHIMMER_LINES', 'GHOST_ECHO');

-- CreateEnum
CREATE TYPE "channel"."ChannelTextLayerAlign" AS ENUM ('LEFT', 'CENTER', 'RIGHT');

-- CreateEnum
CREATE TYPE "channel"."VisualPreset" AS ENUM ('MINIMAL', 'WAVEFORM_BARS', 'PARTICLE_FIELD', 'AURORA', 'REACTIVE_GRID', 'CLOUDSCAPE', 'LINE_TANGLE', 'BACKDROP_BOX', 'LENS_FLARES', 'IES_SPOTLIGHT', 'WATER_RIPPLE');

-- CreateEnum
CREATE TYPE "channel"."SlideshowPreset" AS ENUM ('FADE', 'ZOOM', 'PAN', 'BLUR_CROSS', 'PARTICLE_DISSOLVE', 'GLITCH_WIPE', 'CUBE_FLIP', 'LIQUID_DISTORTION');

-- CreateEnum
CREATE TYPE "channel"."SoundStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "channel"."StreamingCopyStatus" AS ENUM ('NOT_NEEDED', 'PENDING', 'PROCESSING', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "channel"."AnnouncementScheduleMode" AS ENUM ('AFTER_EVERY', 'EVERY_NTH', 'RANDOM');

-- CreateEnum
CREATE TYPE "channel"."AnnouncementRenderStatus" AS ENUM ('READY', 'PROCESSING', 'ERROR');

-- CreateEnum
CREATE TYPE "channel"."SoundContentType" AS ENUM ('LIVE', 'TRACK', 'DJ_SET', 'PODCAST', 'REMIX', 'SHOW', 'EPISODE', 'CLIP', 'EMBED');

-- CreateEnum
CREATE TYPE "channel"."SoundSource" AS ENUM ('UPLOAD', 'BROADCAST', 'BANDCAMP', 'SOUNDCLOUD', 'GOOGLE_DRIVE', 'MIXCLOUD_RESCUE', 'SPOTIFY_EMBED', 'MIXCLOUD_EMBED', 'HEARTHIS', 'URL_EMBED', 'HEARTHIS_EMBED');

-- CreateEnum
CREATE TYPE "channel"."SoundQualityBadge" AS ENUM ('LOSSLESS', 'TRANSCODED', 'EMBED_ONLY');

-- CreateEnum
CREATE TYPE "channel"."SoundEmbedProvider" AS ENUM ('SPOTIFY', 'MIXCLOUD', 'YOUTUBE', 'APPLE', 'GENERIC', 'HEARTHIS');

-- CreateEnum
CREATE TYPE "channel"."SoundMediaKind" AS ENUM ('AUDIO', 'IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "channel"."SoundLicense" AS ENUM ('ALL_RIGHTS_RESERVED', 'CC_BY', 'CC_BY_NC', 'CC_BY_NC_SA', 'CC_BY_NC_ND', 'CC_BY_SA', 'CC0');

-- CreateEnum
CREATE TYPE "channel"."BroadcastSource" AS ENUM ('RTMP', 'ICECAST', 'WEBRTC');

-- CreateEnum
CREATE TYPE "channel"."BroadcastVisibility" AS ENUM ('PUBLIC', 'FAN_ONLY');

-- CreateEnum
CREATE TYPE "channel"."BroadcastShowType" AS ENUM ('LIVE_SET', 'TALK');

-- CreateEnum
CREATE TYPE "channel"."GreenRoomInvitePool" AS ENUM ('MODERATORS_AND_SUBS', 'SUBS_ONLY', 'MANUAL_ONLY', 'EVERYONE');

-- CreateEnum
CREATE TYPE "channel"."GreenRoomInviteSource" AS ENUM ('MODERATOR', 'FAN_SUB', 'MANUAL', 'PUBLIC');

-- CreateEnum
CREATE TYPE "channel"."RtmpTargetProvider" AS ENUM ('YOUTUBE', 'TWITCH', 'FACEBOOK', 'KICK', 'TIKTOK', 'MIXCLOUD_LIVE', 'INSTAGRAM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ledger"."LedgerCategory" AS ENUM ('REVENUE_SUBSCRIPTION', 'REVENUE_DISTRIBUTION', 'REVENUE_GRANT_INBOUND', 'REVENUE_DONATION', 'COST_INFRASTRUCTURE', 'COST_DISTRIBUTION_PASSTHROUGH', 'COST_OPERATIONS', 'COST_SALARY', 'COST_AUDIT', 'COST_PROFESSIONAL_SERVICES', 'GRANT_DISBURSEMENT', 'RESERVE_TRANSFER', 'FAN_SUB_GROSS_RECEIVED', 'FAN_SUB_NET_TO_ARTIST', 'FAN_SUB_OPERATIONAL_FEE', 'PURCHASE_TIER_GROSS_RECEIVED', 'PURCHASE_TIER_NET_TO_ARTIST', 'PURCHASE_TIER_OPERATIONAL_FEE');

-- CreateEnum
CREATE TYPE "ledger"."GrantState" AS ENUM ('PENDING', 'CONFIRMED', 'PAID', 'UNCLAIMED');

-- CreateEnum
CREATE TYPE "governance"."AuditAction" AS ENUM ('CHAT_BAN', 'CHAT_UNBAN', 'CHAT_MESSAGE_DELETE', 'CHAT_MESSAGE_SEND', 'STREAM_KEY_ROTATE', 'RTMP_TARGET_ADD', 'RTMP_TARGET_DELETE', 'LEDGER_ENTRY_CREATE', 'MEMBER_SUSPEND', 'MEMBER_REINSTATE', 'MOTION_CREATE', 'MOTION_OPEN', 'MOTION_CLOSE', 'MOTION_COMMENT_CREATE', 'VOTE_CAST', 'VOTE_CHANGE', 'VOTE_RETRACT', 'GRANT_RUN', 'STRIPE_WEBHOOK_ERROR', 'DOWNLOAD_FRAUD_ALERT', 'MEMBERSHIP_RENEWAL_REMINDER', 'MEMBERSHIP_LAPSED', 'USER_SUSPEND', 'USER_UNSUSPEND', 'BOARD_ROLE_CHANGE', 'USER_TIER_CHANGE', 'ENGAGEMENT_ADJUSTMENT', 'STREAM_FORCE_OFFLINE', 'STREAM_RESTART', 'DISCORD_BOT_RESTART', 'ACCOUNT_DELETE', 'SOUND_EDIT_RENDER', 'SOUND_EDIT_BOUNCE', 'SOUND_EDIT_PUBLISH', 'FEATURE_REQUEST_CREATE', 'FEATURE_REQUEST_VOTE', 'FEATURE_REQUEST_UNVOTE', 'FEATURE_REQUEST_COMMENT_CREATE', 'FEATURE_REQUEST_STATUS_UPDATE', 'FEATURE_REQUEST_QUARTERLY_REPORT', 'SOUND_METADATA_ADMIN_EDIT', 'API_TOKEN_CREATE', 'API_TOKEN_REVOKE', 'USER_LOGIN', 'USER_REGISTER', 'CONTENT_UPLOAD', 'RELEASE_PUBLISH', 'SOUND_ITEM_LIKE', 'ARTIST_FOLLOW', 'FAN_SUBSCRIPTION_CREATE', 'RADIO_SLOT_BOOKING_CREATE', 'RADIO_SLOT_BOOKING_UPDATE', 'RADIO_SLOT_BOOKING_CANCEL', 'CHANNEL_GO_LIVE', 'MEETING_CREATE', 'MEETING_UPDATE', 'MEETING_ATTENDANCE_UPSERT', 'DOCUMENT_CREATE', 'RESOLUTION_CREATE', 'RESOLUTION_UPDATE', 'ANNUAL_REPORT_GENERATE', 'MINUTES_UPLOAD', 'MINUTES_APPROVE', 'MINUTES_SIGN', 'MINUTES_REDACT', 'MINUTES_PUBLISH', 'MEETING_NOTICE_PUBLISH', 'MEETING_NOTICE_SEND', 'CONFLICT_DECLARE');

-- CreateEnum
CREATE TYPE "governance"."MotionState" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "governance"."GovernanceMeetingType" AS ENUM ('GENERAL', 'EXTRAORDINARY_GENERAL', 'BOARD');

-- CreateEnum
CREATE TYPE "governance"."GovernanceMeetingState" AS ENUM ('DRAFT', 'SCHEDULED', 'HELD', 'MINUTES_DRAFT', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "governance"."GovernanceDocumentType" AS ENUM ('BYLAWS', 'POLICY', 'MEETING_NOTICE', 'MINUTES', 'ANNUAL_REPORT', 'FINANCIAL_STATEMENT', 'AUDIT_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "governance"."GovernanceAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "governance"."VoteChoice" AS ENUM ('YES', 'NO', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "fansubs"."FanSubState" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "core"."SocialPlatform" AS ENUM ('MASTODON', 'BLUESKY', 'TWITTER', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "core"."SocialPostState" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "fansubs"."FanSubPayoutState" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "release"."ReleaseType" AS ENUM ('SINGLE', 'EP', 'ALBUM', 'COMPILATION', 'REMIX');

-- CreateEnum
CREATE TYPE "release"."ReleaseState" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "release"."TrackStatus" AS ENUM ('PENDING', 'SCANNING', 'TRANSCODING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "release"."MixUploadStatus" AS ENUM ('PENDING', 'UPLOADING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "newsletter"."NewsletterDraftState" AS ENUM ('DRAFT', 'QUEUED', 'SENT');

-- CreateEnum
CREATE TYPE "newsletter"."NewsletterSendState" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "venue"."VenueBroadcastState" AS ENUM ('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "core"."MentionSurface" AS ENUM ('BIO', 'ANNOUNCEMENT', 'RELEASE', 'NEWSLETTER', 'TRACKLIST', 'CHAT');

-- CreateEnum
CREATE TYPE "core"."NotificationType" AS ENUM ('NEW_POST', 'NEW_MESSAGE', 'NEW_TRACK', 'NEW_FOLLOWER', 'NEW_LIKE', 'NEW_REPOST', 'PLAYLIST_TRACK_ADDED', 'NEW_RELEASE', 'CHAT_MENTION', 'RADIO_SUBMISSION_REJECTED', 'THEME_UNDER_REVIEW', 'THEME_APPROVED', 'THEME_REJECTED', 'ADMIN_TEST', 'MISSED_LIVE_SHOW_FLAGGED', 'STREAMING_COPY_READY');

-- CreateEnum
CREATE TYPE "channel"."RadioSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "media"."CollectionType" AS ENUM ('MIX_SERIES', 'ALBUM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "media"."CollectionStyle" AS ENUM ('ALBUM', 'EP', 'SINGLE', 'DJ_SET_SERIES', 'PODCAST', 'RECORDING', 'PLAYLIST', 'SERIES');

-- CreateEnum
CREATE TYPE "media"."CollectionTrackSortMode" AS ENUM ('MANUAL', 'TIME', 'NAME');

-- CreateEnum
CREATE TYPE "media"."CollectionVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'DRAFT');

-- CreateEnum
CREATE TYPE "media"."CollectionCoverMode" AS ENUM ('AUTO', 'CUSTOM');

-- CreateEnum
CREATE TYPE "media"."CollectionGalleryMode" AS ENUM ('NONE', 'STATIC_SLIDESHOW', 'TWISTED_WAVE_GLSL', 'ZOOM_BLUR_GLSL', 'RGB_SHIFT_GLSL', 'POSTER_WALL_GLSL', 'SHATTER_CAROUSEL_GLSL');

-- CreateEnum
CREATE TYPE "media"."CollectionTextLayerMode" AS ENUM ('NONE', 'GRADIENT_SHIMMER', 'COSMIC_NEON', 'LAYERED_WAVE_3D', 'SHIMMER_LINES', 'GHOST_ECHO');

-- CreateEnum
CREATE TYPE "media"."CollectionTextLayerAlign" AS ENUM ('LEFT', 'CENTER', 'RIGHT');

-- CreateEnum
CREATE TYPE "core"."CloudImportSource" AS ENUM ('GOOGLE_DRIVE', 'SOUNDCLOUD', 'HEARTHIS');

-- CreateEnum
CREATE TYPE "core"."CloudImportStatus" AS ENUM ('QUEUED', 'DOWNLOADING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "engagement"."TrackReactionType" AS ENUM ('LOVE', 'LAUGH', 'SURPRISE', 'HANDS_UP');

-- CreateEnum
CREATE TYPE "channel"."LiveShowEpisodeStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'LIVE');

-- CreateEnum
CREATE TYPE "core"."AccountRestrictionType" AS ENUM ('LIVE_SHOW_BOOKING', 'UPLOAD', 'LOGIN');

-- CreateEnum
CREATE TYPE "channel"."StemSet" AS ENUM ('TWO_STEM', 'FOUR_STEM');

-- CreateEnum
CREATE TYPE "channel"."StemJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "governance"."FeatureRequestStatus" AS ENUM ('OPEN', 'PLANNED', 'IN_PROGRESS', 'DONE', 'DECLINED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "engagement"."ListenSource" AS ENUM ('CHANNEL_PAGE', 'TAHTI_RADIO', 'ARTIST_PROFILE', 'DISCOVER', 'LIBRARY', 'EMBED', 'OTHER');

-- CreateEnum
CREATE TYPE "fansubs"."PurchaseState" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "engagement"."JamParticipantRole" AS ENUM ('HOST', 'GUEST');

-- CreateEnum
CREATE TYPE "admin"."CronOutcome" AS ENUM ('SUCCESS', 'ERROR');

-- CreateEnum
CREATE TYPE "admin"."SupportCategory" AS ENUM ('ENGAGEMENT_DISPUTE', 'TECHNICAL', 'FINANCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "admin"."SupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "admin"."ContentReportTargetType" AS ENUM ('SOUND_ITEM', 'RELEASE', 'CHANNEL', 'COLLECTION', 'MOTION_COMMENT');

-- CreateEnum
CREATE TYPE "admin"."ContentReportReason" AS ENUM ('COPYRIGHT', 'HARASSMENT', 'SPAM', 'ILLEGAL_CONTENT', 'OTHER');

-- CreateEnum
CREATE TYPE "admin"."ContentReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "admin"."ResolutionOutcome" AS ENUM ('PASSED', 'FAILED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "admin"."SupportTicketNoteKind" AS ENUM ('MESSAGE', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "core"."AddonScope" AS ENUM ('LISTENER', 'ARTIST', 'ADMIN');

-- CreateEnum
CREATE TYPE "core"."AddonStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "core"."ChannelBlockType" AS ENUM ('LOGO', 'ADDON');

-- CreateEnum
CREATE TYPE "core"."ChannelBlockWidth" AS ENUM ('FULL', 'HALF', 'THIRD');

-- CreateEnum
CREATE TYPE "core"."ThemeVisibility" AS ENUM ('PRIVATE', 'PENDING_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "core"."ThemePrStatus" AS ENUM ('NONE', 'PENDING', 'OPENED', 'ERROR');

-- CreateTable
CREATE TABLE "core"."CloudImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "core"."CloudImportSource" NOT NULL,
    "externalFileId" TEXT NOT NULL,
    "fileName" TEXT,
    "soundId" TEXT,
    "status" "core"."CloudImportStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "bytesTransferred" BIGINT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CloudImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "fullBio" TEXT,
    "avatarUrl" TEXT,
    "avatarPosterUrl" TEXT,
    "avatarPaletteJson" TEXT,
    "avatarThemeJson" TEXT,
    "logoUrl" TEXT,
    "logoPlacement" TEXT,
    "socialLinks" JSONB,
    "tipJarUrl" TEXT,
    "newsFeedUrl" TEXT,
    "countryCode" TEXT,
    "pronouns" TEXT,
    "gender" TEXT,
    "defaultLocation" TEXT,
    "tier" "core"."ArtistTier" NOT NULL DEFAULT 'FREE',
    "isMember" BOOLEAN NOT NULL DEFAULT false,
    "isBoard" BOOLEAN NOT NULL DEFAULT false,
    "memberNumber" INTEGER,
    "memberSince" TIMESTAMP(3),
    "publicAttribution" BOOLEAN NOT NULL DEFAULT true,
    "showJoinDate" BOOLEAN NOT NULL DEFAULT true,
    "showFollowers" BOOLEAN NOT NULL DEFAULT true,
    "showFollowing" BOOLEAN NOT NULL DEFAULT true,
    "showDailyListeners" BOOLEAN NOT NULL DEFAULT true,
    "showLikes" BOOLEAN NOT NULL DEFAULT true,
    "showPageHero" BOOLEAN NOT NULL DEFAULT true,
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "stripeCustomerId" TEXT,
    "stripeMembershipSubscriptionId" TEXT,
    "stripeConnectAccountId" TEXT,
    "stripeConnectChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "softTargetBytes" BIGINT NOT NULL DEFAULT 524288000,
    "hiddenCeilingBytes" BIGINT NOT NULL DEFAULT 53687091200,
    "storageUsedBytes" BIGINT NOT NULL DEFAULT 0,
    "weeklyLiveSecondsUsed" INTEGER NOT NULL DEFAULT 0,
    "weeklyLiveResetAt" TIMESTAMP(3),
    "mentionsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "publicMentionsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultTrackCommentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultChannelCommentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "topListsOptOut" BOOLEAN NOT NULL DEFAULT false,
    "notifyMoneyMovesEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyMoneyMovesInApp" BOOLEAN NOT NULL DEFAULT true,
    "notifyListenerActivityEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyWeeklyRecapEmail" BOOLEAN NOT NULL DEFAULT true,
    "suspendedAt" TIMESTAMP(3),
    "suspendReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "mixcloudAccessTokenEnc" TEXT,
    "bandcampAccessTokenEnc" TEXT,
    "soundcloudAccessTokenEnc" TEXT,
    "googleDriveAccessTokenEnc" TEXT,
    "googleDriveRefreshTokenEnc" TEXT,
    "musicbrainzAccessTokenEnc" TEXT,
    "musicbrainzRefreshTokenEnc" TEXT,
    "musicbrainzUsername" TEXT,
    "defaultRegisterToMusicbrainz" BOOLEAN,
    "spotifyArtistId" TEXT,
    "mixcloudUsername" TEXT,
    "hearthisUsername" TEXT,
    "totpSecretEnc" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ArtistEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "eventUrl" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."UserStorageQuota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quotaBytes" BIGINT NOT NULL DEFAULT 524288000,
    "usedBytes" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStorageQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ArtistPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "ArtistPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ArtistEmbed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "authorName" TEXT,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistEmbed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."EditorProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "soundId" TEXT,
    "timeline" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."BetaApplication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "artistType" TEXT NOT NULL,
    "links" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL,
    "status" "core"."BetaApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetaApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."PasswordSetup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."SocialConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "core"."SocialPlatform" NOT NULL,
    "instanceUrl" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "onReleasePublished" BOOLEAN NOT NULL DEFAULT false,
    "onChannelLive" BOOLEAN NOT NULL DEFAULT false,
    "postTemplate" TEXT NOT NULL DEFAULT 'New release: {release} by {artist} — {smart_link}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."SocialPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "core"."SocialPlatform" NOT NULL,
    "trigger" TEXT NOT NULL,
    "releaseId" TEXT,
    "channelId" TEXT,
    "message" TEXT NOT NULL,
    "state" "core"."SocialPostState" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ApiToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['read']::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."TotpBackupCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TotpBackupCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."TotpChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TotpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."IntegrationCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerSlug" TEXT NOT NULL,
    "fieldsEnc" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."StashFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "format" TEXT,
    "bitDepth" INTEGER,
    "sampleRate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StashFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."StashShare" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "granteeUsername" TEXT,
    "token" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'READ',
    "fileCount" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StashShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."EmailVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "core"."MembershipStatus" NOT NULL DEFAULT 'PENDING_EMAIL',
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."Channel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "customDomain" TEXT,
    "customDomainVerified" BOOLEAN NOT NULL DEFAULT false,
    "artistKind" "channel"."ArtistKind" NOT NULL DEFAULT 'SINGLE',
    "state" "channel"."ChannelState" NOT NULL DEFAULT 'OFFLINE',
    "containerId" TEXT,
    "liveSourceMount" TEXT NOT NULL,
    "liveSourcePass" TEXT NOT NULL,
    "liveSourcePassHash" TEXT NOT NULL,
    "rtmpStreamKey" TEXT NOT NULL,
    "rtmpStreamKeyHash" TEXT NOT NULL,
    "rtmpStreamKeyPreviousHash" TEXT,
    "rtmpStreamKeyPreviousExpiresAt" TIMESTAMP(3),
    "liveSourcePassPreviousHash" TEXT,
    "liveSourcePassPreviousExpiresAt" TIMESTAMP(3),
    "webrtcTokenHash" TEXT,
    "fallbackMode" TEXT NOT NULL DEFAULT 'shuffle',
    "fallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fallbackAutoEnroll" BOOLEAN NOT NULL DEFAULT true,
    "autoRecordEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoPublishBroadcast" BOOLEAN NOT NULL DEFAULT true,
    "activeFallbackCollectionId" TEXT,
    "announcementsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "profileBackgroundClipId" TEXT,
    "totalLiveHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalListenerHours" BIGINT NOT NULL DEFAULT 0,
    "listenerPeak" INTEGER NOT NULL DEFAULT 0,
    "totalPlays" INTEGER NOT NULL DEFAULT 0,
    "goneLiveAt" TIMESTAMP(3),
    "metaStreamOptOut" BOOLEAN NOT NULL DEFAULT false,
    "chatSubscribersOnly" BOOLEAN NOT NULL DEFAULT false,
    "greenRoomDefaultEnabled" BOOLEAN NOT NULL DEFAULT false,
    "greenRoomDefaultInvitePool" "channel"."GreenRoomInvitePool" NOT NULL DEFAULT 'MODERATORS_AND_SUBS',
    "galleryMode" "channel"."ChannelGalleryMode" NOT NULL DEFAULT 'NONE',
    "slideshowImages" TEXT[],
    "textLayerMode" "channel"."ChannelTextLayerMode" NOT NULL DEFAULT 'NONE',
    "textLayerText" TEXT NOT NULL DEFAULT '',
    "textLayerAlign" "channel"."ChannelTextLayerAlign" NOT NULL DEFAULT 'CENTER',
    "videoBackgroundUrl" TEXT,
    "colorSchemeJson" TEXT,
    "visualPreset" "channel"."VisualPreset" NOT NULL DEFAULT 'MINIMAL',
    "visualSettingsJson" TEXT,
    "headerStyle" "channel"."ChannelHeaderStyle" NOT NULL DEFAULT 'GRADIENT',
    "brandAccentPreset" TEXT,
    "slideshowPreset" "channel"."SlideshowPreset" NOT NULL DEFAULT 'FADE',
    "slideshowIntervalSeconds" INTEGER NOT NULL DEFAULT 8,
    "slideshowTransitionMs" INTEGER NOT NULL DEFAULT 600,
    "slideshowAutoplay" BOOLEAN NOT NULL DEFAULT true,
    "usePlayerGradient" BOOLEAN NOT NULL DEFAULT false,
    "playerColorSchemeJson" TEXT,
    "useBackgroundGradient" BOOLEAN NOT NULL DEFAULT false,
    "backgroundColorSchemeJson" TEXT,
    "backgroundVisualPreset" TEXT,
    "nowPlayingOverlayStyle" TEXT,
    "nowPlayingOverlaySettingsJson" TEXT,
    "playerOverlayMode" "channel"."ChannelTextLayerMode" NOT NULL DEFAULT 'NONE',
    "playerOverlayText" TEXT NOT NULL DEFAULT '',
    "playerOverlayAlign" "channel"."ChannelTextLayerAlign" NOT NULL DEFAULT 'CENTER',
    "channelLinksJson" TEXT,
    "nextBroadcastAt" TIMESTAMP(3),
    "nextBroadcastNote" TEXT,
    "lastFeaturedAt" TIMESTAMP(3),
    "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pressKitGalleryPublic" BOOLEAN NOT NULL DEFAULT false,
    "storeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "liveInputOverrideSlug" TEXT,
    "nowPlayingTitle" TEXT,
    "nowPlayingArtistName" TEXT,
    "nowPlayingArtistUsername" TEXT,
    "nowPlayingArtworkUrl" TEXT,
    "nowPlayingDurationSec" INTEGER,
    "nowPlayingUpdatedAt" TIMESTAMP(3),
    "streamOverlayTitle" TEXT,
    "streamOverlaySubtitle" TEXT,
    "streamOverlayShowTitle" BOOLEAN NOT NULL DEFAULT false,
    "streamOverlayTextColor" TEXT,
    "streamOverlayScrimEnabled" BOOLEAN NOT NULL DEFAULT false,
    "streamOverlayCoverUrl" TEXT,
    "streamOverlayBackdropUrl" TEXT,
    "streamOverlayVisualPreset" "channel"."VisualPreset" NOT NULL DEFAULT 'MINIMAL',
    "topBarText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."ChannelSlugRedirect" (
    "id" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelSlugRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."ChannelVisualPreset" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelVisualPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."ChannelMember" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "pictureUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."PressKitImage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "title" TEXT,
    "position" INTEGER NOT NULL,
    "includeInZip" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PressKitImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."RadioSlotBooking" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "showType" "channel"."BroadcastShowType" NOT NULL DEFAULT 'LIVE_SET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioSlotBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."RadioFeatureLog" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "featuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioFeatureLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."RadioPlayLog" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "soundId" TEXT,
    "title" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "artistUsername" TEXT,
    "artworkUrl" TEXT,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioPlayLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."Broadcast" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "source" "channel"."BroadcastSource" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wentLiveAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "recordingKey" TEXT,
    "soundId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "showType" "channel"."BroadcastShowType" NOT NULL DEFAULT 'LIVE_SET',
    "episodeNumber" INTEGER,
    "tagline" TEXT,
    "artworkUrl" TEXT,
    "radioSlotBookingId" TEXT,
    "scheduledLiveShowId" TEXT,
    "visibility" "channel"."BroadcastVisibility" NOT NULL DEFAULT 'PUBLIC',
    "autoPublish" BOOLEAN NOT NULL DEFAULT true,
    "greenRoomEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."LiveShowSeries" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tagline" TEXT,
    "artworkUrl" TEXT,
    "showType" "channel"."BroadcastShowType" NOT NULL DEFAULT 'LIVE_SET',
    "visibility" "channel"."BroadcastVisibility" NOT NULL DEFAULT 'PUBLIC',
    "autoPublish" BOOLEAN NOT NULL DEFAULT true,
    "episodeNumberEnabled" BOOLEAN NOT NULL DEFAULT true,
    "nextEpisodeNumber" INTEGER NOT NULL DEFAULT 1,
    "intervalHours" INTEGER NOT NULL DEFAULT 1,
    "scheduleNote" TEXT,
    "recurrenceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "recurrenceTimeOfDay" TEXT,
    "recurrenceDurationMin" INTEGER,
    "recurrenceTimezone" TEXT,
    "recurrenceHorizonDays" INTEGER NOT NULL DEFAULT 28,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveShowSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."LiveShowEpisode" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeNumber" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "artworkUrl" TEXT,
    "status" "channel"."LiveShowEpisodeStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "channel"."SoundSource" NOT NULL DEFAULT 'UPLOAD',
    "soundId" TEXT,
    "radioSlotBookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveShowEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."ScheduledLiveShow" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "episodeNumber" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tagline" TEXT,
    "venue" TEXT,
    "location" TEXT,
    "artworkUrl" TEXT,
    "showType" "channel"."BroadcastShowType" NOT NULL,
    "visibility" "channel"."BroadcastVisibility" NOT NULL,
    "autoPublish" BOOLEAN NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledLiveShow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."AccountRestriction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "core"."AccountRestrictionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),
    "bannedById" TEXT,

    CONSTRAINT "AccountRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."MissedLiveShowFlag" (
    "id" BIGSERIAL NOT NULL,
    "scheduledLiveShowId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "admin"."ContentReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MissedLiveShowFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."BroadcastGreenRoomInvite" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "channel"."GreenRoomInviteSource" NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),

    CONSTRAINT "BroadcastGreenRoomInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."ChannelAnnouncement" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."RtmpTarget" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "provider" "channel"."RtmpTargetProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "rtmpUrl" TEXT NOT NULL,
    "streamKeyEnc" TEXT NOT NULL,
    "alwaysMirror" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RtmpTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."Sound" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistName" TEXT,
    "credits" JSONB,
    "description" TEXT,
    "tracklist" JSONB,
    "editList" JSONB,
    "editorPeaks" JSONB,
    "bannerUrl" TEXT,
    "backgroundUrl" TEXT,
    "slideshowUrls" TEXT[],
    "galleryMode" "channel"."ChannelGalleryMode" NOT NULL DEFAULT 'NONE',
    "galleryAudioReactive" BOOLEAN NOT NULL DEFAULT false,
    "commentary" TEXT,
    "taggedNote" TEXT,
    "genre" TEXT,
    "genreCustom" TEXT,
    "recordingLocation" TEXT,
    "venueId" TEXT,
    "subGenres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contentType" "channel"."SoundContentType" NOT NULL DEFAULT 'TRACK',
    "mixVersion" TEXT,
    "bpm" INTEGER,
    "musicalKey" TEXT,
    "bpmDetected" INTEGER,
    "keyDetected" TEXT,
    "useDetectedBpmKey" BOOLEAN NOT NULL DEFAULT true,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "license" "channel"."SoundLicense" NOT NULL DEFAULT 'ALL_RIGHTS_RESERVED',
    "repostToDownload" BOOLEAN NOT NULL DEFAULT false,
    "followToDownload" BOOLEAN NOT NULL DEFAULT false,
    "mediaKind" "channel"."SoundMediaKind" NOT NULL DEFAULT 'AUDIO',
    "imageKey" TEXT,
    "videoKey" TEXT,
    "rawKey" TEXT,
    "mp3Key" TEXT,
    "flacKey" TEXT,
    "durationSec" INTEGER,
    "sourceFormat" TEXT,
    "sourceBitrateKbps" INTEGER,
    "sourceSampleRateHz" INTEGER,
    "sourceBitDepth" INTEGER,
    "sourceChannels" INTEGER,
    "peaks" JSONB,
    "visualPreset" "channel"."VisualPreset" NOT NULL DEFAULT 'MINIMAL',
    "paletteJson" TEXT,
    "colorSchemeJson" TEXT,
    "accessMode" "channel"."TrackAccessMode" NOT NULL DEFAULT 'FREE',
    "purchaseTierId" TEXT,
    "pinnedAt" TIMESTAMP(3),
    "trackOrder" INTEGER NOT NULL DEFAULT 0,
    "fileSizeBytes" BIGINT,
    "source" "channel"."SoundSource" NOT NULL DEFAULT 'UPLOAD',
    "qualityBadge" "channel"."SoundQualityBadge" NOT NULL DEFAULT 'LOSSLESS',
    "embedUri" TEXT,
    "embedProvider" "channel"."SoundEmbedProvider",
    "status" "channel"."SoundStatus" NOT NULL DEFAULT 'PENDING',
    "streamingCopyStatus" "channel"."StreamingCopyStatus" NOT NULL DEFAULT 'NOT_NEEDED',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "fallbackOrder" INTEGER,
    "lastFallbackPlayedAt" TIMESTAMP(3),
    "selectsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "topListsEligible" BOOLEAN NOT NULL DEFAULT true,
    "hearthisExportId" TEXT,
    "hearthisExportStatus" TEXT,
    "hearthisExportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."SoundStemJob" (
    "id" TEXT NOT NULL,
    "soundId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "stemSet" "channel"."StemSet" NOT NULL,
    "status" "channel"."StemJobStatus" NOT NULL DEFAULT 'PENDING',
    "vocalsKey" TEXT,
    "instrumentalKey" TEXT,
    "drumsKey" TEXT,
    "bassKey" TEXT,
    "otherKey" TEXT,
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoundStemJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."AnnouncementClip" (
    "id" TEXT NOT NULL,
    "channelId" TEXT,
    "title" TEXT NOT NULL,
    "audioKey" TEXT NOT NULL,
    "originalAudioKey" TEXT NOT NULL,
    "durationSec" INTEGER,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scheduleMode" "channel"."AnnouncementScheduleMode" NOT NULL DEFAULT 'RANDOM',
    "everyNth" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "renderStatus" "channel"."AnnouncementRenderStatus" NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementClip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."AnnouncementSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "systemEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."SoundVersion" (
    "id" TEXT NOT NULL,
    "soundId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "rawKey" TEXT NOT NULL,
    "mp3Key" TEXT,
    "flacKey" TEXT,
    "durationSec" INTEGER,
    "sourceFormat" TEXT,
    "sourceBitrateKbps" INTEGER,
    "sourceSampleRateHz" INTEGER,
    "sourceBitDepth" INTEGER,
    "sourceChannels" INTEGER,
    "peaks" JSONB,
    "fileSizeBytes" BIGINT NOT NULL DEFAULT 0,
    "status" "channel"."SoundStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoundVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."CuratedRotationItem" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "soundId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuratedRotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."RadioTrackSubmissionBatch" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioTrackSubmissionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."RadioTrackSubmissionItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "soundId" TEXT NOT NULL,
    "positionInBatch" INTEGER NOT NULL,
    "status" "channel"."RadioSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioTrackSubmissionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat"."ChatBan" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat"."ChatMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "fanOnly" BOOLEAN NOT NULL DEFAULT false,
    "handle" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "userId" TEXT,
    "supporter" BOOLEAN NOT NULL DEFAULT false,
    "channelRole" TEXT,
    "countryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat"."ChannelModerator" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelModerator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger"."LedgerEntry" (
    "id" BIGSERIAL NOT NULL,
    "category" "ledger"."LedgerCategory" NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT NOT NULL,
    "externalRef" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger"."MonthlyRollup" (
    "yearMonth" TEXT NOT NULL,
    "byCategory" JSONB NOT NULL,
    "surplus" BIGINT NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyRollup_pkey" PRIMARY KEY ("yearMonth")
);

-- CreateTable
CREATE TABLE "ledger"."GrantDisbursement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "forYear" INTEGER NOT NULL,
    "units" INTEGER NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "state" "ledger"."GrantState" NOT NULL DEFAULT 'PENDING',
    "payoutMethod" TEXT,
    "payoutRef" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "publishedAs" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrantDisbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "action" "governance"."AuditAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."Motion" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "advisory" BOOLEAN NOT NULL DEFAULT true,
    "openAt" TIMESTAMP(3) NOT NULL,
    "closeAt" TIMESTAMP(3) NOT NULL,
    "state" "governance"."MotionState" NOT NULL DEFAULT 'DRAFT',
    "eligibleMemberCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Motion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."GovernanceMeeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "governance"."GovernanceMeetingType" NOT NULL,
    "state" "governance"."GovernanceMeetingState" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "location" TEXT,
    "remoteUrl" TEXT,
    "noticeAt" TIMESTAMP(3),
    "agenda" JSONB,
    "eligibleMemberCount" INTEGER,
    "quorumRequired" INTEGER,
    "chairName" TEXT,
    "secretaryName" TEXT,
    "minutesKey" TEXT,
    "minutesApprovedAt" TIMESTAMP(3),
    "minutesSignedByName" TEXT,
    "minutesSignedAt" TIMESTAMP(3),
    "minutesRedacted" BOOLEAN NOT NULL DEFAULT false,
    "minutesPublishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."GovernanceNoticeDelivery" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bouncedAt" TIMESTAMP(3),

    CONSTRAINT "GovernanceNoticeDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."GovernanceAttendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT,
    "displayName" TEXT NOT NULL,
    "status" "governance"."GovernanceAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."GovernanceConflictDeclaration" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT,
    "displayName" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "recused" BOOLEAN NOT NULL DEFAULT true,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceConflictDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."GovernanceDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "governance"."GovernanceDocumentType" NOT NULL,
    "description" TEXT,
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "meetingId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."Vote" (
    "motionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" "governance"."VoteChoice" NOT NULL,
    "castAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("motionId","userId")
);

-- CreateTable
CREATE TABLE "governance"."MotionComment" (
    "id" BIGSERIAL NOT NULL,
    "motionId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."FeatureRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "status" "governance"."FeatureRequestStatus" NOT NULL DEFAULT 'OPEN',
    "mergedIntoId" TEXT,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "votedInYear" INTEGER,
    "votedInQuarter" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."FeatureRequestVote" (
    "featureRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureRequestVote_pkey" PRIMARY KEY ("featureRequestId","userId")
);

-- CreateTable
CREATE TABLE "governance"."FeatureRequestComment" (
    "id" BIGSERIAL NOT NULL,
    "featureRequestId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."Download" (
    "id" BIGSERIAL NOT NULL,
    "channelId" TEXT NOT NULL,
    "soundId" TEXT,
    "releaseTrackId" TEXT,
    "format" TEXT NOT NULL,
    "byUserId" TEXT,
    "byFingerprint" TEXT NOT NULL,
    "byIpHash" TEXT NOT NULL,
    "countryCode" TEXT,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "countedAt" TIMESTAMP(3),
    "reason" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Download_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."ListenSession" (
    "id" BIGSERIAL NOT NULL,
    "channelId" TEXT NOT NULL,
    "soundId" TEXT,
    "byUserId" TEXT,
    "byFingerprint" TEXT NOT NULL,
    "byIpHash" TEXT NOT NULL,
    "countryCode" TEXT,
    "source" "engagement"."ListenSource" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ListenSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."ArtistFollow" (
    "followerUserId" TEXT NOT NULL,
    "artistUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistFollow_pkey" PRIMARY KEY ("followerUserId","artistUserId")
);

-- CreateTable
CREATE TABLE "engagement"."SoundLike" (
    "userId" TEXT NOT NULL,
    "soundId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoundLike_pkey" PRIMARY KEY ("userId","soundId")
);

-- CreateTable
CREATE TABLE "engagement"."SoundRepost" (
    "userId" TEXT NOT NULL,
    "soundId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoundRepost_pkey" PRIMARY KEY ("userId","soundId")
);

-- CreateTable
CREATE TABLE "engagement"."TrackReaction" (
    "id" TEXT NOT NULL,
    "soundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "engagement"."TrackReactionType" NOT NULL,
    "positionSec" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."BroadcastReaction" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "elapsedSec" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."ListenEvent" (
    "id" TEXT NOT NULL,
    "soundId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "dayBucket" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListenEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."Conversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."Comment" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "soundId" TEXT,
    "channelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."SoundRepostAck" (
    "id" TEXT NOT NULL,
    "soundId" TEXT NOT NULL,
    "byUserId" TEXT,
    "byFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoundRepostAck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fansubs"."FanTier" (
    "id" TEXT NOT NULL,
    "artistUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT,
    "perks" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fansubs"."FanSubscription" (
    "id" TEXT NOT NULL,
    "artistUserId" TEXT NOT NULL,
    "subscriberUserId" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "state" "fansubs"."FanSubState" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FanSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fansubs"."FanSubPayout" (
    "id" TEXT NOT NULL,
    "fanSubscriptionId" TEXT NOT NULL,
    "artistUserId" TEXT NOT NULL,
    "forPeriodStart" TIMESTAMP(3) NOT NULL,
    "forPeriodEnd" TIMESTAMP(3) NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "stripeFeeCents" INTEGER NOT NULL,
    "orgFeeCents" INTEGER NOT NULL,
    "netToArtistCents" INTEGER NOT NULL,
    "stripeTransferId" TEXT,
    "state" "fansubs"."FanSubPayoutState" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FanSubPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fansubs"."PurchaseTier" (
    "id" TEXT NOT NULL,
    "artistUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "priceOptional" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fansubs"."Purchase" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "artistUserId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "state" "fansubs"."PurchaseState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release"."Release" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "release"."ReleaseType" NOT NULL,
    "artworkUrl" TEXT,
    "artworkKey" TEXT,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "genre" TEXT,
    "genreCustom" TEXT,
    "smartLinkSlug" TEXT NOT NULL,
    "smartLinkTargets" JSONB,
    "smartLinkViewCount" INTEGER NOT NULL DEFAULT 0,
    "showPoweredByFooter" BOOLEAN NOT NULL DEFAULT false,
    "state" "release"."ReleaseState" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "commentary" TEXT,
    "revelatorId" TEXT,
    "revelatorStatus" TEXT,
    "distributionFeeCents" INTEGER,
    "distributionPaidAt" TIMESTAMP(3),
    "distributionStripeSessionId" TEXT,
    "upc" TEXT,
    "musicbrainzReleaseId" TEXT,
    "musicbrainzArtistId" TEXT,
    "discogsReleaseId" TEXT,
    "pLine" TEXT,
    "cLine" TEXT,
    "labelImprint" TEXT,
    "credits" JSONB,
    "paletteJson" TEXT,
    "colorSchemeJson" TEXT,
    "visualPreset" "channel"."VisualPreset" NOT NULL DEFAULT 'MINIMAL',
    "slideshowImages" TEXT[],
    "galleryMode" "channel"."ChannelGalleryMode" NOT NULL DEFAULT 'NONE',
    "galleryAudioReactive" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release"."SmartLinkClick" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "referer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartLinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release"."RevelatorRoyaltyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "revelatorId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "streams" INTEGER,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevelatorRoyaltyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release"."ReleaseTrack" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isrc" TEXT,
    "musicbrainzRecordingId" TEXT,
    "durationSec" INTEGER,
    "soundId" TEXT,
    "genre" TEXT,
    "genreCustom" TEXT,
    "subGenres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bpm" INTEGER,
    "musicalKey" TEXT,
    "mixVersion" TEXT,
    "credits" JSONB,
    "sourceKey" TEXT,
    "sourceFormat" TEXT,
    "sourceSampleRate" INTEGER,
    "sourceBitDepth" INTEGER,
    "streamKey" TEXT,
    "flacKey" TEXT,
    "peaks" JSONB,
    "fingerprint" TEXT,
    "fingerprintMatch" JSONB,
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "status" "release"."TrackStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "r2Key" TEXT,
    "r2SizeBytes" INTEGER,

    CONSTRAINT "ReleaseTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release"."ReleaseTrackVersion" (
    "id" TEXT NOT NULL,
    "releaseTrackId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceFormat" TEXT,
    "sourceSampleRate" INTEGER,
    "sourceBitDepth" INTEGER,
    "streamKey" TEXT,
    "flacKey" TEXT,
    "durationSec" INTEGER,
    "status" "release"."TrackStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "r2Key" TEXT,
    "r2SizeBytes" INTEGER,

    CONSTRAINT "ReleaseTrackVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release"."MixUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "soundId" TEXT NOT NULL,
    "mixcloudUrl" TEXT,
    "mixcloudKey" TEXT,
    "status" "release"."MixUploadStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MixUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter"."NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "artistUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "confirmToken" TEXT,
    "unsubToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter"."NewsletterDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyMd" TEXT NOT NULL,
    "state" "newsletter"."NewsletterDraftState" NOT NULL DEFAULT 'DRAFT',
    "subscribersOnly" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter"."NewsletterSend" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "state" "newsletter"."NewsletterSendState" NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue"."Venue" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'FI',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "capacity" INTEGER,
    "description" TEXT,
    "externalLinks" JSONB,
    "photos" TEXT[],
    "verifiedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue"."VenueBroadcast" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "artistUserId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "description" TEXT,
    "channelId" TEXT,
    "state" "venue"."VenueBroadcastState" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "core"."NotificationType" NOT NULL,
    "actorUserId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "url" TEXT,
    "readAt" TIMESTAMP(3),
    "sticky" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Mention" (
    "id" TEXT NOT NULL,
    "mentionerUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "surface" "core"."MentionSurface" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."MentionMute" (
    "muterId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentionMute_pkey" PRIMARY KEY ("muterId","targetUserId")
);

-- CreateTable
CREATE TABLE "media"."Collection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "media"."CollectionType" NOT NULL DEFAULT 'CUSTOM',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "collaborative" BOOLEAN NOT NULL DEFAULT false,
    "coverUrl" TEXT,
    "coverKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "style" "media"."CollectionStyle" NOT NULL DEFAULT 'PLAYLIST',
    "visibility" "media"."CollectionVisibility" NOT NULL DEFAULT 'PUBLIC',
    "coverMode" "media"."CollectionCoverMode" NOT NULL DEFAULT 'AUTO',
    "publicProfileOrder" INTEGER NOT NULL DEFAULT 0,
    "scheduledPublishAt" TIMESTAMP(3),
    "smartLinksJson" JSONB,
    "trackSortMode" "media"."CollectionTrackSortMode" NOT NULL DEFAULT 'MANUAL',
    "galleryMode" "media"."CollectionGalleryMode" NOT NULL DEFAULT 'NONE',
    "slideshowImages" TEXT[],
    "videoBackgroundUrl" TEXT,
    "textLayerMode" "media"."CollectionTextLayerMode" NOT NULL DEFAULT 'NONE',
    "textLayerText" TEXT NOT NULL DEFAULT '',
    "textLayerAlign" "media"."CollectionTextLayerAlign" NOT NULL DEFAULT 'CENTER',
    "paletteJson" TEXT,
    "colorSchemeJson" TEXT,
    "visualPreset" "channel"."VisualPreset" NOT NULL DEFAULT 'MINIMAL',

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "soundId" TEXT,
    "releaseId" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedByUserId" TEXT,
    "addNote" TEXT,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."JamSession" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "collectionId" TEXT,
    "code" TEXT NOT NULL,
    "isPlaying" BOOLEAN NOT NULL DEFAULT false,
    "currentTrackJson" JSONB,
    "positionSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "JamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement"."JamParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "engagement"."JamParticipantRole" NOT NULL DEFAULT 'GUEST',
    "canControl" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "JamParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."CollectionSubscription" (
    "userId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionSubscription_pkey" PRIMARY KEY ("userId","collectionId")
);

-- CreateTable
CREATE TABLE "admin"."CronRun" (
    "id" BIGSERIAL NOT NULL,
    "jobName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "outcome" "admin"."CronOutcome",
    "errorMessage" TEXT,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."ContentReport" (
    "id" BIGSERIAL NOT NULL,
    "targetType" "admin"."ContentReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "admin"."ContentReportReason" NOT NULL,
    "details" TEXT,
    "reporterIpHash" TEXT NOT NULL,
    "status" "admin"."ContentReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."SupportTicket" (
    "id" BIGSERIAL NOT NULL,
    "artistId" TEXT,
    "contactEmail" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" "admin"."SupportCategory" NOT NULL,
    "status" "admin"."SupportStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."SupportTicketNote" (
    "id" BIGSERIAL NOT NULL,
    "ticketId" BIGINT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" "admin"."SupportTicketNoteKind" NOT NULL DEFAULT 'MESSAGE',
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."BoardResolution" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL,
    "outcome" "admin"."ResolutionOutcome" NOT NULL,
    "voteFor" INTEGER NOT NULL,
    "voteAgainst" INTEGER NOT NULL,
    "voteAbstain" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meetingId" TEXT,
    "binding" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BoardResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."AnnualReport" (
    "id" BIGSERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,

    CONSTRAINT "AnnualReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."FeatureRequestQuarterlyReport" (
    "id" BIGSERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,

    CONSTRAINT "FeatureRequestQuarterlyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."NewsPost" (
    "id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."DiscordBotSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "clientId" TEXT NOT NULL,
    "tokenEnc" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "DiscordBotSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Addon" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "scope" "core"."AddonScope" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorUserId" TEXT,
    "categories" TEXT[],
    "iconUrl" TEXT,
    "currentVersion" TEXT NOT NULL,
    "bundleKey" TEXT NOT NULL,
    "bundleHash" TEXT NOT NULL,
    "bundleSizeBytes" INTEGER NOT NULL,
    "permissionsJson" JSONB NOT NULL DEFAULT '{}',
    "status" "core"."AddonStatus" NOT NULL DEFAULT 'DRAFT',
    "moderationNote" TEXT,
    "defaultConfigJson" JSONB,
    "enabledByDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Addon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."AddonVersion" (
    "id" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "bundleKey" TEXT NOT NULL,
    "bundleHash" TEXT NOT NULL,
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddonVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."AddonInstall" (
    "id" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "listenerUserId" TEXT,
    "channelId" TEXT,
    "adminSurface" TEXT,
    "pinnedVersion" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddonInstall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."ChannelBlock" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "type" "core"."ChannelBlockType" NOT NULL,
    "width" "core"."ChannelBlockWidth" NOT NULL DEFAULT 'FULL',
    "position" INTEGER NOT NULL DEFAULT 0,
    "configJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."InternetRadioPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genre" TEXT,
    "description" TEXT,
    "iconUrl" TEXT,
    "programmingUrl" TEXT,
    "streamUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternetRadioPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."InternetRadioStation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "presetId" TEXT,
    "name" TEXT NOT NULL,
    "genre" TEXT,
    "description" TEXT,
    "iconUrl" TEXT,
    "programmingUrl" TEXT,
    "streamUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternetRadioStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."Theme" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "varsJson" JSONB NOT NULL,
    "darkJson" JSONB NOT NULL,
    "visibility" "core"."ThemeVisibility" NOT NULL DEFAULT 'PRIVATE',
    "moderationNote" TEXT,
    "prStatus" "core"."ThemePrStatus" NOT NULL DEFAULT 'NONE',
    "prUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CloudImportJob_soundId_key" ON "core"."CloudImportJob"("soundId");

-- CreateIndex
CREATE INDEX "CloudImportJob_userId_queuedAt_idx" ON "core"."CloudImportJob"("userId", "queuedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "core"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "core"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_memberNumber_key" ON "core"."User"("memberNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeMembershipSubscriptionId_key" ON "core"."User"("stripeMembershipSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeConnectAccountId_key" ON "core"."User"("stripeConnectAccountId");

-- CreateIndex
CREATE INDEX "ArtistEvent_userId_startAt_idx" ON "core"."ArtistEvent"("userId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserStorageQuota_userId_key" ON "core"."UserStorageQuota"("userId");

-- CreateIndex
CREATE INDEX "ArtistPost_userId_createdAt_idx" ON "core"."ArtistPost"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ArtistPost_userId_publishAt_idx" ON "core"."ArtistPost"("userId", "publishAt" DESC);

-- CreateIndex
CREATE INDEX "ArtistPost_notifiedAt_publishAt_idx" ON "core"."ArtistPost"("notifiedAt", "publishAt");

-- CreateIndex
CREATE INDEX "ArtistEmbed_userId_createdAt_idx" ON "core"."ArtistEmbed"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "EditorProject_userId_updatedAt_idx" ON "core"."EditorProject"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "BetaApplication_userId_key" ON "core"."BetaApplication"("userId");

-- CreateIndex
CREATE INDEX "BetaApplication_email_idx" ON "core"."BetaApplication"("email");

-- CreateIndex
CREATE INDEX "BetaApplication_status_createdAt_idx" ON "core"."BetaApplication"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordSetup_token_key" ON "core"."PasswordSetup"("token");

-- CreateIndex
CREATE INDEX "PasswordSetup_token_idx" ON "core"."PasswordSetup"("token");

-- CreateIndex
CREATE INDEX "PasswordSetup_userId_idx" ON "core"."PasswordSetup"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialConnection_userId_platform_key" ON "core"."SocialConnection"("userId", "platform");

-- CreateIndex
CREATE INDEX "SocialPost_userId_createdAt_idx" ON "core"."SocialPost"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "core"."Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "core"."ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiToken_userId_idx" ON "core"."ApiToken"("userId");

-- CreateIndex
CREATE INDEX "TotpBackupCode_userId_idx" ON "core"."TotpBackupCode"("userId");

-- CreateIndex
CREATE INDEX "TotpChallenge_userId_idx" ON "core"."TotpChallenge"("userId");

-- CreateIndex
CREATE INDEX "IntegrationCredential_userId_idx" ON "core"."IntegrationCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationCredential_userId_providerSlug_key" ON "core"."IntegrationCredential"("userId", "providerSlug");

-- CreateIndex
CREATE INDEX "StashFile_userId_createdAt_idx" ON "core"."StashFile"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "StashShare_token_key" ON "core"."StashShare"("token");

-- CreateIndex
CREATE INDEX "StashShare_token_idx" ON "core"."StashShare"("token");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_token_key" ON "core"."EmailVerification"("token");

-- CreateIndex
CREATE INDEX "EmailVerification_token_idx" ON "core"."EmailVerification"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_key" ON "core"."Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_userId_key" ON "channel"."Channel"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_slug_key" ON "channel"."Channel"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_profileBackgroundClipId_key" ON "channel"."Channel"("profileBackgroundClipId");

-- CreateIndex
CREATE INDEX "Channel_state_idx" ON "channel"."Channel"("state");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelSlugRedirect_oldSlug_key" ON "channel"."ChannelSlugRedirect"("oldSlug");

-- CreateIndex
CREATE INDEX "ChannelSlugRedirect_channelId_idx" ON "channel"."ChannelSlugRedirect"("channelId");

-- CreateIndex
CREATE INDEX "ChannelVisualPreset_channelId_idx" ON "channel"."ChannelVisualPreset"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelVisualPreset_channelId_name_key" ON "channel"."ChannelVisualPreset"("channelId", "name");

-- CreateIndex
CREATE INDEX "ChannelMember_channelId_position_idx" ON "channel"."ChannelMember"("channelId", "position");

-- CreateIndex
CREATE INDEX "PressKitImage_channelId_position_idx" ON "channel"."PressKitImage"("channelId", "position");

-- CreateIndex
CREATE INDEX "RadioSlotBooking_startAt_endAt_idx" ON "channel"."RadioSlotBooking"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "RadioSlotBooking_channelId_startAt_idx" ON "channel"."RadioSlotBooking"("channelId", "startAt");

-- CreateIndex
CREATE INDEX "RadioFeatureLog_featuredAt_idx" ON "channel"."RadioFeatureLog"("featuredAt" DESC);

-- CreateIndex
CREATE INDEX "RadioPlayLog_channelId_playedAt_idx" ON "channel"."RadioPlayLog"("channelId", "playedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Broadcast_soundId_key" ON "channel"."Broadcast"("soundId");

-- CreateIndex
CREATE UNIQUE INDEX "Broadcast_scheduledLiveShowId_key" ON "channel"."Broadcast"("scheduledLiveShowId");

-- CreateIndex
CREATE INDEX "Broadcast_channelId_startedAt_idx" ON "channel"."Broadcast"("channelId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "Broadcast_radioSlotBookingId_idx" ON "channel"."Broadcast"("radioSlotBookingId");

-- CreateIndex
CREATE INDEX "LiveShowSeries_channelId_createdAt_idx" ON "channel"."LiveShowSeries"("channelId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LiveShowEpisode_seriesId_episodeNumber_idx" ON "channel"."LiveShowEpisode"("seriesId", "episodeNumber" DESC);

-- CreateIndex
CREATE INDEX "LiveShowEpisode_channelId_createdAt_idx" ON "channel"."LiveShowEpisode"("channelId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ScheduledLiveShow_channelId_startAt_idx" ON "channel"."ScheduledLiveShow"("channelId", "startAt");

-- CreateIndex
CREATE INDEX "ScheduledLiveShow_seriesId_startAt_idx" ON "channel"."ScheduledLiveShow"("seriesId", "startAt");

-- CreateIndex
CREATE INDEX "AccountRestriction_userId_type_expiresAt_idx" ON "core"."AccountRestriction"("userId", "type", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MissedLiveShowFlag_scheduledLiveShowId_key" ON "admin"."MissedLiveShowFlag"("scheduledLiveShowId");

-- CreateIndex
CREATE INDEX "MissedLiveShowFlag_status_detectedAt_idx" ON "admin"."MissedLiveShowFlag"("status", "detectedAt" DESC);

-- CreateIndex
CREATE INDEX "BroadcastGreenRoomInvite_broadcastId_idx" ON "channel"."BroadcastGreenRoomInvite"("broadcastId");

-- CreateIndex
CREATE INDEX "BroadcastGreenRoomInvite_userId_idx" ON "channel"."BroadcastGreenRoomInvite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastGreenRoomInvite_broadcastId_userId_key" ON "channel"."BroadcastGreenRoomInvite"("broadcastId", "userId");

-- CreateIndex
CREATE INDEX "ChannelAnnouncement_channelId_createdAt_idx" ON "channel"."ChannelAnnouncement"("channelId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RtmpTarget_channelId_idx" ON "channel"."RtmpTarget"("channelId");

-- CreateIndex
CREATE INDEX "Sound_channelId_createdAt_idx" ON "channel"."Sound"("channelId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Sound_channelId_isPublic_status_idx" ON "channel"."Sound"("channelId", "isPublic", "status");

-- CreateIndex
CREATE INDEX "Sound_purchaseTierId_idx" ON "channel"."Sound"("purchaseTierId");

-- CreateIndex
CREATE INDEX "SoundStemJob_expiresAt_idx" ON "channel"."SoundStemJob"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SoundStemJob_soundId_stemSet_key" ON "channel"."SoundStemJob"("soundId", "stemSet");

-- CreateIndex
CREATE INDEX "AnnouncementClip_channelId_idx" ON "channel"."AnnouncementClip"("channelId");

-- CreateIndex
CREATE INDEX "SoundVersion_soundId_createdAt_idx" ON "channel"."SoundVersion"("soundId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SoundVersion_soundId_versionNumber_key" ON "channel"."SoundVersion"("soundId", "versionNumber");

-- CreateIndex
CREATE INDEX "CuratedRotationItem_channelId_position_idx" ON "channel"."CuratedRotationItem"("channelId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CuratedRotationItem_channelId_soundId_key" ON "channel"."CuratedRotationItem"("channelId", "soundId");

-- CreateIndex
CREATE INDEX "RadioTrackSubmissionBatch_createdAt_idx" ON "channel"."RadioTrackSubmissionBatch"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "RadioTrackSubmissionBatch_submitterId_createdAt_idx" ON "channel"."RadioTrackSubmissionBatch"("submitterId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RadioTrackSubmissionItem_status_createdAt_idx" ON "channel"."RadioTrackSubmissionItem"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RadioTrackSubmissionItem_soundId_status_idx" ON "channel"."RadioTrackSubmissionItem"("soundId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RadioTrackSubmissionItem_batchId_soundId_key" ON "channel"."RadioTrackSubmissionItem"("batchId", "soundId");

-- CreateIndex
CREATE INDEX "ChatBan_channelId_bannedAt_idx" ON "chat"."ChatBan"("channelId", "bannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatBan_channelId_fingerprintHash_key" ON "chat"."ChatBan"("channelId", "fingerprintHash");

-- CreateIndex
CREATE INDEX "ChatMessage_channelId_fanOnly_createdAt_idx" ON "chat"."ChatMessage"("channelId", "fanOnly", "createdAt");

-- CreateIndex
CREATE INDEX "ChannelModerator_userId_idx" ON "chat"."ChannelModerator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelModerator_channelId_userId_key" ON "chat"."ChannelModerator"("channelId", "userId");

-- CreateIndex
CREATE INDEX "LedgerEntry_category_periodStart_idx" ON "ledger"."LedgerEntry"("category", "periodStart");

-- CreateIndex
CREATE INDEX "LedgerEntry_createdAt_idx" ON "ledger"."LedgerEntry"("createdAt");

-- CreateIndex
CREATE INDEX "GrantDisbursement_forYear_idx" ON "ledger"."GrantDisbursement"("forYear");

-- CreateIndex
CREATE UNIQUE INDEX "GrantDisbursement_userId_forYear_key" ON "ledger"."GrantDisbursement"("userId", "forYear");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "governance"."AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "governance"."AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "governance"."AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Motion_state_closeAt_idx" ON "governance"."Motion"("state", "closeAt");

-- CreateIndex
CREATE INDEX "GovernanceMeeting_type_scheduledAt_idx" ON "governance"."GovernanceMeeting"("type", "scheduledAt");

-- CreateIndex
CREATE INDEX "GovernanceMeeting_state_scheduledAt_idx" ON "governance"."GovernanceMeeting"("state", "scheduledAt");

-- CreateIndex
CREATE INDEX "GovernanceNoticeDelivery_meetingId_idx" ON "governance"."GovernanceNoticeDelivery"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceNoticeDelivery_meetingId_memberId_key" ON "governance"."GovernanceNoticeDelivery"("meetingId", "memberId");

-- CreateIndex
CREATE INDEX "GovernanceAttendance_meetingId_status_idx" ON "governance"."GovernanceAttendance"("meetingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceAttendance_meetingId_memberId_key" ON "governance"."GovernanceAttendance"("meetingId", "memberId");

-- CreateIndex
CREATE INDEX "GovernanceConflictDeclaration_meetingId_idx" ON "governance"."GovernanceConflictDeclaration"("meetingId");

-- CreateIndex
CREATE INDEX "GovernanceDocument_type_publishedAt_idx" ON "governance"."GovernanceDocument"("type", "publishedAt");

-- CreateIndex
CREATE INDEX "GovernanceDocument_meetingId_idx" ON "governance"."GovernanceDocument"("meetingId");

-- CreateIndex
CREATE INDEX "Vote_motionId_idx" ON "governance"."Vote"("motionId");

-- CreateIndex
CREATE INDEX "MotionComment_motionId_createdAt_idx" ON "governance"."MotionComment"("motionId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "FeatureRequest_status_createdAt_idx" ON "governance"."FeatureRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureRequestVote_featureRequestId_idx" ON "governance"."FeatureRequestVote"("featureRequestId");

-- CreateIndex
CREATE INDEX "FeatureRequestComment_featureRequestId_createdAt_idx" ON "governance"."FeatureRequestComment"("featureRequestId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Download_channelId_countedAt_idx" ON "engagement"."Download"("channelId", "countedAt");

-- CreateIndex
CREATE INDEX "Download_channelId_createdAt_idx" ON "engagement"."Download"("channelId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Download_byFingerprint_soundId_idx" ON "engagement"."Download"("byFingerprint", "soundId");

-- CreateIndex
CREATE INDEX "Download_soundId_createdAt_idx" ON "engagement"."Download"("soundId", "createdAt");

-- CreateIndex
CREATE INDEX "Download_byIpHash_createdAt_idx" ON "engagement"."Download"("byIpHash", "createdAt");

-- CreateIndex
CREATE INDEX "Download_countedAt_idx" ON "engagement"."Download"("countedAt");

-- CreateIndex
CREATE INDEX "ListenSession_channelId_startedAt_idx" ON "engagement"."ListenSession"("channelId", "startedAt");

-- CreateIndex
CREATE INDEX "ListenSession_soundId_startedAt_idx" ON "engagement"."ListenSession"("soundId", "startedAt");

-- CreateIndex
CREATE INDEX "ListenSession_byUserId_startedAt_idx" ON "engagement"."ListenSession"("byUserId", "startedAt");

-- CreateIndex
CREATE INDEX "ListenSession_source_startedAt_idx" ON "engagement"."ListenSession"("source", "startedAt");

-- CreateIndex
CREATE INDEX "ListenSession_countryCode_startedAt_idx" ON "engagement"."ListenSession"("countryCode", "startedAt");

-- CreateIndex
CREATE INDEX "ListenSession_byFingerprint_channelId_soundId_endedAt_idx" ON "engagement"."ListenSession"("byFingerprint", "channelId", "soundId", "endedAt");

-- CreateIndex
CREATE INDEX "ListenSession_endedAt_idx" ON "engagement"."ListenSession"("endedAt");

-- CreateIndex
CREATE INDEX "ArtistFollow_artistUserId_idx" ON "engagement"."ArtistFollow"("artistUserId");

-- CreateIndex
CREATE INDEX "SoundLike_soundId_idx" ON "engagement"."SoundLike"("soundId");

-- CreateIndex
CREATE INDEX "SoundLike_userId_createdAt_idx" ON "engagement"."SoundLike"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SoundRepost_soundId_idx" ON "engagement"."SoundRepost"("soundId");

-- CreateIndex
CREATE INDEX "TrackReaction_soundId_positionSec_idx" ON "engagement"."TrackReaction"("soundId", "positionSec");

-- CreateIndex
CREATE INDEX "BroadcastReaction_broadcastId_elapsedSec_idx" ON "engagement"."BroadcastReaction"("broadcastId", "elapsedSec");

-- CreateIndex
CREATE INDEX "ListenEvent_soundId_playedAt_idx" ON "engagement"."ListenEvent"("soundId", "playedAt");

-- CreateIndex
CREATE INDEX "ListenEvent_playedAt_idx" ON "engagement"."ListenEvent"("playedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ListenEvent_soundId_dedupeKey_dayBucket_key" ON "engagement"."ListenEvent"("soundId", "dedupeKey", "dayBucket");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "engagement"."ConversationParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "engagement"."ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "engagement"."Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_soundId_createdAt_idx" ON "engagement"."Comment"("soundId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_channelId_createdAt_idx" ON "engagement"."Comment"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "SoundRepostAck_soundId_idx" ON "engagement"."SoundRepostAck"("soundId");

-- CreateIndex
CREATE UNIQUE INDEX "SoundRepostAck_soundId_byFingerprint_key" ON "engagement"."SoundRepostAck"("soundId", "byFingerprint");

-- CreateIndex
CREATE INDEX "FanTier_artistUserId_active_idx" ON "fansubs"."FanTier"("artistUserId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FanSubscription_stripeSubscriptionId_key" ON "fansubs"."FanSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "FanSubscription_artistUserId_state_idx" ON "fansubs"."FanSubscription"("artistUserId", "state");

-- CreateIndex
CREATE INDEX "FanSubscription_subscriberUserId_state_idx" ON "fansubs"."FanSubscription"("subscriberUserId", "state");

-- CreateIndex
CREATE INDEX "FanSubscription_state_idx" ON "fansubs"."FanSubscription"("state");

-- CreateIndex
CREATE UNIQUE INDEX "FanSubscription_artistUserId_subscriberUserId_key" ON "fansubs"."FanSubscription"("artistUserId", "subscriberUserId");

-- CreateIndex
CREATE INDEX "FanSubPayout_fanSubscriptionId_forPeriodStart_idx" ON "fansubs"."FanSubPayout"("fanSubscriptionId", "forPeriodStart");

-- CreateIndex
CREATE INDEX "FanSubPayout_artistUserId_forPeriodStart_idx" ON "fansubs"."FanSubPayout"("artistUserId", "forPeriodStart");

-- CreateIndex
CREATE INDEX "FanSubPayout_artistUserId_state_paidAt_idx" ON "fansubs"."FanSubPayout"("artistUserId", "state", "paidAt");

-- CreateIndex
CREATE INDEX "FanSubPayout_state_createdAt_idx" ON "fansubs"."FanSubPayout"("state", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseTier_artistUserId_active_idx" ON "fansubs"."PurchaseTier"("artistUserId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_stripeCheckoutSessionId_key" ON "fansubs"."Purchase"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "Purchase_artistUserId_createdAt_idx" ON "fansubs"."Purchase"("artistUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Purchase_buyerUserId_tierId_idx" ON "fansubs"."Purchase"("buyerUserId", "tierId");

-- CreateIndex
CREATE UNIQUE INDEX "Release_smartLinkSlug_key" ON "release"."Release"("smartLinkSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Release_distributionStripeSessionId_key" ON "release"."Release"("distributionStripeSessionId");

-- CreateIndex
CREATE INDEX "Release_userId_releaseDate_idx" ON "release"."Release"("userId", "releaseDate");

-- CreateIndex
CREATE INDEX "Release_userId_state_idx" ON "release"."Release"("userId", "state");

-- CreateIndex
CREATE INDEX "SmartLinkClick_releaseId_platform_idx" ON "release"."SmartLinkClick"("releaseId", "platform");

-- CreateIndex
CREATE INDEX "SmartLinkClick_releaseId_createdAt_idx" ON "release"."SmartLinkClick"("releaseId", "createdAt");

-- CreateIndex
CREATE INDEX "RevelatorRoyaltyReport_userId_periodEnd_idx" ON "release"."RevelatorRoyaltyReport"("userId", "periodEnd" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RevelatorRoyaltyReport_releaseId_periodStart_periodEnd_key" ON "release"."RevelatorRoyaltyReport"("releaseId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseTrack_releaseId_position_key" ON "release"."ReleaseTrack"("releaseId", "position");

-- CreateIndex
CREATE INDEX "ReleaseTrackVersion_releaseTrackId_createdAt_idx" ON "release"."ReleaseTrackVersion"("releaseTrackId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseTrackVersion_releaseTrackId_versionNumber_key" ON "release"."ReleaseTrackVersion"("releaseTrackId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MixUpload_soundId_key" ON "release"."MixUpload"("soundId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_confirmToken_key" ON "newsletter"."NewsletterSubscriber"("confirmToken");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_unsubToken_key" ON "newsletter"."NewsletterSubscriber"("unsubToken");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_artistUserId_confirmedAt_idx" ON "newsletter"."NewsletterSubscriber"("artistUserId", "confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_artistUserId_email_key" ON "newsletter"."NewsletterSubscriber"("artistUserId", "email");

-- CreateIndex
CREATE INDEX "NewsletterDraft_userId_state_idx" ON "newsletter"."NewsletterDraft"("userId", "state");

-- CreateIndex
CREATE INDEX "NewsletterSend_draftId_state_idx" ON "newsletter"."NewsletterSend"("draftId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "venue"."Venue"("slug");

-- CreateIndex
CREATE INDEX "Venue_createdBy_idx" ON "venue"."Venue"("createdBy");

-- CreateIndex
CREATE INDEX "VenueBroadcast_venueId_startAt_idx" ON "venue"."VenueBroadcast"("venueId", "startAt");

-- CreateIndex
CREATE INDEX "VenueBroadcast_artistUserId_startAt_idx" ON "venue"."VenueBroadcast"("artistUserId", "startAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "core"."Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "core"."Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Mention_targetUserId_notifiedAt_idx" ON "core"."Mention"("targetUserId", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Mention_mentionerUserId_targetUserId_surface_sourceId_key" ON "core"."Mention"("mentionerUserId", "targetUserId", "surface", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "media"."Collection"("slug");

-- CreateIndex
CREATE INDEX "Collection_userId_isPublic_idx" ON "media"."Collection"("userId", "isPublic");

-- CreateIndex
CREATE INDEX "Collection_userId_publicProfileOrder_idx" ON "media"."Collection"("userId", "publicProfileOrder");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_position_idx" ON "media"."CollectionItem"("collectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collectionId_position_key" ON "media"."CollectionItem"("collectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "JamSession_code_key" ON "engagement"."JamSession"("code");

-- CreateIndex
CREATE INDEX "JamSession_hostUserId_idx" ON "engagement"."JamSession"("hostUserId");

-- CreateIndex
CREATE INDEX "JamParticipant_sessionId_idx" ON "engagement"."JamParticipant"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "JamParticipant_sessionId_userId_key" ON "engagement"."JamParticipant"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "CollectionSubscription_collectionId_idx" ON "media"."CollectionSubscription"("collectionId");

-- CreateIndex
CREATE INDEX "CronRun_jobName_startedAt_idx" ON "admin"."CronRun"("jobName", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "ContentReport_status_createdAt_idx" ON "admin"."ContentReport"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ContentReport_targetType_targetId_idx" ON "admin"."ContentReport"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "admin"."SupportTicket"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SupportTicketNote_ticketId_createdAt_idx" ON "admin"."SupportTicketNote"("ticketId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "BoardResolution_votedAt_idx" ON "admin"."BoardResolution"("votedAt" DESC);

-- CreateIndex
CREATE INDEX "BoardResolution_meetingId_idx" ON "admin"."BoardResolution"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnualReport_year_key" ON "admin"."AnnualReport"("year");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureRequestQuarterlyReport_year_quarter_key" ON "admin"."FeatureRequestQuarterlyReport"("year", "quarter");

-- CreateIndex
CREATE INDEX "NewsPost_publishedAt_idx" ON "admin"."NewsPost"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Addon_slug_key" ON "core"."Addon"("slug");

-- CreateIndex
CREATE INDEX "Addon_scope_status_idx" ON "core"."Addon"("scope", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AddonVersion_widgetId_version_key" ON "core"."AddonVersion"("widgetId", "version");

-- CreateIndex
CREATE INDEX "AddonInstall_listenerUserId_position_idx" ON "core"."AddonInstall"("listenerUserId", "position");

-- CreateIndex
CREATE INDEX "AddonInstall_channelId_position_idx" ON "core"."AddonInstall"("channelId", "position");

-- CreateIndex
CREATE INDEX "AddonInstall_adminSurface_position_idx" ON "core"."AddonInstall"("adminSurface", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AddonInstall_widgetId_listenerUserId_key" ON "core"."AddonInstall"("widgetId", "listenerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AddonInstall_widgetId_channelId_key" ON "core"."AddonInstall"("widgetId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "AddonInstall_widgetId_adminSurface_key" ON "core"."AddonInstall"("widgetId", "adminSurface");

-- CreateIndex
CREATE INDEX "ChannelBlock_channelId_position_idx" ON "core"."ChannelBlock"("channelId", "position");

-- CreateIndex
CREATE INDEX "InternetRadioStation_userId_position_idx" ON "core"."InternetRadioStation"("userId", "position");

-- CreateIndex
CREATE INDEX "Theme_userId_idx" ON "core"."Theme"("userId");

-- CreateIndex
CREATE INDEX "Theme_visibility_idx" ON "core"."Theme"("visibility");

-- AddForeignKey
ALTER TABLE "core"."CloudImportJob" ADD CONSTRAINT "CloudImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."CloudImportJob" ADD CONSTRAINT "CloudImportJob_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ArtistEvent" ADD CONSTRAINT "ArtistEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."UserStorageQuota" ADD CONSTRAINT "UserStorageQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ArtistPost" ADD CONSTRAINT "ArtistPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ArtistEmbed" ADD CONSTRAINT "ArtistEmbed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."EditorProject" ADD CONSTRAINT "EditorProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."BetaApplication" ADD CONSTRAINT "BetaApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."BetaApplication" ADD CONSTRAINT "BetaApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."PasswordSetup" ADD CONSTRAINT "PasswordSetup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."SocialConnection" ADD CONSTRAINT "SocialConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."SocialPost" ADD CONSTRAINT "SocialPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TotpBackupCode" ADD CONSTRAINT "TotpBackupCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."TotpChallenge" ADD CONSTRAINT "TotpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."StashFile" ADD CONSTRAINT "StashFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."StashShare" ADD CONSTRAINT "StashShare_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "core"."StashFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."Channel" ADD CONSTRAINT "Channel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."Channel" ADD CONSTRAINT "Channel_activeFallbackCollectionId_fkey" FOREIGN KEY ("activeFallbackCollectionId") REFERENCES "media"."Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."Channel" ADD CONSTRAINT "Channel_profileBackgroundClipId_fkey" FOREIGN KEY ("profileBackgroundClipId") REFERENCES "channel"."AnnouncementClip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."ChannelSlugRedirect" ADD CONSTRAINT "ChannelSlugRedirect_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."ChannelVisualPreset" ADD CONSTRAINT "ChannelVisualPreset_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."ChannelMember" ADD CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."PressKitImage" ADD CONSTRAINT "PressKitImage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."RadioSlotBooking" ADD CONSTRAINT "RadioSlotBooking_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."RadioFeatureLog" ADD CONSTRAINT "RadioFeatureLog_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."RadioPlayLog" ADD CONSTRAINT "RadioPlayLog_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."RadioPlayLog" ADD CONSTRAINT "RadioPlayLog_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."Broadcast" ADD CONSTRAINT "Broadcast_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."Broadcast" ADD CONSTRAINT "Broadcast_radioSlotBookingId_fkey" FOREIGN KEY ("radioSlotBookingId") REFERENCES "channel"."RadioSlotBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."Broadcast" ADD CONSTRAINT "Broadcast_scheduledLiveShowId_fkey" FOREIGN KEY ("scheduledLiveShowId") REFERENCES "channel"."ScheduledLiveShow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."LiveShowSeries" ADD CONSTRAINT "LiveShowSeries_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."LiveShowEpisode" ADD CONSTRAINT "LiveShowEpisode_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."LiveShowEpisode" ADD CONSTRAINT "LiveShowEpisode_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "channel"."LiveShowSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."LiveShowEpisode" ADD CONSTRAINT "LiveShowEpisode_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."LiveShowEpisode" ADD CONSTRAINT "LiveShowEpisode_radioSlotBookingId_fkey" FOREIGN KEY ("radioSlotBookingId") REFERENCES "channel"."RadioSlotBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."ScheduledLiveShow" ADD CONSTRAINT "ScheduledLiveShow_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."ScheduledLiveShow" ADD CONSTRAINT "ScheduledLiveShow_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "channel"."LiveShowSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."AccountRestriction" ADD CONSTRAINT "AccountRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."AccountRestriction" ADD CONSTRAINT "AccountRestriction_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."MissedLiveShowFlag" ADD CONSTRAINT "MissedLiveShowFlag_scheduledLiveShowId_fkey" FOREIGN KEY ("scheduledLiveShowId") REFERENCES "channel"."ScheduledLiveShow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."MissedLiveShowFlag" ADD CONSTRAINT "MissedLiveShowFlag_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."MissedLiveShowFlag" ADD CONSTRAINT "MissedLiveShowFlag_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."BroadcastGreenRoomInvite" ADD CONSTRAINT "BroadcastGreenRoomInvite_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "channel"."Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."BroadcastGreenRoomInvite" ADD CONSTRAINT "BroadcastGreenRoomInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."ChannelAnnouncement" ADD CONSTRAINT "ChannelAnnouncement_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."RtmpTarget" ADD CONSTRAINT "RtmpTarget_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."Sound" ADD CONSTRAINT "Sound_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."Sound" ADD CONSTRAINT "Sound_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venue"."Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."Sound" ADD CONSTRAINT "Sound_purchaseTierId_fkey" FOREIGN KEY ("purchaseTierId") REFERENCES "fansubs"."PurchaseTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."SoundStemJob" ADD CONSTRAINT "SoundStemJob_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."AnnouncementClip" ADD CONSTRAINT "AnnouncementClip_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."SoundVersion" ADD CONSTRAINT "SoundVersion_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."CuratedRotationItem" ADD CONSTRAINT "CuratedRotationItem_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."CuratedRotationItem" ADD CONSTRAINT "CuratedRotationItem_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."CuratedRotationItem" ADD CONSTRAINT "CuratedRotationItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."RadioTrackSubmissionBatch" ADD CONSTRAINT "RadioTrackSubmissionBatch_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."RadioTrackSubmissionBatch" ADD CONSTRAINT "RadioTrackSubmissionBatch_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."RadioTrackSubmissionItem" ADD CONSTRAINT "RadioTrackSubmissionItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "channel"."RadioTrackSubmissionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."RadioTrackSubmissionItem" ADD CONSTRAINT "RadioTrackSubmissionItem_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."RadioTrackSubmissionItem" ADD CONSTRAINT "RadioTrackSubmissionItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat"."ChatBan" ADD CONSTRAINT "ChatBan_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat"."ChatMessage" ADD CONSTRAINT "ChatMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat"."ChannelModerator" ADD CONSTRAINT "ChannelModerator_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat"."ChannelModerator" ADD CONSTRAINT "ChannelModerator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger"."GrantDisbursement" ADD CONSTRAINT "GrantDisbursement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."Motion" ADD CONSTRAINT "Motion_proposedBy_fkey" FOREIGN KEY ("proposedBy") REFERENCES "core"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."GovernanceMeeting" ADD CONSTRAINT "GovernanceMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "core"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."GovernanceNoticeDelivery" ADD CONSTRAINT "GovernanceNoticeDelivery_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."GovernanceNoticeDelivery" ADD CONSTRAINT "GovernanceNoticeDelivery_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."GovernanceAttendance" ADD CONSTRAINT "GovernanceAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."GovernanceAttendance" ADD CONSTRAINT "GovernanceAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."GovernanceConflictDeclaration" ADD CONSTRAINT "GovernanceConflictDeclaration_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."GovernanceConflictDeclaration" ADD CONSTRAINT "GovernanceConflictDeclaration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."GovernanceDocument" ADD CONSTRAINT "GovernanceDocument_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."GovernanceDocument" ADD CONSTRAINT "GovernanceDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "core"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."Vote" ADD CONSTRAINT "Vote_motionId_fkey" FOREIGN KEY ("motionId") REFERENCES "governance"."Motion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."MotionComment" ADD CONSTRAINT "MotionComment_motionId_fkey" FOREIGN KEY ("motionId") REFERENCES "governance"."Motion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."MotionComment" ADD CONSTRAINT "MotionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."FeatureRequest" ADD CONSTRAINT "FeatureRequest_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."FeatureRequest" ADD CONSTRAINT "FeatureRequest_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "governance"."FeatureRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."FeatureRequest" ADD CONSTRAINT "FeatureRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."FeatureRequestVote" ADD CONSTRAINT "FeatureRequestVote_featureRequestId_fkey" FOREIGN KEY ("featureRequestId") REFERENCES "governance"."FeatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."FeatureRequestVote" ADD CONSTRAINT "FeatureRequestVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."FeatureRequestComment" ADD CONSTRAINT "FeatureRequestComment_featureRequestId_fkey" FOREIGN KEY ("featureRequestId") REFERENCES "governance"."FeatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."FeatureRequestComment" ADD CONSTRAINT "FeatureRequestComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."ArtistFollow" ADD CONSTRAINT "ArtistFollow_followerUserId_fkey" FOREIGN KEY ("followerUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."ArtistFollow" ADD CONSTRAINT "ArtistFollow_artistUserId_fkey" FOREIGN KEY ("artistUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."SoundLike" ADD CONSTRAINT "SoundLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."SoundLike" ADD CONSTRAINT "SoundLike_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."SoundRepost" ADD CONSTRAINT "SoundRepost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."SoundRepost" ADD CONSTRAINT "SoundRepost_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."TrackReaction" ADD CONSTRAINT "TrackReaction_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."TrackReaction" ADD CONSTRAINT "TrackReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."BroadcastReaction" ADD CONSTRAINT "BroadcastReaction_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "channel"."Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."ListenEvent" ADD CONSTRAINT "ListenEvent_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "engagement"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "engagement"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."Comment" ADD CONSTRAINT "Comment_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."Comment" ADD CONSTRAINT "Comment_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fansubs"."FanTier" ADD CONSTRAINT "FanTier_artistUserId_fkey" FOREIGN KEY ("artistUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fansubs"."FanSubscription" ADD CONSTRAINT "FanSubscription_artistUserId_fkey" FOREIGN KEY ("artistUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fansubs"."FanSubscription" ADD CONSTRAINT "FanSubscription_subscriberUserId_fkey" FOREIGN KEY ("subscriberUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fansubs"."FanSubPayout" ADD CONSTRAINT "FanSubPayout_fanSubscriptionId_fkey" FOREIGN KEY ("fanSubscriptionId") REFERENCES "fansubs"."FanSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fansubs"."PurchaseTier" ADD CONSTRAINT "PurchaseTier_artistUserId_fkey" FOREIGN KEY ("artistUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fansubs"."Purchase" ADD CONSTRAINT "Purchase_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "fansubs"."PurchaseTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fansubs"."Purchase" ADD CONSTRAINT "Purchase_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release"."Release" ADD CONSTRAINT "Release_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release"."SmartLinkClick" ADD CONSTRAINT "SmartLinkClick_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "release"."Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release"."RevelatorRoyaltyReport" ADD CONSTRAINT "RevelatorRoyaltyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release"."RevelatorRoyaltyReport" ADD CONSTRAINT "RevelatorRoyaltyReport_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "release"."Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release"."ReleaseTrack" ADD CONSTRAINT "ReleaseTrack_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "release"."Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release"."ReleaseTrackVersion" ADD CONSTRAINT "ReleaseTrackVersion_releaseTrackId_fkey" FOREIGN KEY ("releaseTrackId") REFERENCES "release"."ReleaseTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release"."MixUpload" ADD CONSTRAINT "MixUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release"."MixUpload" ADD CONSTRAINT "MixUpload_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter"."NewsletterSubscriber" ADD CONSTRAINT "NewsletterSubscriber_artistUserId_fkey" FOREIGN KEY ("artistUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter"."NewsletterDraft" ADD CONSTRAINT "NewsletterDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter"."NewsletterSend" ADD CONSTRAINT "NewsletterSend_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "newsletter"."NewsletterDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter"."NewsletterSend" ADD CONSTRAINT "NewsletterSend_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "newsletter"."NewsletterSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue"."VenueBroadcast" ADD CONSTRAINT "VenueBroadcast_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venue"."Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Notification" ADD CONSTRAINT "Notification_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Mention" ADD CONSTRAINT "Mention_mentionerUserId_fkey" FOREIGN KEY ("mentionerUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Mention" ADD CONSTRAINT "Mention_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."MentionMute" ADD CONSTRAINT "MentionMute_muterId_fkey" FOREIGN KEY ("muterId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."MentionMute" ADD CONSTRAINT "MentionMute_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "media"."Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."CollectionItem" ADD CONSTRAINT "CollectionItem_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."CollectionItem" ADD CONSTRAINT "CollectionItem_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "release"."Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."CollectionItem" ADD CONSTRAINT "CollectionItem_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."JamSession" ADD CONSTRAINT "JamSession_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."JamSession" ADD CONSTRAINT "JamSession_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "media"."Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."JamParticipant" ADD CONSTRAINT "JamParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "engagement"."JamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement"."JamParticipant" ADD CONSTRAINT "JamParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."CollectionSubscription" ADD CONSTRAINT "CollectionSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."CollectionSubscription" ADD CONSTRAINT "CollectionSubscription_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "media"."Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."ContentReport" ADD CONSTRAINT "ContentReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."SupportTicket" ADD CONSTRAINT "SupportTicket_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."SupportTicketNote" ADD CONSTRAINT "SupportTicketNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "admin"."SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."SupportTicketNote" ADD CONSTRAINT "SupportTicketNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."BoardResolution" ADD CONSTRAINT "BoardResolution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."BoardResolution" ADD CONSTRAINT "BoardResolution_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."AnnualReport" ADD CONSTRAINT "AnnualReport_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."FeatureRequestQuarterlyReport" ADD CONSTRAINT "FeatureRequestQuarterlyReport_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."NewsPost" ADD CONSTRAINT "NewsPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Addon" ADD CONSTRAINT "Addon_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."AddonVersion" ADD CONSTRAINT "AddonVersion_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "core"."Addon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."AddonInstall" ADD CONSTRAINT "AddonInstall_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "core"."Addon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."AddonInstall" ADD CONSTRAINT "AddonInstall_listenerUserId_fkey" FOREIGN KEY ("listenerUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."AddonInstall" ADD CONSTRAINT "AddonInstall_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."ChannelBlock" ADD CONSTRAINT "ChannelBlock_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."InternetRadioStation" ADD CONSTRAINT "InternetRadioStation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."Theme" ADD CONSTRAINT "Theme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

