#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
//
// Dry-run: count READY sounds missing peaks / editorPeaks (optional channel slug).
// Usage: DATABASE_URL=... node scripts/peaks-gap-audit.mjs [--slug yaniho] [--enqueue]
import { PrismaClient, Prisma } from '@tahti/db'
import { Queue } from 'bullmq'
import { clearFinishedJob } from '@tahti/shared'

const args = process.argv.slice(2)
const slugIdx = args.indexOf('--slug')
const slug = slugIdx >= 0 ? args[slugIdx + 1] : null
const enqueue = args.includes('--enqueue')
const BATCH = 48

const prisma = new PrismaClient()
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

async function main() {
  const channel = slug
    ? await prisma.channel.findUnique({ where: { slug }, select: { id: true, slug: true } })
    : null
  if (slug && !channel) {
    console.error(`channel not found: ${slug}`)
    process.exit(1)
  }

  const where = {
    status: 'READY',
    ...(channel ? { channelId: channel.id } : {}),
    OR: [{ peaks: { equals: Prisma.DbNull } }, { editorPeaks: { equals: Prisma.DbNull } }],
    AND: [
      { OR: [{ flacKey: { not: null } }, { rawKey: { not: null } }, { mp3Key: { not: null } }] },
    ],
  }

  const total = await prisma.sound.count({ where })
  const sample = await prisma.sound.findMany({
    where,
    select: { id: true, title: true, peaks: true, editorPeaks: true },
    take: 10,
    orderBy: { createdAt: 'asc' },
  })

  console.log(
    JSON.stringify(
      {
        slug: channel?.slug ?? null,
        missingPeaksOrEditorPeaks: total,
        sample,
        enqueue: enqueue ? 'will enqueue up to batch' : false,
      },
      null,
      2,
    ),
  )

  if (!enqueue || total === 0) return

  const items = await prisma.sound.findMany({
    where,
    select: { id: true },
    take: BATCH,
    orderBy: { createdAt: 'asc' },
  })
  const connection = {
    host: new URL(REDIS_URL).hostname,
    port: parseInt(new URL(REDIS_URL).port || '6379', 10),
  }
  const queue = new Queue('media', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    },
  })
  try {
    for (const item of items) {
      const jobId = `backfill-editor-peaks-${item.id}`
      await clearFinishedJob(queue, jobId)
      await queue.add(
        'backfill-editor-peaks',
        { itemId: item.id },
        { jobId, removeOnComplete: true },
      )
    }
  } finally {
    await queue.close()
  }
  console.log(`enqueued ${items.length}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
