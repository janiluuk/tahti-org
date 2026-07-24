'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useRef, useState } from 'react'

const EMOJI = [
  '😀',
  '😂',
  '😍',
  '🥳',
  '😎',
  '🤔',
  '😢',
  '😮',
  '👍',
  '👎',
  '🙏',
  '👏',
  '🔥',
  '🎉',
  '❤️',
  '💯',
  '🎵',
  '🎧',
  '🎤',
  '🎹',
  '🥁',
  '🎸',
  '⭐',
  '✨',
]

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div className="emoji-picker" ref={ref}>
      <button
        type="button"
        className="emoji-picker__toggle"
        aria-label="Insert emoji"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        🙂
      </button>
      {open && (
        <div className="emoji-picker__grid" role="menu">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              className="emoji-picker__item"
              onClick={() => {
                onSelect(e)
                setOpen(false)
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
