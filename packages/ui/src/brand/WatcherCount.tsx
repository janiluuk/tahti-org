// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Eye glyph, same hand-drawn stroke style as ButtonIcon/SidebarNavIconSvg. */
function WatcherIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1 8s2.7-5 7-5 7 5 7 5-2.7 5-7 5-7-5-7-5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

/** Icon + count only — no "listening"/"watching" label. Caller's className controls layout/color. */
export function WatcherCount({ count, className }: { count: number; className?: string }) {
  return (
    <span className={className}>
      <WatcherIcon />
      {count.toLocaleString()}
    </span>
  )
}
