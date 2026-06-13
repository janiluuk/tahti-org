// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import {
  compileFiltergraph,
  compileLoudnormPass1Filter,
  compileOutputArgs,
  validateEditList,
  type EditList,
  type LoudnormMeasured,
  type OutputFormat,
} from '@tahti/audio-edit'
import { prisma, syncActiveVersionToItem } from '@tahti/db'
import { downloadToFile, uploadFile } from '../lib/minio.js'
import { processTranscodeVersionJob } from './transcode-version.js'

export interface RenderArchiveEditPayload {
  versionId: string
  archiveItemId: string
  channelSlug: string
  sourceKey: string
  editList: EditList
  format: OutputFormat
  activate: boolean
}

function parseLoudnormJson(stderr: string): LoudnormMeasured | null {
  const start = stderr.indexOf('{')
  const end = stderr.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const raw = JSON.parse(stderr.slice(start, end + 1)) as Record<string, string>
    const i = parseFloat(raw.input_i ?? raw.output_i ?? '')
    const tp = parseFloat(raw.input_tp ?? raw.output_tp ?? '')
    const lra = parseFloat(raw.input_lra ?? raw.output_lra ?? '')
    const thresh = parseFloat(raw.input_thresh ?? raw.output_thresh ?? '')
    if (Number.isNaN(i)) return null
    return { i, tp, lra, thresh }
  } catch {
    return null
  }
}

function ffmpegComplex(
  inputPath: string,
  outputPath: string,
  filtergraph: string,
  format: OutputFormat,
): Promise<string> {
  const { codecArgs, ar } = compileOutputArgs(format)
  const outOpts = ['-filter_complex', filtergraph, '-map', '[out]', ...codecArgs]
  if (ar) outOpts.push('-ar', String(ar))

  return new Promise((resolve, reject) => {
    let stderr = ''
    ffmpeg(inputPath)
      .outputOptions(...outOpts)
      .on('stderr', (line) => {
        stderr += line
      })
      .on('error', (err) => reject(err))
      .on('end', () => resolve(stderr))
      .save(outputPath)
  })
}

function ffmpegComplexNull(inputPath: string, filtergraph: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let stderr = ''
    ffmpeg(inputPath)
      .outputOptions('-filter_complex', filtergraph, '-map', '[out]', '-f', 'null')
      .on('stderr', (line) => {
        stderr += line
      })
      .on('error', (err) => reject(err))
      .on('end', () => resolve(stderr))
      .save('/dev/null')
  })
}

async function measureLoudnorm(
  inputPath: string,
  edit: EditList,
): Promise<LoudnormMeasured | null> {
  const pass1 = compileLoudnormPass1Filter(edit)
  if (!pass1) return null

  const base = compileFiltergraph({
    ...edit,
    loudnorm: { ...edit.loudnorm, measured: undefined },
  })
  const graph = base.filtergraph.replace(/loudnorm=I=[^[]+\[out\]/, `${pass1}[out]`)
  const stderr = await ffmpegComplexNull(inputPath, graph)
  return parseLoudnormJson(stderr)
}

async function renderEditList(
  inputPath: string,
  outputPath: string,
  edit: EditList,
  format: OutputFormat,
): Promise<void> {
  let list = edit
  if (list.loudnorm.enabled && !list.loudnorm.measured) {
    const measured = await measureLoudnorm(inputPath, list)
    if (measured) {
      list = { ...list, loudnorm: { ...list.loudnorm, measured } }
    }
  }

  const { filtergraph } = compileFiltergraph(list)
  await ffmpegComplex(inputPath, outputPath, filtergraph, format)
}

export async function processRenderArchiveEditJob(job: Job): Promise<void> {
  const data = job.data as RenderArchiveEditPayload
  const { versionId, archiveItemId, channelSlug, sourceKey, format, activate } = data

  const validation = validateEditList(data.editList)
  if (!validation.ok || !validation.edit) {
    throw new Error(validation.issues[0]?.message ?? 'Invalid edit list')
  }
  const editList = validation.edit

  const version = await prisma.archiveItemVersion.findUnique({ where: { id: versionId } })
  if (!version) throw new Error(`ArchiveItemVersion ${versionId} not found`)

  await prisma.archiveItemVersion.update({
    where: { id: versionId },
    data: { status: 'PROCESSING' },
  })

  const ext = format === 'mp3' ? 'mp3' : format === 'wav' ? 'wav' : 'flac'
  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-render-edit-'))
  const rawKey = `raw/${channelSlug}/${randomUUID()}.${ext}`

  try {
    const inputPath = join(tmpDir, 'input')
    const outputPath = join(tmpDir, `rendered.${ext}`)
    await downloadToFile(sourceKey, inputPath)
    await renderEditList(inputPath, outputPath, editList, format)

    const fileStat = await stat(outputPath)
    const mime = format === 'mp3' ? 'audio/mpeg' : format === 'wav' ? 'audio/wav' : 'audio/flac'
    await uploadFile(rawKey, outputPath, mime)

    await prisma.archiveItemVersion.update({
      where: { id: versionId },
      data: {
        rawKey,
        fileSizeBytes: BigInt(fileStat.size),
      },
    })

    await processTranscodeVersionJob({ data: { versionId } } as Job)

    if (activate) {
      await prisma.$transaction([
        prisma.archiveItemVersion.updateMany({
          where: { archiveItemId },
          data: { isActive: false },
        }),
        prisma.archiveItemVersion.update({
          where: { id: versionId },
          data: { isActive: true },
        }),
      ])
      await syncActiveVersionToItem(prisma, archiveItemId)
    }
  } catch (err) {
    await prisma.archiveItemVersion.update({
      where: { id: versionId },
      data: { status: 'ERROR' },
    })
    throw err
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
