'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { goLive } from '@/app/dashboard/actions'

/** Artists may open the broadcast studio / promote PREVIEW→LIVE from their
 *  show page starting 30 minutes before a booked slot through the slot end. */
const GO_LIVE_EARLY_MS = 30 * 60 * 1000

type EpisodeWindow = { startAt: string; endAt: string }

function findOpenWindow(episodes: EpisodeWindow[], nowMs: number): EpisodeWindow | null {
  for (const ep of episodes) {
    const start = new Date(ep.startAt).getTime()
    const end = new Date(ep.endAt).getTime()
    if (Number.isNaN(start) || Number.isNaN(end)) continue
    if (nowMs >= start - GO_LIVE_EARLY_MS && nowMs < end) return ep
  }
  return null
}

function formatMinutesUntil(targetMs: number, nowMs: number): string {
  const mins = Math.max(0, Math.ceil((targetMs - nowMs) / 60_000))
  if (mins <= 0) return 'now'
  if (mins === 1) return 'in 1 minute'
  return `in ${mins} minutes`
}

export function ShowOwnerGoLiveCta({
  initialChannelState,
  episodes,
}: {
  initialChannelState: string | null
  episodes: EpisodeWindow[]
}) {
  const router = useRouter()
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [channelState, setChannelState] = useState(initialChannelState)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setChannelState(initialChannelState)
  }, [initialChannelState])

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  async function handleGoLive() {
    setLoading(true)
    try {
      const result = await goLive()
      if (result.ok) {
        setChannelState('LIVE')
        router.refresh()
      } else {
        alert(result.error ?? 'Could not go live')
      }
    } finally {
      setLoading(false)
    }
  }

  const windowEp = findOpenWindow(episodes, nowMs)
  if (!windowEp) return null

  const startMs = new Date(windowEp.startAt).getTime()
  const beforeStart = nowMs < startMs
  const hint = beforeStart
    ? `Your Tahti Radio slot opens ${formatMinutesUntil(startMs, nowMs)}. You can go live from here.`
    : 'Your Tahti Radio slot is on now. Go live when your encoder is connected.'

  if (channelState === 'LIVE') {
    return (
      <div className="ch-radio-show-go-live">
        <NextLink href="/dashboard/broadcast" className="ch-radio-show-go-live__btn is-live">
          On air — open studio
        </NextLink>
        <p className="ch-radio-show-go-live__hint">
          You&apos;re live. Manage the show from the studio.
        </p>
      </div>
    )
  }

  if (channelState === 'PREVIEW') {
    return (
      <div className="ch-radio-show-go-live">
        <button
          type="button"
          className="ch-radio-show-go-live__btn is-preview"
          onClick={() => void handleGoLive()}
          disabled={loading}
        >
          {loading ? 'Going live…' : 'Go live now'}
        </button>
        <p className="ch-radio-show-go-live__hint">{hint}</p>
      </div>
    )
  }

  return (
    <div className="ch-radio-show-go-live">
      <NextLink href="/dashboard/broadcast" className="ch-radio-show-go-live__btn">
        Go live
      </NextLink>
      <p className="ch-radio-show-go-live__hint">{hint}</p>
    </div>
  )
}
