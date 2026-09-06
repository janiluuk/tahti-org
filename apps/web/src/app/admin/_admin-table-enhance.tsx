'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useRef, type ReactNode } from 'react'

const HINT_CLASS = 'admin-table-scroll-hint'
const HINT_TEXT = 'Scroll sideways for more columns'

export function stampAdminTable(table: HTMLTableElement) {
  const wrap = table.closest('.admin-table-wrap')
  const headers = Array.from(table.querySelectorAll('thead th')).map((th) =>
    (th.textContent ?? '').replace(/\s+/g, ' ').trim(),
  )
  const tabular = wrap?.classList.contains('admin-table-wrap--tabular') ?? false

  if (!tabular) {
    table.querySelectorAll('tbody tr').forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (!(cell instanceof HTMLElement)) return
        const label = headers[index] ?? ''
        if (label) {
          cell.setAttribute('data-label', label)
          cell.classList.remove('admin-table__actions')
        } else {
          cell.removeAttribute('data-label')
          cell.classList.add('admin-table__actions')
        }
      })
    })
  }

  if (tabular && wrap && !wrap.querySelector(`.${HINT_CLASS}`)) {
    const hint = document.createElement('p')
    hint.className = HINT_CLASS
    hint.textContent = HINT_TEXT
    wrap.appendChild(hint)
  }
}

function enhanceRoot(root: HTMLElement) {
  root.querySelectorAll<HTMLTableElement>('table.admin-table').forEach(stampAdminTable)
}

/** Stamps header labels onto operational table cells so mobile CSS can stack them as cards. */
export function AdminTableEnhance({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    enhanceRoot(root)
    const observer = new MutationObserver(() => enhanceRoot(root))
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return <div ref={ref}>{children}</div>
}
