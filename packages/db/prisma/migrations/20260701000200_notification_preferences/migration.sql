-- /dashboard/settings/notifications instrument-pattern view (docs/design/ground-rules.md):
-- three toggle cards, each persisted as a plain boolean on User.
ALTER TABLE "core"."User" ADD COLUMN "notifyMoneyMovesEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "core"."User" ADD COLUMN "notifyMoneyMovesInApp" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "core"."User" ADD COLUMN "notifyListenerActivityEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "core"."User" ADD COLUMN "notifyWeeklyRecapEmail" BOOLEAN NOT NULL DEFAULT true;
