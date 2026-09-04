// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { Panel } from '@tahti/ui'
import { previewNewsFeedXml, updateNewsFeedUrl } from './news-feed-actions'

interface PreviewItem {
  title: string
  link: string
}

/** Browser-native XML parsing — kept out of the server action so the raw
 * feed document never needs a server-side XML parser dependency just for
 * this preview; the public channel page render path parses server-side
 * separately (apps/api's fast-xml-parser), since that render has no browser. */
function parsePreviewItems(xml: string): PreviewItem[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return []
  const entries = [...doc.querySelectorAll('item'), ...doc.querySelectorAll('entry')]
  return entries
    .slice(0, 5)
    .map((entry): PreviewItem | null => {
      const title = entry.querySelector('title')?.textContent?.trim() ?? ''
      const linkEl = entry.querySelector('link')
      const link = linkEl?.getAttribute('href')?.trim() || linkEl?.textContent?.trim() || ''
      if (!title || !link) return null
      return { title, link }
    })
    .filter((item): item is PreviewItem => item !== null)
}

export function NewsFeedPanel({ initialUrl }: { initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [savedUrl, setSavedUrl] = useState(initialUrl ?? '')
  const [preview, setPreview] = useState<PreviewItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await updateNewsFeedUrl(url.trim())
      if (res.error) {
        setError(res.error)
        return
      }
      setSavedUrl(res.newsFeedUrl ?? '')
    })
  }

  function preview_() {
    setError(null)
    setPreview(null)
    if (!url.trim()) return
    startTransition(async () => {
      const res = await previewNewsFeedXml(url.trim())
      if (res.error || !res.xml) {
        setError(res.error ?? 'Could not load that feed')
        return
      }
      const items = parsePreviewItems(res.xml)
      if (items.length === 0) {
        setError('Could not find any items in that feed')
        return
      }
      setPreview(items)
    })
  }

  const dirty = url.trim() !== savedUrl

  return (
    <Panel
      title="News feed"
      description="Show your latest posts as a 'Latest news' section on your channel page — paste any public RSS or Atom feed URL."
    >
      <div className="studio-row">
        <input
          type="url"
          className="studio-input studio-flex-1"
          placeholder="https://your-blog.example/feed.xml"
          value={url}
          disabled={isPending}
          onChange={(e) => {
            setUrl(e.target.value)
            setPreview(null)
            setError(null)
          }}
        />
        <button
          type="button"
          className="ui-btn ui-btn--sm"
          disabled={isPending || !url.trim()}
          onClick={preview_}
        >
          Preview
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--sm ui-btn--primary"
          disabled={isPending || !dirty}
          onClick={save}
        >
          Save
        </button>
      </div>

      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}

      {preview && preview.length > 0 && (
        <ul className="studio-list studio-mt-sm">
          {preview.map((item) => (
            <li key={item.link}>
              <a href={item.link} target="_blank" rel="noopener noreferrer">
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
