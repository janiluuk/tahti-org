// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

export function IconPin({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2v4.2L5 9v1.5h6V9L8 6.2V2Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 10.5V14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function IconRotation({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M13 5.5A5 5 0 1 0 13.8 9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M13 2v4h-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      {active && <circle cx="8" cy="8" r="1.5" fill="currentColor" />}
    </svg>
  )
}

export function IconInsights() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 13V7M8 13V3M13 13V9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconTools() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10.4 2.6a2.6 2.6 0 0 0-3.4 3.1L2.6 10.1a1.4 1.4 0 0 0 2 2l4.4-4.4a2.6 2.6 0 0 0 3.1-3.4l-1.7 1.7-1.4-1.4 1.7-1.7Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
