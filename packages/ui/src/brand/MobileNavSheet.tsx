'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode, RefObject } from 'react'
import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export type MobileNavSheetProps = {
  open: boolean
  onClose: () => void
  triggerRef: RefObject<HTMLElement>
  ariaLabel: string
  closeLabel?: string
  children: ReactNode
}

/** Accessible bottom sheet used by the responsive studio and admin navigation. */
export function MobileNavSheet({
  open,
  onClose,
  triggerRef,
  ariaLabel,
  closeLabel = 'Close menu',
  children,
}: MobileNavSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false
        triggerRef.current?.focus()
      }
      return
    }

    wasOpenRef.current = true
    const sheet = sheetRef.current
    const firstFocusable = sheet?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !sheet) return

      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, triggerRef])

  if (!open) return null

  return (
    <div className="db-mobile-more-overlay" role="presentation" onClick={onClose}>
      <div
        ref={sheetRef}
        className="db-mobile-more-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="db-mobile-more-sheet__handle" aria-hidden />
        <button
          type="button"
          className="db-mobile-more-sheet__close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <span aria-hidden>×</span>
        </button>
        {children}
      </div>
    </div>
  )
}
