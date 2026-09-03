'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import { Button } from '@tahti/ui'
import type { BroadcastShowType } from '@tahti/shared'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

interface RtmpTarget {
  id: string
  provider: string
  label: string
  enabled: boolean
}

interface PlannedRadioShow {
  bookingId: string
  startAt: string
  endAt: string
  episodeNumber: number
  tagline: string | null
  showType: BroadcastShowType
}

interface PlannedLiveShow {
  scheduledShowId: string
  seriesId: string
  startAt: string
  episodeNumber: number | null
  title: string
  tagline: string | null
  showType: BroadcastShowType
  artworkUrl: string | null
}

interface ShowSeriesOption {
  id: string
  name: string
  nextEpisodeNumber: number
  episodeNumberEnabled: boolean
  showType: BroadcastShowType
}

interface Preflight {
  title: string | null
  visibility: 'PUBLIC' | 'FAN_ONLY'
  autoPublish: boolean
  showType: BroadcastShowType
  episodeNumber: number | null
  tagline: string | null
  plannedRadioShow: PlannedRadioShow | null
  plannedLiveShow: PlannedLiveShow | null
}

export function Step3Preflight() {
  const [preflight, setPreflight] = useState<Preflight | null>(null)
  const [title, setTitle] = useState('')
  const [tagline, setTagline] = useState('')
  const [targets, setTargets] = useState<RtmpTarget[] | null>(null)
  const [pinText, setPinText] = useState('')
  const [pinning, setPinning] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [series, setSeries] = useState<ShowSeriesOption[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [preflightRes, targetsRes, seriesRes] = await Promise.all([
          fetch(`${API_BASE}/api/me/channel/preflight`, { credentials: 'include' }),
          fetch(`${API_BASE}/api/me/rtmp-targets`, { credentials: 'include' }),
          fetch(`${API_BASE}/api/me/channel/show-series`, { credentials: 'include' }),
        ])
        if (!cancelled && preflightRes.ok) {
          const data = (await preflightRes.json()) as Preflight
          setPreflight(data)
          setTitle(data.title ?? '')
          setTagline(data.tagline ?? data.plannedRadioShow?.tagline ?? '')
        }
        if (!cancelled && targetsRes.ok) {
          setTargets((await targetsRes.json()) as RtmpTarget[])
        }
        if (!cancelled && seriesRes.ok) {
          const data = (await seriesRes.json()) as { series: ShowSeriesOption[] }
          setSeries(data.series)
        }
      } catch {
        // render with defaults
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function patchPreflight(
    body: Partial<Preflight> & { tagline?: string | null; seriesId?: string },
  ) {
    const res = await fetch(`${API_BASE}/api/me/channel/preflight`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = (await res.json()) as Preflight
      setPreflight(data)
      setTitle(data.title ?? '')
      setTagline(data.tagline ?? '')
    }
  }

  async function toggleTarget(id: string, enabled: boolean) {
    setTargets((prev) => prev?.map((t) => (t.id === id ? { ...t, enabled } : t)) ?? null)
    await fetch(`${API_BASE}/api/me/rtmp-targets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ enabled }),
    })
  }

  async function pinToChat() {
    if (!pinText.trim()) return
    setPinning(true)
    try {
      const res = await fetch(`${API_BASE}/api/me/chat/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: pinText.trim() }),
      })
      if (res.ok) {
        setPinned(true)
        setPinText('')
        setTimeout(() => setPinned(false), 2000)
      }
    } finally {
      setPinning(false)
    }
  }

  if (!preflight) return null

  const planned = preflight.plannedRadioShow
  const episodeNumber = preflight.episodeNumber ?? planned?.episodeNumber ?? null

  const showType = preflight.showType ?? 'LIVE_SET'

  return (
    <div className="broadcast-studio__preflight-form">
      <div className="studio-grid studio-grid--2">
        <div className="studio-field">
          <label className="studio-label studio-text-muted-sm" htmlFor="broadcast-show-name">
            Show name
          </label>
          <input
            id="broadcast-show-name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim()) void patchPreflight({ title: title.trim() })
            }}
            placeholder={
              episodeNumber != null
                ? showType === 'TALK'
                  ? `Talk #${episodeNumber}`
                  : `Show #${episodeNumber}`
                : showType === 'TALK'
                  ? 'Studio talk — Live'
                  : 'Moonrise Sessions — Live'
            }
            className="studio-input studio-mt-sm"
          />
        </div>
        <div className="studio-field">
          <span className="studio-label studio-text-muted-sm">Show type</span>
          <div
            className="studio-kind-toggle studio-kind-toggle--compact studio-mt-sm"
            role="radiogroup"
            aria-label="Show type"
          >
            <label
              className={`studio-kind-toggle__option${showType === 'LIVE_SET' ? ' studio-kind-toggle__option--active' : ''}`}
            >
              <input
                type="radio"
                name="broadcast-show-type"
                checked={showType === 'LIVE_SET'}
                onChange={() => void patchPreflight({ showType: 'LIVE_SET' })}
              />
              <span className="studio-kind-toggle__title">Live set</span>
            </label>
            <label
              className={`studio-kind-toggle__option${showType === 'TALK' ? ' studio-kind-toggle__option--active' : ''}`}
            >
              <input
                type="radio"
                name="broadcast-show-type"
                checked={showType === 'TALK'}
                onChange={() => void patchPreflight({ showType: 'TALK' })}
              />
              <span className="studio-kind-toggle__title">Talk</span>
            </label>
          </div>
        </div>
      </div>

      {series.length > 0 ? (
        <div className="studio-field">
          <label className="studio-label studio-text-muted-sm" htmlFor="broadcast-series">
            Series episode
          </label>
          <select
            id="broadcast-series"
            className="studio-input studio-mt-sm"
            value={preflight.plannedLiveShow?.seriesId ?? ''}
            disabled={Boolean(preflight.plannedLiveShow)}
            onChange={(event) => {
              if (event.target.value) void patchPreflight({ seriesId: event.target.value })
            }}
          >
            <option value="">One-off broadcast</option>
            {series.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.episodeNumberEnabled ? ` — next #${item.nextEpisodeNumber}` : ''}
              </option>
            ))}
          </select>
          <p className="studio-text-muted-sm studio-mt-xs">
            Selecting a series fills its next episode number, name, metadata, and saved artwork.
          </p>
        </div>
      ) : null}

      {planned && episodeNumber != null ? (
        <div className="broadcast-studio__planned-show studio-mb-md">
          <p className="broadcast-studio__planned-show-label">Planned Tahti Radio show</p>
          <p className="broadcast-studio__planned-show-episode">
            {showType === 'TALK' ? 'Talk' : 'Episode'} {episodeNumber}
          </p>
          <div className="studio-field studio-mt-sm">
            <label className="studio-label studio-text-muted-sm" htmlFor="broadcast-tagline">
              Tagline
            </label>
            <input
              id="broadcast-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              onBlur={() => {
                const next = tagline.trim() || null
                if (next !== (preflight.tagline ?? null)) {
                  void patchPreflight({ tagline: next })
                }
              }}
              placeholder={
                showType === 'TALK'
                  ? 'e.g. studio chat with guests, open requests'
                  : 'e.g. late-night deep cuts, requests open'
              }
              className="studio-input studio-mt-sm"
              maxLength={200}
            />
          </div>
        </div>
      ) : null}

      <details className="broadcast-studio__preflight-more">
        <summary>More options</summary>
        <div className="studio-grid studio-grid--2 studio-mt-md">
          <div className="studio-field">
            <label className="studio-label studio-text-muted-sm" htmlFor="broadcast-visibility">
              Visibility
            </label>
            <select
              id="broadcast-visibility"
              value={preflight.visibility}
              onChange={(e) =>
                void patchPreflight({ visibility: e.target.value as Preflight['visibility'] })
              }
              className="studio-input studio-mt-sm"
            >
              <option value="PUBLIC">Public — anyone can listen</option>
              <option value="FAN_ONLY">Fan-subscribers only</option>
            </select>
          </div>

          <div className="studio-field">
            <span className="studio-label studio-text-muted-sm">Simulcast</span>
            <div className="broadcast-studio__targets studio-mt-sm">
              {targets === null ? null : targets.length === 0 ? (
                <a href="/dashboard/settings/multistream" className="studio-link">
                  Set up a simulcast target →
                </a>
              ) : (
                targets.map((t) => (
                  <label key={t.id} className="studio-label-row studio-text-sm">
                    <input
                      type="checkbox"
                      checked={t.enabled}
                      onChange={(e) => void toggleTarget(t.id, e.target.checked)}
                    />
                    {t.label}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="studio-field studio-mt-md">
          <label className="studio-label studio-text-muted-sm" htmlFor="broadcast-pin">
            Pin to chat (optional)
          </label>
          <div className="broadcast-studio__pin-row studio-mt-sm">
            <input
              id="broadcast-pin"
              value={pinText}
              onChange={(e) => setPinText(e.target.value)}
              placeholder="e.g. 'three new originals tonight, requests open at 23:00'"
              className="studio-input"
            />
            <Button
              disabled={pinning || !pinText.trim()}
              onClick={() => void pinToChat()}
              variant="secondary"
              size="sm"
            >
              {pinned ? 'Pinned ✓' : pinning ? 'Pinning…' : 'Pin'}
            </Button>
          </div>
        </div>
      </details>
    </div>
  )
}
