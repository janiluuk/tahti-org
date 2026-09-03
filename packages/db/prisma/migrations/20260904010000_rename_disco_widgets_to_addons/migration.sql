-- Rename DiscoWidget subsystem to Addon (product-facing rename; behavior unchanged).
ALTER TABLE "core"."DiscoWidget" RENAME TO "Addon";
ALTER TABLE "core"."DiscoWidgetVersion" RENAME TO "AddonVersion";
ALTER TABLE "core"."DiscoWidgetInstall" RENAME TO "AddonInstall";
ALTER TYPE "core"."DiscoWidgetScope" RENAME TO "AddonScope";
ALTER TYPE "core"."DiscoWidgetStatus" RENAME TO "AddonStatus";

-- Platform-wide default-enablement: an approved addon with this set renders on
-- its scope's surfaces even without an explicit AddonInstall row for a given
-- listener/channel/admin surface.
ALTER TABLE "core"."Addon" ADD COLUMN "enabledByDefault" BOOLEAN NOT NULL DEFAULT false;
