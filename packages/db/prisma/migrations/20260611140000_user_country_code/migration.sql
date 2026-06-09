-- User-declared ISO 3166-1 alpha-2 country code for profile flags and chat flags.
ALTER TABLE core."User" ADD COLUMN "countryCode" TEXT;
