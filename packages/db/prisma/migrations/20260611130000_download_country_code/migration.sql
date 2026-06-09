-- PLAT-062: add ISO 3166-1 alpha-2 country code to Download for listener geography map.
ALTER TABLE engagement."Download" ADD COLUMN "countryCode" TEXT;
