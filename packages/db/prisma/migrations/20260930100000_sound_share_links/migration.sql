-- CreateTable
CREATE TABLE "channel"."SoundShare" (
    "id" TEXT NOT NULL,
    "soundId" TEXT NOT NULL,
    "granteeUsername" TEXT,
    "token" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'READ',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoundShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SoundShare_token_key" ON "channel"."SoundShare"("token");

-- CreateIndex
CREATE INDEX "SoundShare_soundId_idx" ON "channel"."SoundShare"("soundId");

-- AddForeignKey
ALTER TABLE "channel"."SoundShare" ADD CONSTRAINT "SoundShare_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "channel"."Sound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

