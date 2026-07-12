// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect } from 'react'
import { studioTimeOfDayFromDate } from './studio-time-of-day.js'

const STUDIO_ROOT_SELECTOR = '[data-tahti-ui="studio"].tahti-studio'

function applyStudioAmbientTime(celestial: boolean): void {
  const root = document.querySelector(STUDIO_ROOT_SELECTOR)
  if (!root) return
  root.classList.add('studio-ambient')
  if (celestial) {
    root.setAttribute('data-studio-time', studioTimeOfDayFromDate())
  } else {
    root.removeAttribute('data-studio-time')
  }
}

/** Sets time-of-day ambient attributes on the studio shell root (client local clock). */
export function StudioAmbientClock({ celestial = true }: { celestial?: boolean }) {
  useEffect(() => {
    applyStudioAmbientTime(celestial)

    if (!celestial) return

    const tick = () => applyStudioAmbientTime(true)
    const interval = window.setInterval(tick, 60_000)
    return () => window.clearInterval(interval)
  }, [celestial])

  return null
}
