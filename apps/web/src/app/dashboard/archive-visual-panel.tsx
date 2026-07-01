// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { type VisualPreset } from '@tahti/shared'
import { ButtonIcon, Panel } from '@tahti/ui'
import { VisualPresetPicker } from '@/components/visuals/visual-preset-picker'
import { updateArchiveItemVisual } from './channel-visual-actions'

interface Props {
  itemId: string
  initial: { visualPreset: VisualPreset }
}

export default function ArchiveVisualPanel({ itemId, initial }: Props) {
  const router = useRouter()
  const [preset, setPreset] = useState<VisualPreset>(initial.visualPreset)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await updateArchiveItemVisual(itemId, { visualPreset: preset })
      if (res.error) {
        setError(res.error)
        return
      }
      setMessage('Saved.')
      router.refresh()
    })
  }

  return (
    <Panel
      title="Visualizer"
      headerTight
      description="Background visualizer when this track plays on your channel."
    >
      <div className="studio-field--block">
        <span className="studio-label">Preset</span>
        <VisualPresetPicker value={preset} onChange={setPreset} disabled={isPending} showPreview />
      </div>
      {error && <p className="studio-notice studio-notice--error">{error}</p>}
      {message && <p className="studio-notice studio-notice--success">{message}</p>}
      <button type="button" className="ui-btn ui-btn--primary" onClick={save} disabled={isPending}>
        <ButtonIcon name="save" />
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </Panel>
  )
}
