-- Optional gender field collected at signup, alongside the existing
-- countryCode — both nullable, cleared to null when the user picks
-- "Prefer not to say".
ALTER TABLE "core"."User" ADD COLUMN     "gender" TEXT;
