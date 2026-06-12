// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FFmpeg } from '@ffmpeg/ffmpeg'
import type { EditList, LoudnormMeasured, OutputFormat } from '@tahti/audio-edit'
import {
  buildPeaksPyramid,
  compileFiltergraph,
  compileLoudnormPass1Filter,
  compileOutputArgs,
  PEAK_DECODE_SAMPLE_RATE,
} from '@tahti/audio-edit'

const CORE_VERSION = '0.12.10'

async function coreUrls(multiThread: boolean) {
  const { toBlobURL } = await import('@ffmpeg/util')
  const base = multiThread
    ? `https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@${CORE_VERSION}/dist/esm`
    : `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`
  return {
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: multiThread
      ? await toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript')
      : undefined,
  }
}

export async function loadFfmpeg(
  onProgress?: (ratio: number) => void,
  onLog?: (line: string) => void,
): Promise<FFmpeg> {
  const multiThread = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated
  const { FFmpeg: FfmpegCtor } = await import('@ffmpeg/ffmpeg')
  const ffmpeg = new FfmpegCtor()
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => onProgress(progress))
  }
  if (onLog) {
    ffmpeg.on('log', ({ message }) => onLog(message))
  }
  await ffmpeg.load(await coreUrls(multiThread))
  return ffmpeg
}

export async function fetchSourceFile(url: string, filename = 'source.flac'): Promise<File> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch source audio (${res.status})`)
  const blob = await res.blob()
  return new File([blob], filename, { type: blob.type || 'audio/flac' })
}

export async function mountSourceFile(ffmpeg: FFmpeg, file: File): Promise<string> {
  await ffmpeg.createDir('/in').catch(() => undefined)
  await ffmpeg.mount('WORKERFS', { files: [file] }, '/in')
  return `/in/${file.name}`
}

export async function unmountSource(ffmpeg: FFmpeg): Promise<void> {
  await ffmpeg.unmount('/in').catch(() => undefined)
}

function parseLoudnormJson(log: string): LoudnormMeasured | null {
  const start = log.indexOf('{')
  const end = log.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const raw = JSON.parse(log.slice(start, end + 1)) as Record<string, string>
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

/** Pass 1: measure integrated loudness on the full edit chain. */
export async function measureLoudnorm(
  ffmpeg: FFmpeg,
  edit: EditList,
  inputPath: string,
): Promise<LoudnormMeasured | null> {
  const pass1 = compileLoudnormPass1Filter(edit)
  if (!pass1) return null

  const base = compileFiltergraph({ ...edit, loudnorm: { ...edit.loudnorm, measured: undefined } })
  const graph = base.filtergraph.replace(/loudnorm=I=[^[]+\[out\]/, `${pass1}[out]`)

  const logs: string[] = []
  const handler = ({ message }: { message: string }) => logs.push(message)
  ffmpeg.on('log', handler)
  try {
    await ffmpeg.exec([
      '-i',
      inputPath,
      '-filter_complex',
      graph,
      '-map',
      '[out]',
      '-f',
      'null',
      '-',
    ])
  } finally {
    ffmpeg.off('log', handler)
  }

  for (let i = logs.length - 1; i >= 0; i--) {
    const parsed = parseLoudnormJson(logs[i]!)
    if (parsed) return parsed
  }
  return null
}

export async function renderEditToFile(
  ffmpeg: FFmpeg,
  edit: EditList,
  inputPath: string,
  format: OutputFormat,
  sampleRate?: number,
): Promise<Uint8Array> {
  const { filtergraph } = compileFiltergraph(edit)
  const { codecArgs, ar } = compileOutputArgs(format, sampleRate)
  const outName = `out.${format === 'mp3' ? 'mp3' : format === 'wav' ? 'wav' : 'flac'}`

  const args = ['-i', inputPath, '-filter_complex', filtergraph, '-map', '[out]', ...codecArgs]
  if (ar) args.push('-ar', String(ar))
  args.push(outName)

  await ffmpeg.exec(args)
  const data = await ffmpeg.readFile(outName)
  await ffmpeg.deleteFile(outName).catch(() => undefined)
  return data as Uint8Array
}

export async function generatePeaksFromFfmpeg(
  ffmpeg: FFmpeg,
  inputPath: string,
  durationSec: number,
) {
  const pcmName = 'peaks.pcm'
  await ffmpeg.exec([
    '-i',
    inputPath,
    '-ac',
    '1',
    '-ar',
    String(PEAK_DECODE_SAMPLE_RATE),
    '-f',
    's16le',
    pcmName,
  ])
  const pcm = (await ffmpeg.readFile(pcmName)) as Uint8Array
  await ffmpeg.deleteFile(pcmName).catch(() => undefined)
  return buildPeaksPyramid(pcm, durationSec)
}
