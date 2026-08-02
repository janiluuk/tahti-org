'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Callout, Text } from '@tahti/ui'
import type { GreenRoomAccessView } from '@tahti/shared'
import HlsPlayer from '@/app/c/[slug]/hls-player'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

export function GreenRoomGuestView({
  channelSlug,
  artistUsername,
}: {
  channelSlug: string
  artistUsername: string
}) {
  const [access, setAccess] = useState<GreenRoomAccessView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/me/green-room/${channelSlug}`, {
          credentials: 'include',
        })
        if (cancelled) return
        if (res.status === 401) {
          setError('log in')
          setLoading(false)
          return
        }
        if (!res.ok) {
          setError('Could not load green room access')
          setLoading(false)
          return
        }
        const data = (await res.json()) as GreenRoomAccessView
        setAccess(data)
        if (data.hasAccess && !data.joinedAt) {
          const joinRes = await fetch(`${API_BASE}/api/me/green-room/${channelSlug}/join`, {
            method: 'POST',
            credentials: 'include',
          })
          if (joinRes.ok && !cancelled) {
            setAccess((await joinRes.json()) as GreenRoomAccessView)
          }
        }
      } catch {
        if (!cancelled) setError('Could not load green room access')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [channelSlug])

  if (loading) {
    return (
      <Text as="p" tone="muted">
        Checking green room access…
      </Text>
    )
  }

  if (error === 'log in') {
    return (
      <Callout label="Sign in required" variant="cyan">
        <Link href={`/login?next=/u/${artistUsername}/green-room`}>Log in</Link> to join this green
        room.
      </Callout>
    )
  }

  if (error || !access) {
    return (
      <Callout label="Unavailable" variant="amber">
        {error ?? 'Green room unavailable'}
      </Callout>
    )
  }

  if (!access.greenRoomEnabled) {
    return (
      <Callout label="Not open yet" variant="cyan">
        {access.artistDisplayName} has not opened the green room for this broadcast yet.
      </Callout>
    )
  }

  if (!access.hasAccess) {
    return (
      <Callout label="Invite required" variant="amber">
        You are not on the guest list for {access.artistDisplayName}&apos;s green room.
      </Callout>
    )
  }

  if (access.channelState === 'LIVE') {
    return (
      <Callout label="On air" variant="green">
        {access.artistDisplayName} is now live.{' '}
        <Link href={`/c/${channelSlug}`}>Tune in on the public channel →</Link>
      </Callout>
    )
  }

  if (access.channelState !== 'PREVIEW' || !access.hlsUrl) {
    return (
      <Callout label="Waiting for preview" variant="cyan">
        The green room opens when {access.artistDisplayName} starts their preview stream.
      </Callout>
    )
  }

  return (
    <div className="green-room-guest">
      <Text as="p" tone="muted" size="sm" className="green-room-guest__lead">
        You are in the green room — listen to the preview stream before the show goes public.
      </Text>
      <HlsPlayer url={access.hlsUrl} title={`${access.artistDisplayName} — green room preview`} />
    </div>
  )
}
