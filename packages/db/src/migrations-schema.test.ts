// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATIONS = join(__dirname, '../prisma/migrations')

function stripComments(sql: string): string {
  return sql.replace(/--.*$/gm, '')
}

// Tables live in named Postgres schemas (`channel`, `core`, ...). An
// unqualified `ALTER TABLE "Channel"` fails under `migrate deploy` with
// 42P01, and CI never notices because it builds the test DB with `db push`.
describe('migration SQL', () => {
  const files = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(MIGRATIONS, entry.name, 'migration.sql'))
  const label = (file: string) => file.split('/migrations/')[1]

  it('schema-qualifies every CREATE TABLE and ALTER TABLE', () => {
    const unqualified = files.flatMap((file) => {
      const sql = readFileSync(file, 'utf8')
      return [
        ...sql.matchAll(/\b(?:CREATE|ALTER) TABLE (?:IF NOT EXISTS )?"[A-Za-z_]+"(?!\.)/g),
      ].map((match) => `${label(file)}: ${match[0]}`)
    })
    expect(unqualified).toEqual([])
  })

  // An unqualified DROP INDEX IF EXISTS resolves against `public` and
  // silently does nothing.
  it('schema-qualifies every CREATE INDEX ... ON and DROP INDEX', () => {
    const unqualified = files.flatMap((file) => {
      const sql = stripComments(readFileSync(file, 'utf8'))
      return [
        ...sql.matchAll(/\bON "[A-Za-z_]+"(?!\.)/g),
        ...sql.matchAll(/\bDROP INDEX (?:CONCURRENTLY )?(?:IF EXISTS )?"[A-Za-z_]+"(?!\.)/g),
      ].map((match) => `${label(file)}: ${match[0]}`)
    })
    expect(unqualified).toEqual([])
  })

  // Prisma runs a multi-statement migration file as one transaction, and
  // CONCURRENTLY fails inside a transaction block.
  it('keeps each CONCURRENTLY statement alone in its migration', () => {
    const mixed = files.filter((file) => {
      const sql = stripComments(readFileSync(file, 'utf8'))
      if (!/\bCONCURRENTLY\b/.test(sql)) return false
      return sql.split(';').filter((stmt) => stmt.trim() !== '').length > 1
    })
    expect(mixed.map(label)).toEqual([])
  })

  it('defines channel.lower_tags exactly as prisma/raw-sql/lower-tags.sql', () => {
    const fn = readFileSync(join(__dirname, '../prisma/raw-sql/lower-tags.sql'), 'utf8').trim()
    const migration = readFileSync(
      join(MIGRATIONS, '20261123110000_search_pg_trgm_lower_tags', 'migration.sql'),
      'utf8',
    )
    expect(migration).toContain(fn)
  })
})
