// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const EditCutSchema = z.object({
  start: z.number().min(0),
  end: z.number().positive(),
})

export const EditFadeSchema = z.object({
  type: z.enum(['in', 'out']),
  at: z.number().min(0),
  duration: z.number().min(0).max(120),
  curve: z.enum(['tri', 'exp']).default('tri'),
})

export const EditEqBandSchema = z.object({
  freq: z.number().min(20).max(20000),
  gainDb: z.number().min(-24).max(24),
  q: z.number().min(0.1).max(10),
})

export const EditEqSchema = z.object({
  enabled: z.boolean(),
  bands: z.array(EditEqBandSchema).max(3),
})

export const EditCompSchema = z.object({
  enabled: z.boolean(),
  thresholdDb: z.number().min(-60).max(0),
  ratio: z.number().min(1).max(20),
  attackMs: z.number().min(0.1).max(500),
  releaseMs: z.number().min(1).max(5000),
  makeupDb: z.number().min(0).max(24),
})

export const LoudnormMeasuredSchema = z.object({
  i: z.number(),
  tp: z.number(),
  lra: z.number(),
  thresh: z.number(),
})

export const EditLoudnormSchema = z.object({
  enabled: z.boolean(),
  targetLufs: z.number().min(-30).max(-5).default(-14),
  targetTp: z.number().min(-6).max(0).default(-1.5),
  measured: LoudnormMeasuredSchema.optional(),
})

export const EditLimiterSchema = z.object({
  enabled: z.boolean(),
  ceilingDb: z.number().min(-3).max(0),
  releaseMs: z.number().min(1).max(1000),
})

export const EditListSchema = z.object({
  version: z.literal(1),
  sourceDuration: z.number().positive(),
  cuts: z.array(EditCutSchema),
  fades: z.array(EditFadeSchema),
  gainDb: z.number().min(-24).max(24),
  eq: EditEqSchema,
  comp: EditCompSchema,
  limiter: EditLimiterSchema.default({ enabled: false, ceilingDb: -1, releaseMs: 50 }),
  loudnorm: EditLoudnormSchema,
})

export type EditCut = z.infer<typeof EditCutSchema>
export type EditFade = z.infer<typeof EditFadeSchema>
export type EditEqBand = z.infer<typeof EditEqBandSchema>
export type EditEq = z.infer<typeof EditEqSchema>
export type EditComp = z.infer<typeof EditCompSchema>
export type EditLimiter = z.infer<typeof EditLimiterSchema>
export type LoudnormMeasured = z.infer<typeof LoudnormMeasuredSchema>
export type EditLoudnorm = z.infer<typeof EditLoudnormSchema>
export type EditList = z.infer<typeof EditListSchema>

export interface KeepSegment {
  start: number
  end: number
}

export type OutputFormat = 'flac' | 'mp3' | 'wav'

export interface CompileOptions {
  inputLabel?: string
  sampleRate?: number
  outputFormat?: OutputFormat
  segmentIndex?: number
}

export interface CompiledGraph {
  filtergraph: string
  outputLabel: string
  postCutDurationSec: number
  keepSegments: KeepSegment[]
  loudnormPass1Filter?: string
}

export const DEFAULT_EQ_BANDS: EditEqBand[] = [
  { freq: 80, gainDb: 0, q: 1 },
  { freq: 1200, gainDb: 0, q: 1 },
  { freq: 9000, gainDb: 0, q: 1 },
]

export const DEFAULT_COMP: EditComp = {
  enabled: false,
  thresholdDb: -18,
  ratio: 3,
  attackMs: 25,
  releaseMs: 250,
  makeupDb: 0,
}

export const DEFAULT_LIMITER: EditLimiter = {
  enabled: false,
  ceilingDb: -1,
  releaseMs: 50,
}

export function createDefaultEditList(sourceDuration: number): EditList {
  return {
    version: 1,
    sourceDuration,
    cuts: [],
    fades: [],
    gainDb: 0,
    eq: { enabled: false, bands: DEFAULT_EQ_BANDS.map((b) => ({ ...b })) },
    comp: { ...DEFAULT_COMP },
    limiter: { ...DEFAULT_LIMITER },
    loudnorm: { enabled: false, targetLufs: -14, targetTp: -1.5 },
  }
}

export const BROWSER_RENDER_MAX_BYTES = 600 * 1024 * 1024

/** Pyramid level sample rates (samples per pixel bucket at 1280px width). */
export const PEAK_PYRAMID_LEVELS = [8000, 2000, 500, 125, 32] as const

export interface PeaksPyramid {
  sampleRate: number
  durationSec: number
  levels: number[][]
}
