'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import { cn } from '../lib/cn'

export interface HelpSpotlightStep {
  id: string
  label: string
  description: string
}

export interface HelpSpotlightProps {
  steps: HelpSpotlightStep[]
  activeId: string
  /** Switches the real underlying tab — the spotlight re-measures and follows. */
  onNavigate: (id: string) => void
  /** The DOM node of the currently active panel to spotlight. Recomputed by the
   * caller on every render (e.g. from a ref map keyed by tab id) since the
   * active panel element changes as tabs switch. */
  targetEl: HTMLElement | null
  className?: string
}

/** Small "?" affordance (desktop only) that, on click, dims the whole page
 * except the currently active tab panel and walks the visitor through what
 * each tab does via prev/next arrows — the spotlight follows as they step
 * through, since `onNavigate` drives the real tab switch underneath. */
export function HelpSpotlight({
  steps,
  activeId,
  onNavigate,
  targetEl,
  className,
}: HelpSpotlightProps) {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!open) return
    function measure() {
      if (targetEl) setRect(targetEl.getBoundingClientRect())
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, targetEl])

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  function launch() {
    setOpen(true)
  }

  function close() {
    setVisible(false)
    window.setTimeout(() => setOpen(false), 280)
  }

  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === activeId),
  )
  const step = steps[activeIndex]

  function go(delta: number) {
    const next = steps[(activeIndex + delta + steps.length) % steps.length]
    if (next) onNavigate(next.id)
  }

  return (
    <>
      <button
        type="button"
        className={cn('help-spotlight-trigger', className)}
        onClick={launch}
        aria-label="Explain this view"
        title="What does this do?"
      >
        ?
      </button>
      {open && rect && step && (
        <div
          className={cn('help-spotlight-overlay', visible && 'help-spotlight-overlay--visible')}
          role="dialog"
          aria-modal="true"
          aria-label={`Help: ${step.label}`}
        >
          <div
            className="help-spotlight-veil help-spotlight-veil--top"
            style={{ height: Math.max(0, rect.top) }}
          />
          <div
            className="help-spotlight-veil help-spotlight-veil--bottom"
            style={{ top: rect.bottom }}
          />
          <div
            className="help-spotlight-veil help-spotlight-veil--left"
            style={{ top: rect.top, height: rect.height, width: Math.max(0, rect.left) }}
          />
          <div
            className="help-spotlight-veil help-spotlight-veil--right"
            style={{ top: rect.top, height: rect.height, left: rect.right }}
          />
          <div
            className="help-spotlight-ring"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
            aria-hidden
          />

          <button
            type="button"
            className="help-spotlight-close"
            onClick={close}
            aria-label="Close help"
          >
            ✕
          </button>

          <div className="help-spotlight-card">
            {steps.length > 1 && (
              <button
                type="button"
                className="help-spotlight-nav help-spotlight-nav--prev"
                onClick={() => go(-1)}
                aria-label="Previous view"
              >
                ‹
              </button>
            )}
            <div className="help-spotlight-card__body">
              <div className="help-spotlight-card__label">{step.label}</div>
              <p className="help-spotlight-card__desc">{step.description}</p>
              {steps.length > 1 && (
                <div className="help-spotlight-card__dots">
                  {steps.map((s, i) => (
                    <span
                      key={s.id}
                      className={cn(
                        'help-spotlight-card__dot',
                        i === activeIndex && 'help-spotlight-card__dot--active',
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
            {steps.length > 1 && (
              <button
                type="button"
                className="help-spotlight-nav help-spotlight-nav--next"
                onClick={() => go(1)}
                aria-label="Next view"
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
