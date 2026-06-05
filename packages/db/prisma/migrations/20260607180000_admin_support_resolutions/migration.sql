-- M21-F/G: support tickets and board resolutions

CREATE TYPE "admin"."SupportCategory" AS ENUM ('ENGAGEMENT_DISPUTE', 'TECHNICAL', 'FINANCIAL', 'OTHER');
CREATE TYPE "admin"."SupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');
CREATE TYPE "admin"."ResolutionOutcome" AS ENUM ('PASSED', 'FAILED', 'DEFERRED');

CREATE TABLE "admin"."SupportTicket" (
    "id" BIGSERIAL NOT NULL,
    "artistId" TEXT,
    "contactEmail" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" "admin"."SupportCategory" NOT NULL,
    "status" "admin"."SupportStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin"."SupportTicketNote" (
    "id" BIGSERIAL NOT NULL,
    "ticketId" BIGINT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin"."BoardResolution" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL,
    "outcome" "admin"."ResolutionOutcome" NOT NULL,
    "voteFor" INTEGER NOT NULL,
    "voteAgainst" INTEGER NOT NULL,
    "voteAbstain" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardResolution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicket_status_createdAt_idx" ON "admin"."SupportTicket"("status", "createdAt" DESC);
CREATE INDEX "SupportTicketNote_ticketId_createdAt_idx" ON "admin"."SupportTicketNote"("ticketId", "createdAt" ASC);
CREATE INDEX "BoardResolution_votedAt_idx" ON "admin"."BoardResolution"("votedAt" DESC);

ALTER TABLE "admin"."SupportTicket" ADD CONSTRAINT "SupportTicket_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin"."SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin"."SupportTicketNote" ADD CONSTRAINT "SupportTicketNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "admin"."SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin"."SupportTicketNote" ADD CONSTRAINT "SupportTicketNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin"."BoardResolution" ADD CONSTRAINT "BoardResolution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
