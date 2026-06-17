// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { CompileCtx, FilterStep, MeasuredLoudness } from '../types.js'

import {
  GainParamsSchema,
  DEFAULT_GAIN_PARAMS,
  compileGain,
  gainChainSummary,
  gainLoudnormPass1Filter,
} from './gain/index.js'
import type { GainParams } from './gain/index.js'

import { EqParamsSchema, DEFAULT_EQ_PARAMS, compileEq, eqChainSummary } from './eq/index.js'
import type { EqBand, EqParams } from './eq/index.js'

import {
  CompParamsSchema,
  DEFAULT_COMP_PARAMS,
  compileComp,
  compChainSummary,
} from './comp/index.js'
import type { CompParams } from './comp/index.js'

import {
  LimiterParamsSchema,
  DEFAULT_LIMITER_PARAMS,
  compileLimiter,
  limiterChainSummary,
} from './limiter/index.js'
import type { LimiterParams } from './limiter/index.js'

import type { z } from 'zod'

export interface Plugin<P> {
  id: string
  name: string
  defaultParams: P
  paramsSchema: z.ZodType<P>
  compile(params: P, ctx: CompileCtx): FilterStep | null
  /** Returns the loudnorm pass-1 filter string when this plugin requests it, else undefined. */
  loudnormPass1Filter?(params: P): string | undefined
  /** Compact one-line summary shown in the chain strip. */
  chainSummary(params: P, enabled: boolean): string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPlugin = Plugin<any>

const gainPlugin: Plugin<GainParams> = {
  id: 'gain',
  name: 'Gain & Normalize',
  defaultParams: DEFAULT_GAIN_PARAMS,
  paramsSchema: GainParamsSchema,
  compile: compileGain,
  loudnormPass1Filter: gainLoudnormPass1Filter,
  chainSummary: gainChainSummary,
}

const eqPlugin: Plugin<EqParams> = {
  id: 'eq',
  name: 'EQ — 3 band',
  defaultParams: DEFAULT_EQ_PARAMS,
  paramsSchema: EqParamsSchema,
  compile: compileEq,
  chainSummary: eqChainSummary,
}

const compPlugin: Plugin<CompParams> = {
  id: 'comp',
  name: 'Compressor',
  defaultParams: DEFAULT_COMP_PARAMS,
  paramsSchema: CompParamsSchema,
  compile: compileComp,
  chainSummary: compChainSummary,
}

const limiterPlugin: Plugin<LimiterParams> = {
  id: 'limiter',
  name: 'Limiter',
  defaultParams: DEFAULT_LIMITER_PARAMS,
  paramsSchema: LimiterParamsSchema,
  compile: compileLimiter,
  chainSummary: limiterChainSummary,
}

export const PLUGINS = {
  gain: gainPlugin,
  eq: eqPlugin,
  comp: compPlugin,
  limiter: limiterPlugin,
  // future plugins go here
} as const satisfies Record<string, AnyPlugin>

export type PluginId = keyof typeof PLUGINS

export type { GainParams, EqParams, EqBand, CompParams, LimiterParams, MeasuredLoudness }
export { DEFAULT_GAIN_PARAMS, DEFAULT_EQ_PARAMS, DEFAULT_COMP_PARAMS, DEFAULT_LIMITER_PARAMS }
