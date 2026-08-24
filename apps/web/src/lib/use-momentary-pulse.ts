// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useRef, useState } from 'react'

/** Returns [active, trigger] — trigger() flips `active` true for `durationMs`,
 * then false again. Used for "gray the button out briefly after a click"
 * feedback (e.g. add-to-queue buttons) — a debounce signal for styling, not
 * for actually blocking repeat clicks past the animation. */
export function useMomentaryPulse(durationMs = 400): [boolean, () => void] {
  const [active, setActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function trigger() {
    setActive(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setActive(false), durationMs)
  }

  return [active, trigger]
}
