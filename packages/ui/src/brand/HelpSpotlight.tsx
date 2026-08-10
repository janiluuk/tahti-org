'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'

export interface HelpSpotlightStep {
  id: string
  label: string
  description: string
}

export interface HelpSpotlightProps {
  steps: HelpSpotlightStep[]
  /** The real underlying UI's current selection (e.g. active tab id), if it can
   * change from outside the walkthrough (a visitor clicking a real tab while
   * help is open) — the walkthrough follows along when this matches a step id.
   * Omit entirely if none of `steps` correspond to switchable tabs. */
  activeId?: string
  /** Called whenever the walkthrough moves to a step (via the arrows), so the
   * caller can sync any real underlying state for that step — e.g. switch to
   * the matching tab. No-op (or omit) for steps that just spotlight a fixed
   * page element with nothing to switch to. */
  onNavigate?: (id: string) => void
  /** Returns the DOM node to spotlight for a given step — called fresh
   * whenever help opens or the current step changes, not read once as a
   * value. Callers typically source this from a ref map keyed by step id;
   * ref mutations don't trigger a re-render on their own, so a plain
   * `targetEl` value prop would capture whatever the ref held at the
   * *previous* render (null before the panel has ever been switched to) and
   * never update — the "?" button would then open nothing, forever, until
   * some unrelated re-render happened to pass a fresher value. */
  getTargetEl: (step: HelpSpotlightStep) => HTMLElement | null
  className?: string
}

/** Small "?" affordance (desktop only) that, on click, dims the whole page
 * except the current step's target and walks the visitor through what each
 * one does via prev/next arrows. Steps can be tab-linked (`onNavigate` drives
 * the real tab switch underneath, and `activeId` keeps the walkthrough in
 * sync if a real tab is clicked directly) or spotlight a fixed page element
 * that doesn't correspond to any tab — the walkthrough tracks its own current
 * step independently of `activeId` so both kinds can be mixed freely. */
export function HelpSpotlight({
  steps,
  activeId,
  onNavigate,
  getTargetEl,
  className,
}: HelpSpotlightProps) {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [stepId, setStepId] = useState(() => steps[0]?.id)

  const getTargetElRef = useRef(getTargetEl)
  getTargetElRef.current = getTargetEl

  // Follow a real tab switch that happened outside the walkthrough (the
  // visitor clicked a tab directly while help was open) — only for steps
  // that actually correspond to a tab; fixed-element steps have no `activeId`
  // to match and are left alone.
  useEffect(() => {
    if (!open || activeId == null) return
    if (steps.some((s) => s.id === activeId)) setStepId(activeId)
  }, [open, activeId, steps])

  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === stepId),
  )
  const step = steps[activeIndex]

  useEffect(() => {
    if (!open) return
    function measure() {
      const el = step && getTargetElRef.current(step)
      if (el) setRect(el.getBoundingClientRect())
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step])

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  function launch() {
    const first = steps[0]
    if (first) {
      setStepId(first.id)
      onNavigate?.(first.id)
    }
    setOpen(true)
  }

  function close() {
    setVisible(false)
    window.setTimeout(() => setOpen(false), 280)
  }

  function go(delta: number) {
    const next = steps[(activeIndex + delta + steps.length) % steps.length]
    if (next) {
      setStepId(next.id)
      onNavigate?.(next.id)
    }
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
