-- CreateEnum
CREATE TYPE "media"."ArtistGroupJoinPolicy" AS ENUM ('OPEN', 'REQUEST');

-- CreateEnum
CREATE TYPE "media"."ArtistGroupSubmitPolicy" AS ENUM ('OPEN', 'APPROVE');

-- CreateEnum
CREATE TYPE "media"."ArtistGroupRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "media"."ArtistGroupRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "media"."ArtistGroup" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "coverKey" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "joinPolicy" "media"."ArtistGroupJoinPolicy" NOT NULL DEFAULT 'OPEN',
    "submitPolicy" "media"."ArtistGroupSubmitPolicy" NOT NULL DEFAULT 'OPEN',
    "collectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."ArtistGroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "media"."ArtistGroupRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistGroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "media"."ArtistGroupJoinRequest" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "media"."ArtistGroupRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,

    CONSTRAINT "ArtistGroupJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media"."ArtistGroupSoundSubmission" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "soundId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "note" TEXT,
    "status" "media"."ArtistGroupRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,

    CONSTRAINT "ArtistGroupSoundSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArtistGroup_slug_key" ON "media"."ArtistGroup"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistGroup_collectionId_key" ON "media"."ArtistGroup"("collectionId");

-- CreateIndex
CREATE INDEX "ArtistGroup_isPublic_createdAt_idx" ON "media"."ArtistGroup"("isPublic", "createdAt");

-- CreateIndex
CREATE INDEX "ArtistGroupMember_userId_idx" ON "media"."ArtistGroupMember"("userId");

-- CreateIndex
CREATE INDEX "ArtistGroupJoinRequest_groupId_status_idx" ON "media"."ArtistGroupJoinRequest"("groupId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistGroupJoinRequest_groupId_userId_key" ON "media"."ArtistGroupJoinRequest"("groupId", "userId");

-- CreateIndex
CREATE INDEX "ArtistGroupSoundSubmission_groupId_status_idx" ON "media"."ArtistGroupSoundSubmission"("groupId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistGroupSoundSubmission_groupId_soundId_key" ON "media"."ArtistGroupSoundSubmission"("groupId", "soundId");

-- AddForeignKey
ALTER TABLE "media"."ArtistGroup" ADD CONSTRAINT "ArtistGroup_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."ArtistGroup" ADD CONSTRAINT "ArtistGroup_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "media"."Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."ArtistGroupMember" ADD CONSTRAINT "ArtistGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "media"."ArtistGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."ArtistGroupMember" ADD CONSTRAINT "ArtistGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."ArtistGroupJoinRequest" ADD CONSTRAINT "ArtistGroupJoinRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "media"."ArtistGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."ArtistGroupJoinRequest" ADD CONSTRAINT "ArtistGroupJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."ArtistGroupJoinRequest" ADD CONSTRAINT "ArtistGroupJoinRequest_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."ArtistGroupSoundSubmission" ADD CONSTRAINT "ArtistGroupSoundSubmission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "media"."ArtistGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."ArtistGroupSoundSubmission" ADD CONSTRAINT "ArtistGroupSoundSubmission_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."ArtistGroupSoundSubmission" ADD CONSTRAINT "ArtistGroupSoundSubmission_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media"."ArtistGroupSoundSubmission" ADD CONSTRAINT "ArtistGroupSoundSubmission_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

