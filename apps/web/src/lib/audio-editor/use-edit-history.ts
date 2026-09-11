// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback } from 'react'
import type { EditListV2, HistoryState } from '@tahti/audio-edit'
import { History } from '@tahti/audio-edit'

export function useEditHistory(
  setHistoryState: React.Dispatch<React.SetStateAction<HistoryState>>,
) {
  const pushEdit = useCallback(
    (next: EditListV2, label = 'Edit') => {
      setHistoryState((s) => History.push(s, next, label))
    },
    [setHistoryState],
  )

  const undo = useCallback(() => {
    setHistoryState((s) => (History.canUndo(s) ? History.undo(s) : s))
  }, [setHistoryState])

  const redo = useCallback(() => {
    setHistoryState((s) => (History.canRedo(s) ? History.redo(s) : s))
  }, [setHistoryState])

  const patchPlugin = useCallback(
    (instanceId: string, params: unknown) => {
      setHistoryState((s) => {
        const cur = History.current(s).editList
        const next: EditListV2 = {
          ...cur,
          plugins: cur.plugins.map((p) => (p.instanceId === instanceId ? { ...p, params } : p)),
        }
        return History.push(s, next, 'Plugin param')
      })
    },
    [setHistoryState],
  )

  const togglePlugin = useCallback(
    (instanceId: string, enabled: boolean) => {
      setHistoryState((s) => {
        const cur = History.current(s).editList
        const next: EditListV2 = {
          ...cur,
          plugins: cur.plugins.map((p) => (p.instanceId === instanceId ? { ...p, enabled } : p)),
        }
        return History.push(s, next, enabled ? 'Enable plugin' : 'Bypass plugin')
      })
    },
    [setHistoryState],
  )

  return { pushEdit, undo, redo, patchPlugin, togglePlugin }
}
