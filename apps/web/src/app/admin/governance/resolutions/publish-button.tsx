// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { publishResolution } from '../../actions'

export function PublishResolutionButton({ id, published }: { id: string; published: boolean }) {
  const [pending, setPending] = useState(false)
  if (published) return <span className="admin-ok">Published</span>

  async function onPublish() {
    setPending(true)
    const { error } = await publishResolution(id)
    setPending(false)
    if (!error) window.location.reload()
  }

  return (
    <button type="button" disabled={pending} onClick={onPublish}>
      {pending ? '…' : 'Publish'}
    </button>
  )
}
