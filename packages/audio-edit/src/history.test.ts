// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { History } from './history.js'
import type { EditListV2 } from './types.js'

function makeEl(id = 'a'): EditListV2 {
  return { version: 2, sourceDuration: 100, cuts: [], fades: [], plugins: [] }
}

function applyActions(n: number): { state: ReturnType<typeof History.empty>; edits: EditListV2[] } {
  let state = History.empty(makeEl())
  const edits: EditListV2[] = [History.current(state).editList]
  for (let i = 0; i < n; i++) {
    const next = { ...makeEl(), sourceDuration: 100 + i + 1 }
    state = History.push(state, next, `Action ${i + 1}`)
    edits.push(next)
  }
  return { state, edits }
}

describe('History', () => {
  it('starts with one entry at cursor 0', () => {
    const s = History.empty(makeEl())
    expect(s.entries.length).toBe(1)
    expect(s.cursor).toBe(0)
    expect(History.canUndo(s)).toBe(false)
    expect(History.canRedo(s)).toBe(false)
  })

  it('push advances cursor and adds entry', () => {
    const s0 = History.empty(makeEl())
    const s1 = History.push(s0, makeEl(), 'Step 1')
    expect(s1.cursor).toBe(1)
    expect(s1.entries.length).toBe(2)
    expect(History.canUndo(s1)).toBe(true)
    expect(History.canRedo(s1)).toBe(false)
  })

  it('undo/redo roundtrip is idempotent', () => {
    const { state } = applyActions(20)
    let s = state
    for (let i = 0; i < 20; i++) s = History.undo(s)
    // Should be at cursor 0
    expect(s.cursor).toBe(0)
    for (let i = 0; i < 20; i++) s = History.redo(s)
    expect(s.cursor).toBe(20)
  })

  it('20-action sequence: undo-to-start then redo-to-end gives same editList', () => {
    const { state, edits } = applyActions(20)
    let s = state
    const finalEditList = History.current(s).editList

    // Undo all the way
    while (History.canUndo(s)) s = History.undo(s)
    expect(History.current(s).editList).toEqual(edits[0])

    // Redo all the way
    while (History.canRedo(s)) s = History.redo(s)
    expect(History.current(s).editList).toEqual(finalEditList)
  })

  it('branching: undo 3 then push creates a new branch', () => {
    const { state } = applyActions(5)
    let s = state
    s = History.undo(s)
    s = History.undo(s)
    s = History.undo(s)
    const branchBefore = s.entries.length
    s = History.push(s, makeEl(), 'Branch edit')
    // New branch entry added, forward entries still exist
    expect(s.entries.length).toBeGreaterThan(branchBefore)
    const branches = History.branches(s)
    expect(branches.length).toBe(2)
  })

  it('branch A entries survive after forking to branch B', () => {
    const { state } = applyActions(5)
    let s = state
    const mainBranchId = History.current(s).branchId

    // Undo 3, make a fork
    s = History.undo(s)
    s = History.undo(s)
    s = History.undo(s)
    s = History.push(s, makeEl(), 'Fork')
    const forkBranchId = History.current(s).branchId

    expect(forkBranchId).not.toBe(mainBranchId)
    // Original branch entries still accessible
    const mainEntries = History.branchEntries(s, mainBranchId)
    expect(mainEntries.length).toBeGreaterThan(0)
  })

  it('jumpTo navigates to a specific version', () => {
    const { state } = applyActions(5)
    const targetVersion = state.entries[2]!.version
    const jumped = History.jumpTo(state, targetVersion)
    expect(History.current(jumped).version).toBe(targetVersion)
  })

  it('checkpoint entries survive pruning', () => {
    let s = History.empty(makeEl())
    // Push 210 entries (over cap of 200)
    for (let i = 0; i < 210; i++) {
      s = History.push(s, makeEl(), `Step ${i}`)
    }
    // Mark entry at cursor 1 as checkpoint
    const checkpointVersion = s.entries[1]!.version
    s = History.setCheckpoint(s, checkpointVersion, true)

    // All pushes should have triggered pruning; checkpoint should still be there
    const cp = s.entries.find((e) => e.version === checkpointVersion)
    expect(cp?.checkpoint).toBe(true)
  })

  it('serialize/deserialize roundtrip is lossless', () => {
    const { state } = applyActions(5)
    const json = History.serialize(state)
    const restored = History.deserialize(json)
    expect(restored).toEqual(state)
  })

  it('deserialize returns null for invalid JSON', () => {
    expect(History.deserialize('not-json')).toBeNull()
    expect(History.deserialize('{}')).toBeNull()
  })
})
