'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { LiveChatPanel, PinnedAnnouncement, WaveformPlayer, type LiveChatMessage } from '@tahti/ui'
import { CoverImageUpload } from '@/components/cover-image-upload'

const DEMO_MESSAGES: LiveChatMessage[] = [
  { id: '1', handle: 'neon_ghost', text: 'this set is incredible', tone: 'default' },
  {
    id: '2',
    handle: 'dj-moonrise',
    text: 'thanks — three new originals tonight',
    tone: 'artist',
  },
  { id: '3', handle: 'listener42', text: 'FLAC sounds amazing', tone: 'default' },
]

export function PlaygroundWaveformDemo() {
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)

  function togglePlay() {
    if (!playing) {
      setBuffering(true)
      window.setTimeout(() => {
        setBuffering(false)
        setPlaying(true)
      }, 600)
    } else {
      setPlaying(false)
    }
  }

  return (
    <WaveformPlayer
      playing={playing}
      buffering={buffering}
      isLive
      onTogglePlay={togglePlay}
      formatBadge="HLS"
    />
  )
}

/** Self-contained demo — mimics the real prepare/complete/from-url contract without a backend. */
export function PlaygroundCoverUploadDemo() {
  const [url, setUrl] = useState<string | null>(null)

  return (
    <div data-tahti-ui="studio" style={{ maxWidth: 420 }}>
      <CoverImageUpload
        currentUrl={url}
        label="Cover image"
        prepare={async (args) => ({ uploadKey: `demo/${args.filename}` })}
        complete={async (uploadKey) => {
          // In the real widget this PUTs to `uploadUrl` first, then calls complete() —
          // the playground just fabricates a URL so the preview updates.
          return { url: `https://picsum.photos/seed/${encodeURIComponent(uploadKey)}/200` }
        }}
        fromUrl={async (sourceUrl) => ({ url: sourceUrl })}
        onUploaded={setUrl}
      />
    </div>
  )
}

export function PlaygroundChatDemo() {
  const [messages, setMessages] = useState(DEMO_MESSAGES)
  const [input, setInput] = useState('')

  return (
    <LiveChatPanel
      listeners={47}
      pinned={
        <PinnedAnnouncement>
          Tonight 22:00 UTC — ambient set, three new originals
        </PinnedAnnouncement>
      }
      messages={messages}
      inputValue={input}
      onInputChange={setInput}
      onSend={() => {
        if (!input.trim()) return
        setMessages((prev) => [
          ...prev,
          { id: String(Date.now()), handle: 'you', text: input.trim(), tone: 'self' },
        ])
        setInput('')
      }}
    />
  )
}
