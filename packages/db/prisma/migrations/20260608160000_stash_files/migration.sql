-- PLAT-038: private WIP file storage (stash)

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

CREATE UNIQUE INDEX "StashShare_token_key" ON "core"."StashShare"("token");
CREATE INDEX "StashFile_userId_createdAt_idx" ON "core"."StashFile"("userId", "createdAt" DESC);
CREATE INDEX "StashShare_token_idx" ON "core"."StashShare"("token");

ALTER TABLE "core"."StashFile" ADD CONSTRAINT "StashFile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "core"."StashShare" ADD CONSTRAINT "StashShare_fileId_fkey"
    FOREIGN KEY ("fileId") REFERENCES "core"."StashFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
