-- Internet radio library — client-side-only external stations (a user's
-- browser plays the m3u8 URL directly; Tahti never relays third-party audio).

-- CreateTable
CREATE TABLE "core"."InternetRadioPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genre" TEXT,
    "description" TEXT,
    "iconUrl" TEXT,
    "programmingUrl" TEXT,
    "streamUrl" TEXT,
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

-- CreateIndex
CREATE INDEX "InternetRadioStation_userId_position_idx" ON "core"."InternetRadioStation"("userId", "position");

-- AddForeignKey
ALTER TABLE "core"."InternetRadioStation" ADD CONSTRAINT "InternetRadioStation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
