-- CreateTable
CREATE TABLE "admin"."DiscordBotSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "clientId" TEXT NOT NULL,
    "tokenEnc" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "DiscordBotSettings_pkey" PRIMARY KEY ("id")
);
