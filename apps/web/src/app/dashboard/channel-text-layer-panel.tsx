// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CHANNEL_TEXT_LAYER_ALIGN_LABELS,
  CHANNEL_TEXT_LAYER_ALIGNMENTS,
  CHANNEL_TEXT_LAYER_MODE_HINTS,
  CHANNEL_TEXT_LAYER_MODE_LABELS,
  CHANNEL_TEXT_LAYER_MODES,
  CHANNEL_TEXT_LAYER_SOURCE_URL,
  type ChannelTextLayerAlignment,
  type ChannelTextLayerMode,
} from '@tahti/shared'
import { Alert, Button, Field, Input, Link, Panel, Select, Text } from '@/components/ui'
import { updateChannelTextLayer } from './channel-text-layer-actions'

const EFFECT_MODES = CHANNEL_TEXT_LAYER_MODES.filter((m) => m !== 'NONE')

export default function ChannelTextLayerPanel({
  initial,
}: {
  initial: {
    textLayerMode: ChannelTextLayerMode
    textLayerText: string
    textLayerAlign: ChannelTextLayerAlignment
  }
}) {
  const router = useRouter()
  const [textLayerMode, setTextLayerMode] = useState<ChannelTextLayerMode>(initial.textLayerMode)
  const [textLayerText, setTextLayerText] = useState(initial.textLayerText)
  const [textLayerAlign, setTextLayerAlign] = useState<ChannelTextLayerAlignment>(
    initial.textLayerAlign,
  )
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hint = CHANNEL_TEXT_LAYER_MODE_HINTS[textLayerMode]

  function save() {
    setError(null)
    setMessage(null)

    const trimmed = textLayerText.trim()
    if (textLayerMode !== 'NONE' && !trimmed) {
      setError('Enter text to display when a text effect is enabled.')
      return
    }

    startTransition(async () => {
      const res = await updateChannelTextLayer({
        textLayerMode,
        textLayerText: trimmed,
        textLayerAlign,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setMessage('Text layer saved.')
      router.refresh()
    })
  }

  return (
    <Panel
      title="Channel text layer"
      headerTight
      description={
        <>
          Add a stylized headline on your public channel page. Five CSS text effects are inspired by{' '}
          <Link href={CHANNEL_TEXT_LAYER_SOURCE_URL} target="_blank" rel="noopener noreferrer">
            freefrontend.com/css-text-effects
          </Link>
          .
        </>
      }
    >
      <Field label="Text effect" htmlFor="text-layer-mode">
        <Select
          id="text-layer-mode"
          value={textLayerMode}
          disabled={isPending}
          onChange={(e) => setTextLayerMode(e.target.value as ChannelTextLayerMode)}
        >
          <option value="NONE">{CHANNEL_TEXT_LAYER_MODE_LABELS.NONE}</option>
          {EFFECT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {CHANNEL_TEXT_LAYER_MODE_LABELS[mode]}
            </option>
          ))}
        </Select>
      </Field>

      {hint && (
        <Text size="sm" tone="muted" style={{ marginBottom: '1rem' }}>
          {hint}
        </Text>
      )}

      {textLayerMode !== 'NONE' && (
        <>
          <Field
            label="Your text"
            htmlFor="text-layer-text"
            hint="Short headline or tagline (max 120 characters)."
          >
            <Input
              id="text-layer-text"
              value={textLayerText}
              maxLength={120}
              disabled={isPending}
              placeholder="New album out now — listen live"
              onChange={(e) => setTextLayerText(e.target.value)}
            />
          </Field>

          <Field label="Alignment" htmlFor="text-layer-align">
            <Select
              id="text-layer-align"
              value={textLayerAlign}
              disabled={isPending}
              onChange={(e) => setTextLayerAlign(e.target.value as ChannelTextLayerAlignment)}
            >
              {CHANNEL_TEXT_LAYER_ALIGNMENTS.map((align) => (
                <option key={align} value={align}>
                  {CHANNEL_TEXT_LAYER_ALIGN_LABELS[align]}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Button type="button" variant="primary" onClick={save} disabled={isPending}>
        {isPending ? 'Saving…' : 'Save text layer'}
      </Button>
    </Panel>
  )
}
