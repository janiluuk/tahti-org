// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { safeDisplayName } from '@tahti/shared'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'

const PREFIX = 'display-name-backfill-'
const MIGRATION = resolve(
  __dirname,
  '../../../../packages/db/prisma/migrations/20261001131544_display_names_never_emails/migration.sql',
)

const NAMES: Record<string, string> = {
  plain: 'someone@example.com',
  wrapped: 'DJ Kaiku <kaiku@example.fi>',
  upper: 'ARTIST@EXAMPLE.ORG',
  handle: '@kaiku',
  normal: 'Northern Lights',
  atword: 'Live @ Kaiku',
}

describe('display name backfill migration', () => {
  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    for (const [tag, displayName] of Object.entries(NAMES)) {
      const user = await createTestArtist(prisma, {
        email: `${PREFIX}${tag}@example.com`,
        username: `dnb-${tag}`,
      })
      await prisma.user.update({ where: { id: user.id }, data: { displayName } })
    }
    await prisma.$executeRawUnsafe(readFileSync(MIGRATION, 'utf8'))
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('replaces email display names with the username, exactly like safeDisplayName', async () => {
    const rows = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { username: true, displayName: true },
    })
    const after = Object.fromEntries(rows.map((r) => [r.username, r.displayName]))
    for (const [tag, before] of Object.entries(NAMES)) {
      const username = `dnb-${tag}`
      expect(after[username]).toBe(safeDisplayName(before, username))
    }
    expect(after['dnb-plain']).toBe('dnb-plain')
    expect(after['dnb-normal']).toBe('Northern Lights')
    expect(after['dnb-atword']).toBe('Live @ Kaiku')
  })
})
