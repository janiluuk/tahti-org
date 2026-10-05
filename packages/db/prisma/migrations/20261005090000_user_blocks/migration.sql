-- People can block another account: no direct messages either way.
CREATE TABLE "engagement"."UserBlock" (
    "blockerUserId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerUserId","blockedUserId")
);

CREATE INDEX "UserBlock_blockedUserId_idx" ON "engagement"."UserBlock"("blockedUserId");

ALTER TABLE "engagement"."UserBlock" ADD CONSTRAINT "UserBlock_blockerUserId_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "engagement"."UserBlock" ADD CONSTRAINT "UserBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
