// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import Link from 'next/link'
import { Heading, Link as UiLink, Stack, Text } from '@tahti/ui'

export const revalidate = 30

export const metadata: Metadata = {
  title: 'Tahti Radio — live meta-stream',
  description: 'Fair-rotation relay of member channels currently broadcasting live on Tahti.',
}

interface RadioChannel {
  slug: string
  artistName: string
  hlsUrl?: string
}

interface RadioNowPlaying {
  live: boolean
  channel: RadioChannel | null
}

interface RadioHistoryItem {
  slug: string
  artistName: string
  featuredAt: string
}

async function fetchRadio(): Promise<RadioNowPlaying> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/radio`, { next: { revalidate: 30 } })
    if (!res.ok) return { live: false, channel: null }
    return (await res.json()) as RadioNowPlaying
  } catch {
    return { live: false, channel: null }
  }
}

async function fetchHistory(): Promise<RadioHistoryItem[]> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/radio/history`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    return (await res.json()) as RadioHistoryItem[]
  } catch {
    return []
  }
}

export default async function RadioPage() {
  const [now, history] = await Promise.all([fetchRadio(), fetchHistory()])

  return (
    <Stack gap={6} className="brand-section">
      <div>
        <Text size="sm">
          <UiLink href="/">← Home</UiLink>
        </Text>
        <Heading level={1}>Tahti Radio</Heading>
        <Text tone="muted">
          A fair-rotation meta-stream: when members are live, Tahti Radio relays one channel at a
          time. No editorial curation — longest-waiting live channel goes next.
        </Text>
      </div>

      <section className="brand-card">
        <Heading level={2}>Now playing</Heading>
        {now.live && now.channel ? (
          <Stack gap={2}>
            <Text>
              <strong>{now.channel.artistName}</strong> is live on{' '}
              <Link href={`/c/${now.channel.slug}`}>/c/{now.channel.slug}</Link>
            </Text>
            <Text size="sm">
              <Link href={`/c/${now.channel.slug}`}>Open channel →</Link>
            </Text>
          </Stack>
        ) : (
          <Text tone="muted">No member channel is live right now. Check back later.</Text>
        )}
      </section>

      {history.length > 0 ? (
        <section className="brand-card">
          <Heading level={2}>Recently featured</Heading>
          <ul className="brand-section">
            {history.map((item) => (
              <li key={`${item.slug}-${item.featuredAt}`}>
                <Link href={`/c/${item.slug}`}>{item.artistName}</Link>
                <Text size="sm" tone="muted" as="span">
                  {' '}
                  · {new Date(item.featuredAt).toLocaleString()}
                </Text>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Stack>
  )
}
