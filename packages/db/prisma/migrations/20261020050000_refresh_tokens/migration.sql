-- AlterTable
ALTER TABLE "core"."Session" ADD COLUMN "deviceLabel" TEXT;

-- CreateTable
CREATE TABLE "core"."RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "core"."RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "core"."RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "core"."RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_sessionId_idx" ON "core"."RefreshToken"("sessionId");

-- AddForeignKey
ALTER TABLE "core"."RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."RefreshToken" ADD CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "core"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
