// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * One-off clean-up of imported album track titles. For each of an artist's
 * collections, a track of their own titled "Artist - <collection name> - NN -
 * Title" (e.g. "yaniho - euphorizer LP - 02 - Particular particle" in the
 * collection "euphorizer LP") is renamed to "Title", and the collection is
 * put in album order: numbered tracks by NN, every other item kept right
 * after the item it follows now, numbered 1..n. A credit naming the artist
 * among others ("Yaniho x Chisu & Orkidea - ...") keeps the others as
 * "Title (with Chisu & Orkidea)". A trailing LP or EP does not matter when
 * matching album names. Collections with no match are not touched.
 *
 * With --create-missing, an album found in titles that has no collection
 * gets a new private (DRAFT) collection of those tracks in NN order; of two
 * uploads with the same number and title only the newest is added. Titles in
 * album form outside their existing album are only listed.
 *
 * Dry run by default: prints old -> new position and title per row and
 * writes a JSON backup. --apply also writes, one transaction per collection,
 * and adds the ids of collections it made to the backup. --restore
 * <backup.json> puts the backed-up titles and positions back and deletes the
 * collections the script made while they hold only its items (also a dry run
 * until --apply).
 *
 * Run (stack):
 *   docker compose exec -T api tsx apps/api/scripts/clean-album-track-titles.ts [username] [--create-missing] [--backup <file>]
 *   docker compose exec -T api tsx apps/api/scripts/clean-album-track-titles.ts [username] --create-missing --backup <file> --apply
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
  'Usage: tsx clean-album-track-titles.ts [username] [--create-missing] [--backup <file>] [--apply]\n' +
  '       tsx clean-album-track-titles.ts --restore <backup.json> [--apply]'

function parseArgs(argv: string[]) {
  const args = {
    username: 'yaniho',
    apply: false,
    createMissing: false,
    backup: null as string | null,
    restore: null as string | null,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--apply') args.apply = true
    else if (arg === '--create-missing') args.createMissing = true
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
  for (const deleted of result.deleted) console.log(`  delete collection ${deleted.slug}`)
  for (const skipped of result.skipped) console.log(`  skipped ${skipped}`)
  console.log(
    apply
      ? `Restored ${result.titles.length} titles and ${result.positions.length} positions, deleted ${result.deleted.length} collections.`
      : 'DRY RUN: nothing written. Add --apply to restore.',
  )
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.restore) return restore(args.restore, args.apply)

  const plan = await planAlbumTrackTitles(prisma, args.username)
  const options = { createMissing: args.createMissing }
  for (const line of describePlan(plan, options)) console.log(line)
  if (plan.collections.length === 0 && (!args.createMissing || plan.newCollections.length === 0)) {
    return
  }

  const backupFile =
    args.backup ??
    `album-track-titles-${plan.username}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  const backup = backupFromPlan(plan, options)
  const saveBackup = () => writeFileSync(backupFile, `${JSON.stringify(backup, null, 2)}\n`)
  saveBackup()
  console.log(`\nBackup of current titles and positions: ${backupFile}`)

  if (!args.apply) {
    console.log('DRY RUN: nothing written. Add --apply to write.')
    return
  }
  const result = await applyAlbumTrackTitles(prisma, plan, {
    ...options,
    onCreated: (created) => {
      backup.createdCollections!.push(created)
      saveBackup()
    },
  })
  await result.settled
  console.log(`Applied: ${result.applied.join(', ') || 'none'}`)
  console.log(`Created (private): ${result.created.map((c) => c.slug).join(', ') || 'none'}`)
  for (const skipped of result.skipped) console.log(`Skipped ${skipped.slug}: ${skipped.reason}`)
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
