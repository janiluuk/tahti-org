// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SLIDESHOW_PRESETS, SLIDESHOW_PRESET_LABELS, type SlideshowPreset } from '@tahti/shared'
import { ButtonIcon, Panel } from '@tahti/ui'
import { updateChannelVisual } from './channel-visual-actions'

export type ChannelSlideshowDraft = {
  slideshowPreset: SlideshowPreset
  slideshowIntervalSeconds: number
  slideshowTransitionMs: number
  slideshowAutoplay: boolean
}

interface Props {
  initial: ChannelSlideshowDraft
  bare?: boolean
  onDraftChange?: (draft: ChannelSlideshowDraft) => void
}

/** Applies when the channel gallery cycles through images — lives alongside the gallery, not Visual style. */
export default function ChannelSlideshowPanel({ initial, bare = false, onDraftChange }: Props) {
  const router = useRouter()
  const [slideshowPreset, setSlideshowPreset] = useState<SlideshowPreset>(initial.slideshowPreset)
  const [interval, setInterval] = useState(initial.slideshowIntervalSeconds)
  const [transition, setTransition] = useState(initial.slideshowTransitionMs)
  const [autoplay, setAutoplay] = useState(initial.slideshowAutoplay)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    onDraftChange?.({
      slideshowPreset,
      slideshowIntervalSeconds: interval,
      slideshowTransitionMs: transition,
      slideshowAutoplay: autoplay,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideshowPreset, interval, transition, autoplay])

  function save() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await updateChannelVisual({
        slideshowPreset,
        slideshowIntervalSeconds: interval,
        slideshowTransitionMs: transition,
        slideshowAutoplay: autoplay,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setMessage('Slideshow settings saved.')
      router.refresh()
    })
  }

  const form = (
    <>
      <div
        className="slideshow-preset-picker__grid"
        role="radiogroup"
        aria-label="Slideshow transition style"
      >
        {SLIDESHOW_PRESETS.map((p) => {
          const active = slideshowPreset === p
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={isPending}
              className={`slideshow-preset-picker__card${active ? ' slideshow-preset-picker__card--active' : ''}`}
              onClick={() => setSlideshowPreset(p)}
            >
              {SLIDESHOW_PRESET_LABELS[p]}
            </button>
          )
        })}
      </div>

      <label className="studio-field" htmlFor="slideshow-interval">
        <span className="studio-label">Interval: {interval}s</span>
        <input
          id="slideshow-interval"
          type="range"
          min={5}
          max={30}
          step={1}
          value={interval}
          disabled={isPending}
          onChange={(e) => setInterval(Number(e.target.value))}
          className="studio-range"
        />
      </label>

      <label className="studio-field" htmlFor="slideshow-transition">
        <span className="studio-label">Transition speed: {transition}ms</span>
        <input
          id="slideshow-transition"
          type="range"
          min={300}
          max={1500}
          step={100}
          value={transition}
          disabled={isPending}
          onChange={(e) => setTransition(Number(e.target.value))}
          className="studio-range"
        />
      </label>

      <label className="studio-social-toggle">
        <input
          id="slideshow-autoplay"
          type="checkbox"
          checked={autoplay}
          disabled={isPending}
          onChange={(e) => setAutoplay(e.target.checked)}
        />
        <span>Automatically advance slides</span>
      </label>

      {error && <p className="studio-notice studio-notice--error">{error}</p>}
      {message && <p className="studio-notice studio-notice--success">{message}</p>}

      <div className="studio-actions studio-mt-md">
        <button
          type="button"
          className="ui-btn ui-btn--primary"
          onClick={save}
          disabled={isPending}
        >
          <ButtonIcon name="save" />
          {isPending ? 'Saving…' : 'Save slideshow'}
        </button>
      </div>
    </>
  )

  if (bare) return form

  return (
    <Panel
      title="Slideshow transition"
      headerTight
      description="Applies when your channel gallery cycles through images."
    >
      {form}
    </Panel>
  )
}
