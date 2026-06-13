-- Pro editor v3: non-destructive edit draft persisted on archive item
ALTER TABLE "channel"."ArchiveItem" ADD COLUMN "editList" JSONB;
