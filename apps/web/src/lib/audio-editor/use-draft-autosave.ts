// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditListV2 } from '@tahti/audio-edit'
import { saveSoundEditListDraft } from '@/app/dashboard/sound-actions'
import { v2ToV1 } from '@/lib/audio-editor/edit-list-convert'
import { formatRelativeSave } from '@/lib/audio-editor/format'

const AUTOSAVE_MS = 2000
const AUTOSAVE_KNOB_MS = 6000

export function useDraftAutosave({
  soundId,
  editList,
  editListRef,
  draftUpdatedAt,
  knobDragging,
  setKnobDragging,
  exportProgress,
}: {
  soundId: string
  editList: EditListV2
  editListRef: React.MutableRefObject<EditListV2>
  draftUpdatedAt: string | null
  knobDragging: boolean
  setKnobDragging: (dragging: boolean) => void
  exportProgress: number | null
}) {
  const [autosaveLabel, setAutosaveLabel] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [draftConflict, setDraftConflict] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(
    draftUpdatedAt ? new Date(draftUpdatedAt).getTime() : null,
  )

  const autosavePendingRef = useRef(false)
  const draftUpdatedAtRef = useRef<string | null>(draftUpdatedAt)

  const flushDraftSave = useCallback(async () => {
    autosavePendingRef.current = true
    const v1 = v2ToV1(editListRef.current)
    const res = await saveSoundEditListDraft(soundId, v1, draftUpdatedAtRef.current)
    autosavePendingRef.current = false
    if (res.conflict) {
      setDraftConflict(true)
      setSaveError(res.error ?? 'Draft conflict')
      if (res.updatedAt) draftUpdatedAtRef.current = res.updatedAt
      return
    }
    if (res.error) {
      setSaveError(res.error)
      return
    }
    setDraftConflict(false)
    setSaveError(null)
    if (res.updatedAt) {
      draftUpdatedAtRef.current = res.updatedAt
      const ts = new Date(res.updatedAt).getTime()
      setLastSavedAt(ts)
      setAutosaveLabel(formatRelativeSave(ts))
    } else {
      const ts = Date.now()
      setLastSavedAt(ts)
      setAutosaveLabel('just now')
    }
  }, [soundId, editListRef])

  useEffect(() => {
    if (!lastSavedAt) return
    setAutosaveLabel(formatRelativeSave(lastSavedAt))
    const t = setInterval(() => setAutosaveLabel(formatRelativeSave(lastSavedAt)), 15000)
    return () => clearInterval(t)
  }, [lastSavedAt])

  useEffect(() => {
    draftUpdatedAtRef.current = draftUpdatedAt
  }, [draftUpdatedAt])

  useEffect(() => {
    if (knobDragging) return
    autosavePendingRef.current = true
    const delay = knobDragging ? AUTOSAVE_KNOB_MS : AUTOSAVE_MS
    const t = setTimeout(() => {
      void flushDraftSave()
    }, delay)
    return () => clearTimeout(t)
  }, [soundId, editList, knobDragging, flushDraftSave])

  useEffect(() => {
    if (!knobDragging) return
    function onPointerUp() {
      setKnobDragging(false)
      void flushDraftSave()
    }
    window.addEventListener('pointerup', onPointerUp)
    return () => window.removeEventListener('pointerup', onPointerUp)
  }, [knobDragging, flushDraftSave, setKnobDragging])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (exportProgress !== null || saveError || autosavePendingRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [exportProgress, saveError, editList])

  return {
    autosaveLabel,
    saveError,
    setSaveError,
    draftConflict,
    lastSavedAt,
    flushDraftSave,
  }
}
