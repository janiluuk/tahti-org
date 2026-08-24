-- Disco-widgets: dynamically-loaded, sandboxed third-party widgets across
-- three scoped stores (listener/artist/admin). See /widget-sandbox route.

-- CreateEnum
CREATE TYPE "core"."DiscoWidgetScope" AS ENUM ('LISTENER', 'ARTIST', 'ADMIN');

-- CreateEnum
CREATE TYPE "core"."DiscoWidgetStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED');

-- CreateTable
CREATE TABLE "core"."DiscoWidget" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "scope" "core"."DiscoWidgetScope" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorUserId" TEXT,
    "categories" TEXT[],
    "iconUrl" TEXT,
    "currentVersion" TEXT NOT NULL,
    "bundleKey" TEXT NOT NULL,
    "bundleHash" TEXT NOT NULL,
    "bundleSizeBytes" INTEGER NOT NULL,
    "permissionsJson" JSONB NOT NULL DEFAULT '{}',
    "status" "core"."DiscoWidgetStatus" NOT NULL DEFAULT 'DRAFT',
    "moderationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoWidget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."DiscoWidgetVersion" (
    "id" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "bundleKey" TEXT NOT NULL,
    "bundleHash" TEXT NOT NULL,
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoWidgetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."DiscoWidgetInstall" (
    "id" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "listenerUserId" TEXT,
    "channelId" TEXT,
    "adminSurface" TEXT,
    "pinnedVersion" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoWidgetInstall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoWidget_slug_key" ON "core"."DiscoWidget"("slug");

-- CreateIndex
CREATE INDEX "DiscoWidget_scope_status_idx" ON "core"."DiscoWidget"("scope", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoWidgetVersion_widgetId_version_key" ON "core"."DiscoWidgetVersion"("widgetId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoWidgetInstall_widgetId_listenerUserId_key" ON "core"."DiscoWidgetInstall"("widgetId", "listenerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoWidgetInstall_widgetId_channelId_key" ON "core"."DiscoWidgetInstall"("widgetId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoWidgetInstall_widgetId_adminSurface_key" ON "core"."DiscoWidgetInstall"("widgetId", "adminSurface");

-- CreateIndex
CREATE INDEX "DiscoWidgetInstall_listenerUserId_position_idx" ON "core"."DiscoWidgetInstall"("listenerUserId", "position");

-- CreateIndex
CREATE INDEX "DiscoWidgetInstall_channelId_position_idx" ON "core"."DiscoWidgetInstall"("channelId", "position");

-- CreateIndex
CREATE INDEX "DiscoWidgetInstall_adminSurface_position_idx" ON "core"."DiscoWidgetInstall"("adminSurface", "position");

-- AddForeignKey
ALTER TABLE "core"."DiscoWidget" ADD CONSTRAINT "DiscoWidget_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."DiscoWidgetVersion" ADD CONSTRAINT "DiscoWidgetVersion_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "core"."DiscoWidget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."DiscoWidgetInstall" ADD CONSTRAINT "DiscoWidgetInstall_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "core"."DiscoWidget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."DiscoWidgetInstall" ADD CONSTRAINT "DiscoWidgetInstall_listenerUserId_fkey" FOREIGN KEY ("listenerUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."DiscoWidgetInstall" ADD CONSTRAINT "DiscoWidgetInstall_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
