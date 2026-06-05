-- Beta applications queue + password setup tokens for approved invitees

CREATE TYPE "core"."BetaApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "core"."User" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TABLE "core"."BetaApplication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "artistType" TEXT NOT NULL,
    "links" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL,
    "status" "core"."BetaApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetaApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core"."PasswordSetup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordSetup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BetaApplication_userId_key" ON "core"."BetaApplication"("userId");
CREATE INDEX "BetaApplication_email_idx" ON "core"."BetaApplication"("email");
CREATE INDEX "BetaApplication_status_createdAt_idx" ON "core"."BetaApplication"("status", "createdAt");

CREATE UNIQUE INDEX "PasswordSetup_token_key" ON "core"."PasswordSetup"("token");
CREATE INDEX "PasswordSetup_token_idx" ON "core"."PasswordSetup"("token");
CREATE INDEX "PasswordSetup_userId_idx" ON "core"."PasswordSetup"("userId");

ALTER TABLE "core"."BetaApplication" ADD CONSTRAINT "BetaApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "core"."BetaApplication" ADD CONSTRAINT "BetaApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "core"."PasswordSetup" ADD CONSTRAINT "PasswordSetup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
