// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Prisma } from '@tahti/db'

/** True for a Prisma unique-constraint violation (P2002) — e.g. two concurrent
 * requests racing past an upfront uniqueness check before either commits. */
export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}
