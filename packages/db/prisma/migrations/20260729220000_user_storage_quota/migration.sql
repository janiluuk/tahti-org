-- Per-user storage quota for the R2-backed long-term store. Lazily created
-- on first check with the 500MB free-tier default.
CREATE TABLE "core"."UserStorageQuota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quotaBytes" BIGINT NOT NULL DEFAULT 524288000,
    "usedBytes" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStorageQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserStorageQuota_userId_key" ON "core"."UserStorageQuota"("userId");

-- AddForeignKey
ALTER TABLE "core"."UserStorageQuota" ADD CONSTRAINT "UserStorageQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
