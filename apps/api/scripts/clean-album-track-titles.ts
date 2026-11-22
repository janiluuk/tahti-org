// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * One-off clean-up of imported album track titles. For each of an artist's
 * collections, a track of their own titled "Artist - <collection name> - NN -
 * Title" (e.g. "yaniho - euphorizer LP - 02 - Particular particle" in the
 * collection "euphorizer LP") is renamed to "Title", and the collection is
 * reordered: matched tracks first in NN order, then every other item in its
 * current order, numbered 1..n. Collections with no match are not touched.
 * Titles in that form outside a matching collection are only listed.
 *
 * Dry run by default: prints old -> new position and title per row and
 * writes a JSON backup. --apply also writes, one transaction per collection.
 * --restore <backup.json> puts the backed-up titles and positions back (also
 * a dry run until --apply).
 *
 * Run (stack):
 *   docker compose exec -T api tsx apps/api/scripts/clean-album-track-titles.ts [username] [--backup <file>]
 *   docker compose exec -T api tsx apps/api/scripts/clean-album-track-titles.ts [username] --backup <file> --apply
 *   docker compose exec -T api tsx apps/api/scripts/clean-album-track-titles.ts --restore <file> [--apply]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { prisma } from '@tahti/db'
import {
  applyAlbumTrackTitles,
  backupFromPlan,
  describePlan,
  planAlbumTrackTitles,
  restoreAlbumTrackTitles,
  type AlbumTrackTitleBackup,
} from '../src/lib/album-track-titles.js'

const USAGE =
  'Usage: tsx clean-album-track-titles.ts [username] [--backup <file>] [--apply]\n' +
  '       tsx clean-album-track-titles.ts --restore <backup.json> [--apply]'

function parseArgs(argv: string[]) {
  const args = {
    username: 'yaniho',
    apply: false,
    backup: null as string | null,
    restore: null as string | null,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--apply') args.apply = true
    else if (arg === '--backup' || arg === '--restore') {
      const value = argv[++i]
      if (!value) throw new Error(`${arg} needs a file\n${USAGE}`)
      args[arg === '--backup' ? 'backup' : 'restore'] = value
    } else if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}\n${USAGE}`)
    else args.username = arg
  }
  return args
}

async function restore(file: string, apply: boolean) {
  const backup = JSON.parse(readFileSync(file, 'utf8')) as AlbumTrackTitleBackup
  const result = await restoreAlbumTrackTitles(prisma, backup, { apply })
  console.log(`Restore of @${backup.username} from ${backup.createdAt}`)
  for (const title of result.titles) console.log(`  title "${title.from}" -> "${title.to}"`)
  for (const move of result.positions) {
    console.log(`  ${move.slug} item ${move.itemId}: position ${move.from} -> ${move.to}`)
  }
  for (const skipped of result.skipped) console.log(`  skipped ${skipped}`)
  console.log(
    apply
      ? `Restored ${result.titles.length} titles and ${result.positions.length} positions.`
      : 'DRY RUN: nothing written. Add --apply to restore.',
  )
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.restore) return restore(args.restore, args.apply)

  const plan = await planAlbumTrackTitles(prisma, args.username)
  for (const line of describePlan(plan)) console.log(line)
  if (plan.collections.length === 0) return

  const backupFile =
    args.backup ??
    `album-track-titles-${plan.username}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(backupFile, `${JSON.stringify(backupFromPlan(plan), null, 2)}\n`)
  console.log(`\nBackup of current titles and positions: ${backupFile}`)

  if (!args.apply) {
    console.log('DRY RUN: nothing written. Add --apply to write.')
    return
  }
  const result = await applyAlbumTrackTitles(prisma, plan)
  console.log(`Applied: ${result.applied.join(', ') || 'none'}`)
  for (const skipped of result.skipped) console.log(`Skipped ${skipped.slug}: ${skipped.reason}`)
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
