// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

const SCHEMAS = [
  'core',
  'channel',
  'chat',
  'ledger',
  'governance',
  'engagement',
  'fansubs',
  'release',
  'newsletter',
  'venue',
  'media',
  'admin',
]

type OwnedTable = { schema: string; table: string; column: 'userId' | 'channelId' | 'id' }

let ownedTablesCache: OwnedTable[] | null = null

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`

// Every table with a userId or channelId column, plus User and Channel
// themselves: the rows a media URL can be saved in for one account.
async function ownedTables(prisma: PrismaClient): Promise<OwnedTable[]> {
  if (ownedTablesCache) return ownedTablesCache
  const rows = await prisma.$queryRawUnsafe<
    Array<{ table_schema: string; table_name: string; column_name: string }>
  >(
    `SELECT c.table_schema, c.table_name, c.column_name
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = ANY($1::text[])
        AND t.table_type = 'BASE TABLE'
        AND c.column_name IN ('userId', 'channelId')`,
    SCHEMAS,
  )
  const tables: OwnedTable[] = rows.map((r) => ({
    schema: r.table_schema,
    table: r.table_name,
    column: r.column_name as 'userId' | 'channelId',
  }))
  tables.push({ schema: 'core', table: 'User', column: 'id' })
  ownedTablesCache = tables
  return tables
}

/** Which of `keys` (object keys under `media/<username>/`) some row the
 * account owns still points at. A key counts as used when its file name
 * (unique per upload) appears anywhere in such a row. */
export async function findUsedMediaKeys(
  prisma: PrismaClient,
  userId: string,
  keys: string[],
): Promise<Set<string>> {
  const used = new Set<string>()
  if (keys.length === 0) return used
  const names = new Map(keys.map((key) => [key.split('/').pop() ?? key, key]))
  const channel = await prisma.channel.findUnique({ where: { userId }, select: { id: true } })
  for (const { schema, table, column } of await ownedTables(prisma)) {
    const owner = column === 'channelId' ? channel?.id : userId
    if (!owner) continue
    const pending = [...names.keys()].filter((name) => !used.has(names.get(name)!))
    if (pending.length === 0) break
    const hits = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT n AS name FROM unnest($2::text[]) AS n
        WHERE EXISTS (
          SELECT 1 FROM ${quote(schema)}.${quote(table)} AS t
           WHERE t.${quote(column)} = $1 AND strpos(t::text, n) > 0
        )`,
      owner,
      pending,
    )
    for (const hit of hits) used.add(names.get(hit.name)!)
  }
  return used
}
