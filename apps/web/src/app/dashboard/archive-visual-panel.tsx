// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  VISUAL_PRESETS,
  VISUAL_PRESET_LABELS,
  VISUAL_PRESET_DESCRIPTIONS,
  type VisualPreset,
} from '@tahti/shared'
import { Alert, Button, Field, Panel, Select, Text } from '@/components/ui'
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
      if (res.error) { setError(res.error); return }
      setMessage('Saved.')
      router.refresh()
    })
  }

  return (
    <Panel title="Visualizer" headerTight description="Background visualizer shown when this track plays on the channel page.">
      <Field label="Preset" htmlFor="archive-visual-preset">
        <Select
          id="archive-visual-preset"
          value={preset}
          disabled={isPending}
          onChange={(e) => setPreset(e.target.value as VisualPreset)}
        >
          {VISUAL_PRESETS.map((p) => (
            <option key={p} value={p}>{VISUAL_PRESET_LABELS[p]}</option>
          ))}
        </Select>
      </Field>
      {preset !== 'MINIMAL' && (
        <Text size="sm" tone="muted" className="studio-mb-lg">{VISUAL_PRESET_DESCRIPTIONS[preset]}</Text>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
      <Button type="button" variant="primary" onClick={save} disabled={isPending}>
        {isPending ? 'Saving…' : 'Save'}
      </Button>
    </Panel>
  )
}
