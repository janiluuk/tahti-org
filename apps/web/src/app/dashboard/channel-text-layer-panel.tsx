// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState, useTransition } from 'react'
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
import { Panel } from '@tahti/ui'
import { updateChannelTextLayer } from './channel-text-layer-actions'

const EFFECT_MODES = CHANNEL_TEXT_LAYER_MODES.filter((m) => m !== 'NONE')

export default function ChannelTextLayerPanel({
  initial,
  bare = false,
  onDraftChange,
}: {
  initial: {
    textLayerMode: ChannelTextLayerMode
    textLayerText: string
    textLayerAlign: ChannelTextLayerAlignment
  }
  bare?: boolean
  /** Fires on every edit (before save) so a live preview can mirror the draft. */
  onDraftChange?: (draft: {
    textLayerMode: ChannelTextLayerMode
    textLayerText: string
    textLayerAlign: ChannelTextLayerAlignment
  }) => void
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

  useEffect(() => {
    onDraftChange?.({ textLayerMode, textLayerText, textLayerAlign })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textLayerMode, textLayerText, textLayerAlign])

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

  const form = (
    <>
      <label className="studio-field" htmlFor="text-layer-mode">
        <span className="studio-label">Text effect</span>
        <select
          id="text-layer-mode"
          value={textLayerMode}
          disabled={isPending}
          onChange={(e) => setTextLayerMode(e.target.value as ChannelTextLayerMode)}
          className="studio-input"
        >
          <option value="NONE">{CHANNEL_TEXT_LAYER_MODE_LABELS.NONE}</option>
          {EFFECT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {CHANNEL_TEXT_LAYER_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>

      {hint && <p className="studio-text-muted-sm studio-mb-lg studio-m-0">{hint}</p>}

      {textLayerMode !== 'NONE' && (
        <>
          <label className="studio-field" htmlFor="text-layer-text">
            <span className="studio-label">Your text</span>
            <span className="studio-text-muted-sm studio-mb-sm">
              Short headline or tagline (max 120 characters).
            </span>
            <input
              id="text-layer-text"
              type="text"
              value={textLayerText}
              maxLength={120}
              disabled={isPending}
              placeholder="New album out now — listen live"
              onChange={(e) => setTextLayerText(e.target.value)}
              className="studio-input"
            />
          </label>

          <label className="studio-field" htmlFor="text-layer-align">
            <span className="studio-label">Alignment</span>
            <select
              id="text-layer-align"
              value={textLayerAlign}
              disabled={isPending}
              onChange={(e) => setTextLayerAlign(e.target.value as ChannelTextLayerAlignment)}
              className="studio-input"
            >
              {CHANNEL_TEXT_LAYER_ALIGNMENTS.map((align) => (
                <option key={align} value={align}>
                  {CHANNEL_TEXT_LAYER_ALIGN_LABELS[align]}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {error && <p className="studio-notice studio-notice--error">{error}</p>}
      {message && <p className="studio-notice studio-notice--success">{message}</p>}

      <button type="button" className="ui-btn ui-btn--primary" onClick={save} disabled={isPending}>
        {isPending ? 'Saving…' : 'Save text layer'}
      </button>
    </>
  )

  if (bare) return form

  return (
    <Panel
      title="Channel text layer"
      headerTight
      description={
        <>
          Add a stylized headline on your public channel page. Five CSS text effects are inspired by{' '}
          <a href={CHANNEL_TEXT_LAYER_SOURCE_URL} target="_blank" rel="noopener noreferrer">
            freefrontend.com/css-text-effects
          </a>
          .
        </>
      }
    >
      {form}
    </Panel>
  )
}
