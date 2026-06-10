// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { type VisualPreset } from '@tahti/shared'
import { Alert, Button, Field, Panel } from '@/components/ui'
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
      description="Background visualizer shown when this track plays on the channel page."
    >
      <Field label="Preset">
        <VisualPresetPicker value={preset} onChange={setPreset} disabled={isPending} showPreview />
      </Field>
      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
      <Button type="button" variant="primary" onClick={save} disabled={isPending}>
        {isPending ? 'Saving…' : 'Save'}
      </Button>
    </Panel>
  )
}
