// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'
import AdmZip from 'adm-zip'
import { prisma } from '@tahti/db'
import { downloadToFile, uploadFile } from '../lib/minio.js'

const STEM_SEPARATOR_URL = process.env.STEM_SEPARATOR_URL ?? 'http://localhost:8090'
const STEM_RETENTION_DAYS = 7

export interface SeparateStemsPayload {
  stemJobId: string
  soundId: string
  sourceKey: string
  stemSet: 'TWO_STEM' | 'FOUR_STEM'
}

// audio-separator names output files "{input filename}_(StemName).{ext}" —
// match by substring rather than trusting an exact pattern, since the exact
// prefix/casing can vary by model.
const STEM_MATCHERS: Record<string, RegExp> = {
  vocalsKey: /\(vocals\)/i,
  instrumentalKey: /\(instrumental\)/i,
  drumsKey: /\(drums\)/i,
  bassKey: /\(bass\)/i,
  otherKey: /\(other\)/i,
}

export async function processSeparateStemsJob(job: Job): Promise<void> {
  const { stemJobId, soundId, sourceKey, stemSet } = job.data as SeparateStemsPayload

  const item = await prisma.sound.findUnique({
    where: { id: soundId },
    select: { channel: { select: { slug: true } } },
  })
  if (!item) throw new Error(`Sound ${soundId} not found`)

  await prisma.soundStemJob.update({
    where: { id: stemJobId },
    data: { status: 'PROCESSING' },
  })

  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-stems-'))

  try {
    const ext = extname(sourceKey).slice(1) || 'wav'
    const inputPath = join(tmpDir, `source.${ext}`)
    await downloadToFile(sourceKey, inputPath)

    const inputBuffer = await readFile(inputPath)
    const form = new FormData()
    form.append('file', new Blob([inputBuffer]), `source.${ext}`)
    form.append('stem_set', stemSet)

    const response = await fetch(`${STEM_SEPARATOR_URL}/separate`, {
      method: 'POST',
      body: form,
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`stem-separator returned ${response.status}: ${body}`)
    }

    const zipBuffer = Buffer.from(await response.arrayBuffer())
    const zipPath = join(tmpDir, 'stems.zip')
    await writeFile(zipPath, zipBuffer)

    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries()

    const base = `stems/${item.channel.slug}/${soundId}/${stemJobId}`
    const keys: Partial<Record<keyof typeof STEM_MATCHERS, string>> = {}

    for (const entry of entries) {
      const field = (Object.keys(STEM_MATCHERS) as (keyof typeof STEM_MATCHERS)[]).find((f) =>
        STEM_MATCHERS[f]!.test(entry.entryName),
      )
      if (!field) continue

      const entryPath = join(tmpDir, entry.entryName)
      zip.extractEntryTo(entry, tmpDir, false, true)
      const key = `${base}/${field.replace('Key', '')}${extname(entry.entryName)}`
      await uploadFile(key, entryPath, 'audio/flac')
      keys[field] = key
    }

    if (Object.keys(keys).length === 0) {
      throw new Error('No recognized stem files in stem-separator response')
    }

    const expiresAt = new Date(Date.now() + STEM_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    await prisma.soundStemJob.update({
      where: { id: stemJobId },
      data: { ...keys, status: 'READY', expiresAt, errorMessage: null },
    })
  } catch (err) {
    await prisma.soundStemJob.update({
      where: { id: stemJobId },
      data: { status: 'ERROR', errorMessage: err instanceof Error ? err.message : String(err) },
    })
    throw err
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
