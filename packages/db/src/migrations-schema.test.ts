// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATIONS = join(__dirname, '../prisma/migrations')

// Tables live in named Postgres schemas (`channel`, `core`, ...). An
// unqualified `ALTER TABLE "Channel"` fails under `migrate deploy` with
// 42P01, and CI never notices because it builds the test DB with `db push`.
describe('migration SQL', () => {
  const files = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(MIGRATIONS, entry.name, 'migration.sql'))

  it('schema-qualifies every CREATE TABLE and ALTER TABLE', () => {
    const unqualified = files.flatMap((file) => {
      const sql = readFileSync(file, 'utf8')
      return [
        ...sql.matchAll(/\b(?:CREATE|ALTER) TABLE (?:IF NOT EXISTS )?"[A-Za-z_]+"(?!\.)/g),
      ].map((match) => `${file.split('/migrations/')[1]}: ${match[0]}`)
    })
    expect(unqualified).toEqual([])
  })
})
