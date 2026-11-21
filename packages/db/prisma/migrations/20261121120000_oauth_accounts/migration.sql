-- Google / Facebook sign-in identities linked to an account.
CREATE TABLE "core"."OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthAccount_provider_providerUserId_key" ON "core"."OAuthAccount"("provider", "providerUserId");

CREATE UNIQUE INDEX "OAuthAccount_userId_provider_key" ON "core"."OAuthAccount"("userId", "provider");

ALTER TABLE "core"."OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
