// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { compileFiltergraph } from './compile.js'
import { createDefaultEditList, type EditList } from './types.js'
import { validateEditList } from './validate.js'

function mastered(): EditList {
  const edit = createDefaultEditList(60)
  edit.gainDb = 3
  edit.eq.enabled = true
  edit.comp.enabled = true
  edit.limiter.enabled = true
  edit.filter.enabled = true
  return edit
}

const order = (graph: string, names: string[]) => names.map((name) => graph.indexOf(name))

describe('pluginChain in the render', () => {
  it('keeps the fixed order for drafts without a chain', () => {
    const { filtergraph } = compileFiltergraph(mastered())
    const [filter, gain, eq, comp, lim] = order(filtergraph, [
      'highpass=f=80',
      'volume=3dB',
      'equalizer=',
      'acompressor=',
      'alimiter=',
    ])
    expect(filter).toBeLessThan(gain!)
    expect(gain).toBeLessThan(eq!)
    expect(eq).toBeLessThan(comp!)
    expect(comp).toBeLessThan(lim!)
  })

  it("applies chained plugins after gain, in the user's order", () => {
    const edit = {
      ...mastered(),
      pluginChain: ['limiter', 'comp', 'filter', 'eq'] as EditList['pluginChain'],
    }
    const { filtergraph } = compileFiltergraph(edit)
    const [gain, lim, comp, filter, eq] = order(filtergraph, [
      'volume=3dB',
      'alimiter=',
      'acompressor=',
      'highpass=f=80',
      'equalizer=',
    ])
    expect(gain).toBeLessThan(lim!)
    expect(lim).toBeLessThan(comp!)
    expect(comp).toBeLessThan(filter!)
    expect(filter).toBeLessThan(eq!)
    expect(filtergraph).toMatch(/\[out\]$/)
  })

  it('leaves out plugins that are not in the chain or are disabled', () => {
    const edit = { ...mastered(), pluginChain: ['eq', 'comp'] as EditList['pluginChain'] }
    edit.comp = { ...edit.comp, enabled: false }
    const { filtergraph } = compileFiltergraph(edit)
    expect(filtergraph).toContain('equalizer=')
    expect(filtergraph).not.toContain('acompressor=')
    expect(filtergraph).not.toContain('alimiter=')
    expect(filtergraph).not.toContain('highpass=')
    expect(filtergraph).toContain('[eq]anull[out]')
  })

  it('an empty chain renders no plugins', () => {
    const { filtergraph } = compileFiltergraph({ ...mastered(), pluginChain: [] })
    expect(filtergraph).toContain('[g]anull[out]')
  })
})

describe('schema', () => {
  it('keeps pluginChain and markers through validation (they used to be stripped)', () => {
    const edit = {
      ...mastered(),
      pluginChain: ['comp', 'eq'],
      markers: [{ at: 12.5, label: 'Drop' }, { at: 40 }],
    }
    const result = validateEditList(edit)
    expect(result.ok).toBe(true)
    expect(result.edit?.pluginChain).toEqual(['comp', 'eq'])
    expect(result.edit?.markers).toEqual([{ at: 12.5, label: 'Drop' }, { at: 40 }])
  })

  it('rejects unknown chain plugins', () => {
    expect(validateEditList({ ...mastered(), pluginChain: ['reverb'] }).ok).toBe(false)
  })
})
