// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'

const BIO_MAX = 280

interface Props {
  initial: { bio: string }
  onDraftChange?: (bio: string) => void
}

export default function ChannelBioPanel({ initial, onDraftChange }: Props) {
  const [bio, setBio] = useState(initial.bio)

  useEffect(() => {
    onDraftChange?.(bio)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bio])

  return (
    <div className="studio-field--block">
      <label className="studio-label" htmlFor="identity-bio">
        Short bio
        <span className="studio-text-muted-sm">
          {' '}
          · {BIO_MAX} chars · {bio.length} used
        </span>
      </label>
      <textarea
        id="identity-bio"
        rows={4}
        maxLength={BIO_MAX}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        className="studio-input"
        placeholder="Tell listeners about your sound, shows, and releases…"
      />
    </div>
  )
}
