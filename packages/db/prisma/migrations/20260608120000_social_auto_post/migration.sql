-- M14: social auto-post (Mastodon v0)
CREATE TYPE "core"."SocialPlatform" AS ENUM ('MASTODON');
CREATE TYPE "core"."SocialPostState" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "core"."SocialConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "core"."SocialPlatform" NOT NULL,
    "instanceUrl" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "onReleasePublished" BOOLEAN NOT NULL DEFAULT false,
    "onChannelLive" BOOLEAN NOT NULL DEFAULT false,
    "postTemplate" TEXT NOT NULL DEFAULT 'New release: {release} by {artist} — {smart_link}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

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

CREATE UNIQUE INDEX "SocialConnection_userId_platform_key" ON "core"."SocialConnection"("userId", "platform");
CREATE INDEX "SocialPost_userId_createdAt_idx" ON "core"."SocialPost"("userId", "createdAt");

ALTER TABLE "core"."SocialConnection" ADD CONSTRAINT "SocialConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core"."SocialPost" ADD CONSTRAINT "SocialPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
