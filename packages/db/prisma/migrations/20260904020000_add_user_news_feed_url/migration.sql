-- Artist-configured RSS/Atom feed URL for the public "Latest news" section.
ALTER TABLE "core"."User" ADD COLUMN "newsFeedUrl" TEXT;
