// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { EditListV2 } from './types.js'

const HISTORY_CAP = 200

export interface HistoryEntry {
  version: number
  editList: EditListV2
  timestamp: number
  label: string
  branchId: string
  checkpoint?: boolean
}

export interface HistoryState {
  entries: HistoryEntry[]
  /** Index of the current entry (the "now" pointer). */
  cursor: number
}

function emptyHistory(initial: EditListV2): HistoryState {
  return {
    entries: [
      {
        version: 1,
        editList: initial,
        timestamp: Date.now(),
        label: 'Initial',
        branchId: 'main',
      },
    ],
    cursor: 0,
  }
}

function currentEntry(state: HistoryState): HistoryEntry {
  return state.entries[state.cursor]!
}

/**
 * Push a new state onto the history. If cursor is behind the tail, the
 * forward entries are NOT discarded — they become an alternate branch.
 * Returns the updated HistoryState.
 */
function push(state: HistoryState, editList: EditListV2, label: string): HistoryState {
  const prev = currentEntry(state)

  // If we're not at the tail, fork a new branch for the new edit.
  const isFork = state.cursor < state.entries.length - 1
  const branchId = isFork ? `branch-${Date.now()}` : prev.branchId

  const next: HistoryEntry = {
    version: prev.version + 1,
    editList,
    timestamp: Date.now(),
    label,
    branchId,
  }

  const newEntries = [
    ...state.entries.slice(0, state.cursor + 1),
    next,
    ...state.entries.slice(state.cursor + 1),
  ]
  const pruned = pruneEntries(newEntries)
  const newCursor = pruned.indexOf(next)

  return {
    entries: pruned,
    cursor: newCursor < 0 ? pruned.length - 1 : newCursor,
  }
}

function undo(state: HistoryState): HistoryState {
  if (state.cursor === 0) return state
  return { ...state, cursor: state.cursor - 1 }
}

function redo(state: HistoryState): HistoryState {
  // Redo goes to the next entry on the same branch, skipping forks.
  const currentBranch = currentEntry(state).branchId
  for (let i = state.cursor + 1; i < state.entries.length; i++) {
    if (state.entries[i]!.branchId === currentBranch) {
      return { ...state, cursor: i }
    }
  }
  // If no same-branch entry, go to next entry regardless
  if (state.cursor < state.entries.length - 1) {
    return { ...state, cursor: state.cursor + 1 }
  }
  return state
}

function jumpTo(state: HistoryState, version: number): HistoryState {
  const idx = state.entries.findIndex((e) => e.version === version)
  if (idx < 0) return state
  return { ...state, cursor: idx }
}

function setCheckpoint(state: HistoryState, version: number, on: boolean): HistoryState {
  return {
    ...state,
    entries: state.entries.map((e) => (e.version === version ? { ...e, checkpoint: on } : e)),
  }
}

/** Cap at HISTORY_CAP entries, dropping oldest non-checkpoint entries first. */
function pruneEntries(entries: HistoryEntry[]): HistoryEntry[] {
  if (entries.length <= HISTORY_CAP) return entries
  const toRemove = entries.length - HISTORY_CAP
  let removed = 0
  return entries.filter((e, i) => {
    if (i === 0) return true // always keep initial
    if (!e.checkpoint && removed < toRemove) {
      removed++
      return false
    }
    return true
  })
}

/** Serialize HistoryState to JSON string (for persistence). */
function serialize(state: HistoryState): string {
  return JSON.stringify(state)
}

/** Deserialize HistoryState from JSON string. Returns null on parse failure. */
function deserialize(json: string): HistoryState | null {
  try {
    const parsed = JSON.parse(json) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'entries' in parsed &&
      'cursor' in parsed &&
      Array.isArray((parsed as HistoryState).entries)
    ) {
      return parsed as HistoryState
    }
    return null
  } catch {
    return null
  }
}

export const History = {
  empty: emptyHistory,
  current: currentEntry,
  push,
  undo,
  redo,
  jumpTo,
  setCheckpoint,
  serialize,
  deserialize,
  canUndo: (s: HistoryState) => s.cursor > 0,
  canRedo: (s: HistoryState) => s.cursor < s.entries.length - 1,
  /** All branches visible in the history panel. */
  branches: (s: HistoryState): string[] => [...new Set(s.entries.map((e) => e.branchId))],
  /** Entries on the given branch, oldest-first. */
  branchEntries: (s: HistoryState, branchId: string) =>
    s.entries.filter((e) => e.branchId === branchId),
}
