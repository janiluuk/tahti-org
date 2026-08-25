-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Account restrictions (booking / upload / login — each independent, with a
-- reason shown back to the user) and a missed-live-show admin review queue
-- (raised when a ScheduledLiveShow's start time passes with no Broadcast
-- against it).

CREATE TYPE "core"."AccountRestrictionType" AS ENUM ('LIVE_SHOW_BOOKING', 'UPLOAD', 'LOGIN');

CREATE TABLE "core"."AccountRestriction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "core"."AccountRestrictionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),
    "bannedById" TEXT,

    CONSTRAINT "AccountRestriction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountRestriction_userId_type_expiresAt_idx" ON "core"."AccountRestriction"("userId", "type", "expiresAt");

ALTER TABLE "core"."AccountRestriction" ADD CONSTRAINT "AccountRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core"."AccountRestriction" ADD CONSTRAINT "AccountRestriction_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "admin"."MissedLiveShowFlag" (
    "id" BIGSERIAL NOT NULL,
    "scheduledLiveShowId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "admin"."ContentReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MissedLiveShowFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MissedLiveShowFlag_scheduledLiveShowId_key" ON "admin"."MissedLiveShowFlag"("scheduledLiveShowId");
CREATE INDEX "MissedLiveShowFlag_status_detectedAt_idx" ON "admin"."MissedLiveShowFlag"("status", "detectedAt" DESC);

ALTER TABLE "admin"."MissedLiveShowFlag" ADD CONSTRAINT "MissedLiveShowFlag_scheduledLiveShowId_fkey" FOREIGN KEY ("scheduledLiveShowId") REFERENCES "channel"."ScheduledLiveShow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin"."MissedLiveShowFlag" ADD CONSTRAINT "MissedLiveShowFlag_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin"."MissedLiveShowFlag" ADD CONSTRAINT "MissedLiveShowFlag_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
