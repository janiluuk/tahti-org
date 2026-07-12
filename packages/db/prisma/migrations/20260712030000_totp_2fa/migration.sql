ALTER TABLE "core"."User" ADD COLUMN "totpSecretEnc" TEXT;
ALTER TABLE "core"."User" ADD COLUMN "totpEnabledAt" TIMESTAMP(3);

CREATE TABLE "core"."TotpBackupCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TotpBackupCode_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "core"."TotpBackupCode"
  ADD CONSTRAINT "TotpBackupCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "core"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "TotpBackupCode_userId_idx" ON "core"."TotpBackupCode"("userId");

CREATE TABLE "core"."TotpChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TotpChallenge_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "core"."TotpChallenge"
  ADD CONSTRAINT "TotpChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "core"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "TotpChallenge_userId_idx" ON "core"."TotpChallenge"("userId");
