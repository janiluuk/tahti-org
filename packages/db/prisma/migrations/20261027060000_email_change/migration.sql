-- Pending email address changes, confirmed from a link sent to the new address.
CREATE TABLE "core"."EmailChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailChange_token_key" ON "core"."EmailChange"("token");
CREATE INDEX "EmailChange_userId_idx" ON "core"."EmailChange"("userId");

ALTER TABLE "core"."EmailChange" ADD CONSTRAINT "EmailChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
