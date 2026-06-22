-- Channel Designer mockup identity block (avatar, display name, location, pronouns,
-- genre tags) — pronouns was the one field with no schema support at all.

ALTER TABLE "core"."User"
  ADD COLUMN "pronouns" TEXT;
