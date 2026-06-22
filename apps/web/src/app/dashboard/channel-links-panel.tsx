// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SocialLinkIcon } from '@/components/social-link-icon'
import { updateChannelProfile } from './channel-identity-actions'

export type ChannelLink = { label: string; url: string }

interface Props {
  initial: ChannelLink[]
  onDraftChange?: (links: ChannelLink[]) => void
}

function linksToSocialLinks(links: ChannelLink[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const { label, url } of links) {
    const key = label.trim()
    if (key && url.trim()) map[key] = url.trim()
  }
  return map
}

export default function ChannelLinksPanel({ initial, onDraftChange }: Props) {
  const router = useRouter()
  const [links, setLinks] = useState<ChannelLink[]>(
    initial.length > 0 ? initial : [{ label: '', url: '' }],
  )
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    onDraftChange?.(links.filter((l) => l.label.trim() && l.url.trim()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links])

  function updateLink(index: number, field: 'label' | 'url', value: string) {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index))
  }

  function addLink() {
    setLinks((prev) => [...prev, { label: '', url: '' }])
  }

  function save() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await updateChannelProfile({ socialLinks: linksToSocialLinks(links) })
      if (res.error) {
        setError(res.error)
        return
      }
      setMessage('Links saved.')
      router.refresh()
    })
  }

  return (
    <>
      <div className="studio-field--block">
        {links.map((link, i) => (
          <div key={i} className="studio-row studio-row--wrap studio-mb-sm">
            <span className="studio-link-row__icon">
              <SocialLinkIcon label={link.label} url={link.url} />
            </span>
            <input
              type="text"
              placeholder="Label (e.g. Bandcamp)"
              value={link.label}
              disabled={isPending}
              onChange={(e) => updateLink(i, 'label', e.target.value)}
              className="studio-input"
              maxLength={40}
            />
            <input
              type="url"
              placeholder="https://…"
              value={link.url}
              disabled={isPending}
              onChange={(e) => updateLink(i, 'url', e.target.value)}
              className="studio-input studio-input--grow"
              maxLength={2000}
            />
            <button
              type="button"
              className="ui-btn ui-btn--sm ui-btn--ghost"
              disabled={isPending}
              onClick={() => removeLink(i)}
              aria-label="Remove link"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ui-btn ui-btn--sm ui-btn--secondary"
          onClick={addLink}
          disabled={isPending}
        >
          + Add link
        </button>
      </div>

      {error && <p className="studio-notice studio-notice--error">{error}</p>}
      {message && <p className="studio-notice studio-notice--success">{message}</p>}

      <div className="studio-actions">
        <button
          type="button"
          className="ui-btn ui-btn--primary"
          onClick={save}
          disabled={isPending}
        >
          {isPending ? 'Saving…' : 'Save links'}
        </button>
      </div>
    </>
  )
}
