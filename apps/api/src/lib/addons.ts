// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import { transform } from 'esbuild'
import type { Addon, Prisma, PrismaClient } from '@tahti/db'
import type { AddonScopeInput, PatchAddonInstallInput } from '@tahti/shared'

/** Path apps/web's /widget-sandbox/[bundleHash] route proxies, then loads
 * via <script src integrity="sha256-...">. Shared by every render feed in
 * routes/addons/public.ts and routes/channels/blocks.ts. */
export function addonSandboxUrl(bundleHash: string): string {
  return `/widget-sandbox/${bundleHash}`
}

export async function resolveAddonVersionHash(
  prisma: PrismaClient,
  widget: Pick<Addon, 'id' | 'currentVersion' | 'bundleHash'>,
  pinnedVersion: string | null,
): Promise<{ version: string; bundleHash: string }> {
  if (!pinnedVersion || pinnedVersion === widget.currentVersion) {
    return { version: widget.currentVersion, bundleHash: widget.bundleHash }
  }
  const pinned = await prisma.addonVersion.findUnique({
    where: { widgetId_version: { widgetId: widget.id, version: pinnedVersion } },
  })
  // Pinned version was deleted from history somehow — fall back to current
  // rather than serving a broken/missing bundle.
  if (!pinned) return { version: widget.currentVersion, bundleHash: widget.bundleHash }
  return { version: pinned.version, bundleHash: pinned.bundleHash }
}

export function sha256Hex(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Parses (never executes) the uploaded bundle to reject anything that isn't
 * a syntactically valid ES module before it's ever published to a store. */
export async function assertValidWidgetBundle(code: string): Promise<void> {
  await transform(code, { format: 'esm', loader: 'js' })
}

export function toInstallUpdateData(patch: PatchAddonInstallInput): Prisma.AddonInstallUpdateInput {
  return {
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.position !== undefined ? { position: patch.position } : {}),
    ...(patch.configJson !== undefined
      ? { configJson: patch.configJson as Prisma.InputJsonValue }
      : {}),
  }
}

/** One owner-scoped surface's addons to render: explicit installs (position-
 * ordered, may override a default's config) plus any platform-wide default-
 * enabled addon this owner has no install row for at all — installing one
 * (even disabled) is how an owner overrides or suppresses a default. Used by
 * every render feed in routes/addons/public.ts so "on by default" behaves
 * the same on the channel page, homepage, and Discover. */
export async function resolveAddonRenderSet(
  prisma: PrismaClient,
  scope: AddonScopeInput,
  ownerWhere: Prisma.AddonInstallWhereInput,
) {
  const [explicitInstalls, ownedInstalls, defaultWidgets] = await Promise.all([
    prisma.addonInstall.findMany({
      where: { ...ownerWhere, enabled: true, widget: { status: 'APPROVED' } },
      orderBy: { position: 'asc' },
      include: { widget: true },
    }),
    prisma.addonInstall.findMany({ where: ownerWhere, select: { widgetId: true } }),
    prisma.addon.findMany({
      where: { scope, status: 'APPROVED', enabledByDefault: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const ownedWidgetIds = new Set(ownedInstalls.map((i) => i.widgetId))
  const defaultOnlyWidgets = defaultWidgets.filter((w) => !ownedWidgetIds.has(w.id))
  return { explicitInstalls, defaultOnlyWidgets }
}
