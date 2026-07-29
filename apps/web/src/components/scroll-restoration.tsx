'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const STORAGE_PREFIX = 'tahti:scroll:'

function keyFor(url: string): string {
  return `${STORAGE_PREFIX}${url}`
}

/**
 * Next 14's App Router scroll restoration is unreliable for this app's mix of
 * dynamic profile/collection routes: navigating back after scrolling deep into
 * an artist's tracks tab, or into a playlist and back, frequently lands back at
 * the top instead of where the listener left off. This restores it ourselves.
 *
 * Scroll position is tracked continuously (not just "on the way out") because
 * by the time a route-change effect fires, Next has already swapped in the new
 * page and reset window.scrollY — reading it then would record the NEW page's
 * position under the OLD page's key. A live-updated key sidesteps that. On a
 * genuine back/forward (detected via 'popstate', never a fresh Link click),
 * the saved position for the URL being navigated TO is restored once painted.
 *
 * Mounted once in the root layout, alongside the other global providers.
 */
export function ScrollRestoration() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const url = `${pathname}?${searchParams.toString()}`
  const urlRef = useRef(url)
  const isPopRef = useRef(false)

  useEffect(() => {
    urlRef.current = url
  }, [url])

  useEffect(() => {
    const onPopState = () => {
      isPopRef.current = true
    }
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        sessionStorage.setItem(keyFor(urlRef.current), String(window.scrollY))
        ticking = false
      })
    }
    window.addEventListener('popstate', onPopState)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    if (!isPopRef.current) return
    isPopRef.current = false
    const saved = sessionStorage.getItem(keyFor(url))
    if (saved == null) return
    // Wait a tick for the new route's content to paint — an immediate
    // scrollTo on a still-empty/short page is a no-op.
    requestAnimationFrame(() => window.scrollTo(0, Number(saved)))
  }, [url])

  return null
}
