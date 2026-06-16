// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import {
  compileFiltergraph,
  compileLoudnormOutputFiltergraph,
  compileLoudnormPass1Filter,
  compileOutputArgs,
  computeKeepSegments,
  mergeCuts,
  shouldUseSegmentRender,
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

export interface RenderJobProgress {
  pct: number
  phase: string
  segment?: number
  segmentCount?: number
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

function ffmpegConcat(listPath: string, outputPath: string, format: OutputFormat): Promise<void> {
  const { codecArgs, ar } = compileOutputArgs(format)
  const outOpts = ['-c', 'copy']
  if (format !== 'flac' && format !== 'mp3') {
    outOpts.length = 0
    outOpts.push(...codecArgs)
  }
  if (ar) outOpts.push('-ar', String(ar))

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions('-f', 'concat', '-safe', '0')
      .outputOptions(...outOpts)
      .on('error', (err) => reject(err))
      .on('end', () => resolve())
      .save(outputPath)
  })
}

async function measureLoudnorm(
  inputPath: string,
  edit: EditList,
): Promise<LoudnormMeasured | null> {
  const pass1 = compileLoudnormPass1Filter(edit)
  if (!pass1) return null
  const stderr = await ffmpegComplexNull(inputPath, `[0:a]${pass1}[out]`)
  return parseLoudnormJson(stderr)
}

async function applyLoudnormToFile(
  inputPath: string,
  outputPath: string,
  edit: EditList,
  format: OutputFormat,
): Promise<void> {
  let list = edit
  if (!list.loudnorm.measured) {
    const measured = await measureLoudnorm(inputPath, list)
    if (measured) {
      list = { ...list, loudnorm: { ...list.loudnorm, measured } }
    }
  }
  await ffmpegComplex(inputPath, outputPath, compileLoudnormOutputFiltergraph(list), format)
}

async function renderSinglePass(
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

function editWithoutLoudnorm(edit: EditList): EditList {
  return { ...edit, loudnorm: { ...edit.loudnorm, enabled: false, measured: undefined } }
}

async function renderSegmented(
  inputPath: string,
  outputPath: string,
  edit: EditList,
  format: OutputFormat,
  tmpDir: string,
  onProgress?: (update: RenderJobProgress) => Promise<void>,
): Promise<void> {
  const segments = computeKeepSegments(edit.sourceDuration, mergeCuts(edit.cuts))
  const segmentEdit = editWithoutLoudnorm(edit)
  const ext = format === 'mp3' ? 'mp3' : format === 'wav' ? 'wav' : 'flac'
  const segmentPaths: string[] = []

  for (let i = 0; i < segments.length; i++) {
    await onProgress?.({
      pct: 0.1 + (0.65 * i) / segments.length,
      phase: 'segment',
      segment: i + 1,
      segmentCount: segments.length,
    })
    const segPath = join(tmpDir, `seg-${i}.${ext}`)
    const { filtergraph } = compileFiltergraph(segmentEdit, { segmentIndex: i })
    await ffmpegComplex(inputPath, segPath, filtergraph, format)
    segmentPaths.push(segPath)
  }

  await onProgress?.({ pct: 0.78, phase: 'concat' })
  const concatListPath = join(tmpDir, 'concat.txt')
  const concatBody = segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  await writeFile(concatListPath, concatBody, 'utf8')

  const concatOut = join(tmpDir, `concat.${ext}`)
  await ffmpegConcat(concatListPath, concatOut, format)

  if (edit.loudnorm.enabled) {
    await onProgress?.({ pct: 0.88, phase: 'loudnorm' })
    await applyLoudnormToFile(concatOut, outputPath, edit, format)
  } else {
    const { copyFile } = await import('node:fs/promises')
    await copyFile(concatOut, outputPath)
  }
}

async function renderEditList(
  inputPath: string,
  outputPath: string,
  edit: EditList,
  format: OutputFormat,
  tmpDir: string,
  onProgress?: (update: RenderJobProgress) => Promise<void>,
): Promise<void> {
  if (shouldUseSegmentRender(edit)) {
    await renderSegmented(inputPath, outputPath, edit, format, tmpDir, onProgress)
    return
  }
  await onProgress?.({ pct: 0.35, phase: 'render' })
  await renderSinglePass(inputPath, outputPath, edit, format)
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

  const reportProgress = async (update: RenderJobProgress) => {
    await job.updateProgress(update)
  }

  await prisma.archiveItemVersion.update({
    where: { id: versionId },
    data: { status: 'PROCESSING' },
  })

  const ext = format === 'mp3' ? 'mp3' : format === 'wav' ? 'wav' : 'flac'
  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-render-edit-'))
  const rawKey = `raw/${channelSlug}/${randomUUID()}.${ext}`

  try {
    await reportProgress({ pct: 0.05, phase: 'download' })
    const inputPath = join(tmpDir, 'input')
    const outputPath = join(tmpDir, `rendered.${ext}`)
    await downloadToFile(sourceKey, inputPath)
    await renderEditList(inputPath, outputPath, editList, format, tmpDir, reportProgress)

    await reportProgress({ pct: 0.92, phase: 'upload' })
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

    await reportProgress({ pct: 0.96, phase: 'transcode' })
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

    await reportProgress({ pct: 1, phase: 'done' })
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
