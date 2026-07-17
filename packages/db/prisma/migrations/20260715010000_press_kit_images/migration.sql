-- Press-kit image gallery: high-quality promo photos beyond the profile avatar,
-- used for a downloadable zip (with a generated bio.txt) and an optional public
-- gallery on the artist page.

ALTER TABLE "channel"."Channel" ADD COLUMN "pressKitGalleryPublic" BOOLEAN NOT NULL DEFAULT false;

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

CREATE INDEX "PressKitImage_channelId_position_idx" ON "channel"."PressKitImage"("channelId", "position");

ALTER TABLE "channel"."PressKitImage"
  ADD CONSTRAINT "PressKitImage_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
