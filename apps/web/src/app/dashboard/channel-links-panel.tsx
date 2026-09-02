// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { SocialLinkIcon } from '@/components/social-link-icon'
import { Button } from '@tahti/ui'

export type ChannelLink = { id: string; label: string; url: string }

let linkIdCounter = 0
function nextLinkId(): string {
  linkIdCounter += 1
  return `link-${Date.now()}-${linkIdCounter}`
}

interface Props {
  initial: ChannelLink[]
  onDraftChange?: (links: ChannelLink[]) => void
}

export default function ChannelLinksPanel({ initial, onDraftChange }: Props) {
  const [links, setLinks] = useState<ChannelLink[]>(
    initial.length > 0 ? initial : [{ id: nextLinkId(), label: '', url: '' }],
  )

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
    setLinks((prev) => [...prev, { id: nextLinkId(), label: '', url: '' }])
  }

  return (
    <>
      <div className="studio-field--block">
        {links.map((link, i) => (
          <div key={link.id} className="studio-row studio-row--wrap studio-mb-sm">
            <span className="studio-link-row__icon">
              <SocialLinkIcon label={link.label} url={link.url} />
            </span>
            <input
              type="text"
              placeholder="Label (e.g. Bandcamp)"
              value={link.label}
              onChange={(e) => updateLink(i, 'label', e.target.value)}
              className="studio-input"
              maxLength={40}
            />
            <input
              type="url"
              placeholder="https://…"
              value={link.url}
              onChange={(e) => updateLink(i, 'url', e.target.value)}
              className="studio-input studio-input--grow"
              maxLength={2000}
            />
            <Button
              onClick={() => removeLink(i)}
              aria-label="Remove link"
              variant="ghost"
              size="sm"
            >
              Remove
            </Button>
          </div>
        ))}
        <Button onClick={addLink} variant="secondary" size="sm">
          + Add link
        </Button>
      </div>
    </>
  )
}
