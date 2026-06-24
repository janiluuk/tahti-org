// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { SocialLinkIcon } from '@/components/social-link-icon'

export type ChannelLink = { label: string; url: string }

interface Props {
  initial: ChannelLink[]
  onDraftChange?: (links: ChannelLink[]) => void
}

export default function ChannelLinksPanel({ initial, onDraftChange }: Props) {
  const [links, setLinks] = useState<ChannelLink[]>(
    initial.length > 0 ? initial : [{ label: '', url: '' }],
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
    setLinks((prev) => [...prev, { label: '', url: '' }])
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
            <button
              type="button"
              className="ui-btn ui-btn--sm ui-btn--ghost"
              onClick={() => removeLink(i)}
              aria-label="Remove link"
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="ui-btn ui-btn--sm ui-btn--secondary" onClick={addLink}>
          + Add link
        </button>
      </div>
    </>
  )
}
