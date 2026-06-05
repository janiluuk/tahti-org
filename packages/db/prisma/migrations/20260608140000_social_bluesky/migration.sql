-- M14: Bluesky social auto-post
ALTER TYPE "core"."SocialPlatform" ADD VALUE 'BLUESKY';
ALTER TABLE "core"."SocialConnection" ADD COLUMN "externalAccountId" TEXT;
