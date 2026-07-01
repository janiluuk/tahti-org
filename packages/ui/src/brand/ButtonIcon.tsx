// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'

export type ButtonIconName =
  | 'plus'
  | 'save'
  | 'trash'
  | 'send'
  | 'link'
  | 'unlink'
  | 'check'
  | 'refresh'
  | 'download'
  | 'arrowRight'
  | 'heart'
  | 'import'
  | 'play'
  | 'edit'
  | 'search'

/**
 * Leading icons for primary/destructive buttons (ground-rules.md Rule 4).
 * Same hand-drawn style as SidebarNavIconSvg: 16x16, currentColor stroke,
 * no icon font/library. One icon per action *type*, reused across buttons
 * that perform the same kind of action, so the vocabulary stays small and
 * recognizable rather than one bespoke glyph per button.
 */
export function ButtonIcon({ name }: { name: ButtonIconName }) {
  switch (name) {
    case 'plus':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 2.5v11M2.5 8h11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'save':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M3 2.5h8l2.5 2.5V13a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 2.5 13V3a.5.5 0 0 1 .5-.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M5 2.5v3.5h5V2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M5 9.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'trash':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M3 4.5h10M6 4.5v-1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M4 4.5 4.6 13a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9L12 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'send':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M13.5 2.5 2 7.2l4.3 1.6 1.6 4.3 5.6-10.6Z"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path
            d="M13.5 2.5 6.3 8.8"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'link':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l1.77-1.77a3.5 3.5 0 0 0-4.95-4.95l-.88.88"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0L2.78 8.27a3.5 3.5 0 0 0 4.95 4.95l.88-.88"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'unlink':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l1.77-1.77a3.5 3.5 0 0 0-4.95-4.95l-.88.88"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity=".55"
          />
          <path
            d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0L2.78 8.27a3.5 3.5 0 0 0 4.95 4.95l.88-.88"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity=".55"
          />
          <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'check':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M3 8.5 6.3 11.5 13 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'refresh':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M13 4.5A5.5 5.5 0 1 0 14 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M13 1.5v3.3h-3.3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'download':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M8 2v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M5 7l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'arrowRight':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M2.5 8h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M9.5 4.5 13 8l-3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'heart':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 13.5S2 9.8 2 5.9A2.9 2.9 0 0 1 8 4.7 2.9 2.9 0 0 1 14 5.9c0 3.9-6 7.6-6 7.6Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'import':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M6 8h7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M10.5 4.5 14 8l-3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'play':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M4 2.8v10.4a.6.6 0 0 0 .9.5l8.6-5.2a.6.6 0 0 0 0-1l-8.6-5.2a.6.6 0 0 0-.9.5Z"
            fill="currentColor"
          />
        </svg>
      )
    case 'edit':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M10.5 2.5 13.5 5.5 5 14 2 14.5 2.5 11.5 10.5 2.5Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'search':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10.3 10.3 14 14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
  }
}
