'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useRef, useState } from 'react'

const IDLE_MS = 10_000
/** How long the hint shows before the page actually scrolls — gives the
 * viewer a beat to notice it and take over before it moves on its own. */
const HINT_BEFORE_SCROLL_MS = 2_000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'] as const

/** Attract-mode idle auto-scroll for an unattended kiosk/presentation
 * display: if nobody touches the page for ~10s, show a subtle "next" hint,
 * then smoothly scroll to the next [data-scroll-section] below. Any real
 * interaction cancels it immediately. Off entirely for prefers-reduced-motion. */
export function IdleAutoScroll() {
  const [hintVisible, setHintVisible] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout>>()
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    function clearTimers() {
      clearTimeout(idleTimer.current)
      clearTimeout(scrollTimer.current)
    }

    function scrollToNextSection() {
      const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-section]'))
      if (sections.length === 0) return

      const scrollY = window.scrollY
      let currentIndex = 0
      for (let i = 0; i < sections.length; i++) {
        if (sections[i]!.offsetTop <= scrollY + 50) currentIndex = i
      }
      const next = sections[(currentIndex + 1) % sections.length]!
      next.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    function armIdleTimer() {
      clearTimers()
      setHintVisible(false)
      idleTimer.current = setTimeout(() => {
        setHintVisible(true)
        scrollTimer.current = setTimeout(() => {
          setHintVisible(false)
          scrollToNextSection()
        }, HINT_BEFORE_SCROLL_MS)
      }, IDLE_MS)
    }

    function onActivity() {
      armIdleTimer()
    }

    armIdleTimer()
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true })
    }
    return () => {
      clearTimers()
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity)
      }
    }
  }, [])

  return (
    <div className={`home-idle-hint${hintVisible ? ' home-idle-hint--visible' : ''}`} aria-hidden>
      <span className="home-idle-hint__chevron" />
    </div>
  )
}
