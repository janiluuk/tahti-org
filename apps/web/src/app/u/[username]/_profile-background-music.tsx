// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'
import { usePlayer } from '@/contexts/player-context'

/**
 * Looping ambient clip on the public artist page. Muted while the shared
 * player is playing; unmuted otherwise (marketing-site ducking pattern).
 * Browsers may block unmuted autoplay — show Unmute until a gesture unlocks it.
 */
export function ProfileBackgroundMusic({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const { playing } = usePlayer()
  const [unlocked, setUnlocked] = useState(false)
  const [userMuted, setUserMuted] = useState(false)

  const wantSound = unlocked && !userMuted && !playing

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.loop = true
    el.volume = 0.7
    el.muted = !wantSound
    void el.play().catch(() => {})
  }, [src, wantSound])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    let cancelled = false
    el.loop = true
    el.volume = 0.7
    el.muted = false
    void el
      .play()
      .then(() => {
        if (!cancelled) setUnlocked(true)
      })
      .catch(() => {
        if (cancelled) return
        el.muted = true
        void el.play().catch(() => {})
      })
    return () => {
      cancelled = true
    }
  }, [src])

  async function onToggle() {
    const el = audioRef.current
    if (!el) return
    if (!unlocked || userMuted) {
      el.muted = playing
      try {
        await el.play()
        setUnlocked(true)
        setUserMuted(false)
      } catch {
        /* still blocked */
      }
      return
    }
    setUserMuted(true)
    el.muted = true
  }

  const showMuted = !unlocked || userMuted
  const ducked = playing && unlocked && !userMuted

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="auto" playsInline />
      <button
        type="button"
        className={`prof-bg-music-btn${showMuted || ducked ? ' prof-bg-music-btn--muted' : ''}`}
        onClick={() => void onToggle()}
        aria-label={
          showMuted
            ? 'Unmute page music'
            : ducked
              ? 'Page music paused while track plays'
              : 'Mute page music'
        }
      >
        <span className="prof-bg-music-btn__pulse" aria-hidden />
        <span className="prof-bg-music-btn__label">
          {showMuted ? 'Unmute' : ducked ? 'Muted' : 'Mute'}
        </span>
      </button>
    </>
  )
}
