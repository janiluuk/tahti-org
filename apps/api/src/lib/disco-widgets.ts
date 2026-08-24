// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import { transform } from 'esbuild'
import type { Prisma } from '@tahti/db'
import type { PatchDiscoWidgetInstallInput } from '@tahti/shared'

export function sha256Hex(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Parses (never executes) the uploaded bundle to reject anything that isn't
 * a syntactically valid ES module before it's ever published to a store. */
export async function assertValidWidgetBundle(code: string): Promise<void> {
  await transform(code, { format: 'esm', loader: 'js' })
}

export function toInstallUpdateData(
  patch: PatchDiscoWidgetInstallInput,
): Prisma.DiscoWidgetInstallUpdateInput {
  return {
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.position !== undefined ? { position: patch.position } : {}),
    ...(patch.configJson !== undefined
      ? { configJson: patch.configJson as Prisma.InputJsonValue }
      : {}),
  }
}
