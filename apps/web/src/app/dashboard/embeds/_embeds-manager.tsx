// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { ButtonIcon, Button, Panel } from '@tahti/ui'
import type { ArtistEmbedView } from '@tahti/shared'
import { createEmbed, deleteEmbed } from './actions'

export function EmbedsManager({ initialEmbeds }: { initialEmbeds: ArtistEmbedView[] }) {
  const [embeds, setEmbeds] = useState(initialEmbeds)
  const [url, setUrl] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    if (!url.trim()) {
      setError('Paste a SoundCloud track URL first.')
      return
    }
    setPending(true)
    setError(null)
    const result = await createEmbed(url.trim())
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.embed) {
      setEmbeds((prev) => [result.embed!, ...prev])
      setUrl('')
    }
  }

  async function remove(id: string) {
    setEmbeds((prev) => prev.filter((e) => e.id !== id))
    await deleteEmbed(id)
  }

  return (
    <Panel title="SoundCloud embeds" headerTight>
      {embeds.length === 0 ? (
        <p className="studio-text-muted-sm studio-mb-md">
          Nothing embedded yet — paste a track URL below.
        </p>
      ) : (
        <ul className="studio-list studio-mb-md">
          {embeds.map((e) => (
            <li key={e.id} className="studio-item-row--list">
              <div className="studio-flex-1">
                <div className="studio-text-sm">
                  <strong>{e.title ?? e.url}</strong>
                  {e.authorName && <span className="studio-text-muted-sm"> · {e.authorName}</span>}
                </div>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="studio-text-muted-sm studio-link"
                >
                  {e.url}
                </a>
              </div>
              <Button
                onClick={() => remove(e.id)}
                variant="ghost"
                size="sm"
                className="studio-text-error"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <label className="studio-field">
        <span className="studio-label">SoundCloud track URL</span>
        <input
          type="url"
          placeholder="https://soundcloud.com/artist/track"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="studio-input"
          disabled={pending}
        />
      </label>

      <Button onClick={add} disabled={pending} variant="primary" className="studio-mt-sm">
        <ButtonIcon name="plus" />
        {pending ? 'Adding…' : 'Add embed'}
      </Button>
      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </Panel>
  )
}
