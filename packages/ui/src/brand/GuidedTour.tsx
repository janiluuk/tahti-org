'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface TourStep {
  /** CSS selector for the element this step annotates. Steps whose selector
   * doesn't match anything on the current page are skipped. */
  selector: string
  title: string
  body: string
}

const SPOTLIGHT_PAD = 8
const CARD_MARGIN = 16
const CARD_WIDTH = 320

/** Full-screen spotlight walkthrough — dims the page, cuts a highlight around
 * one element at a time, and shows a titled annotation card next to it.
 * Esc or the close icon dismiss it; arrow buttons (and ←/→ keys) step
 * through. Steps whose selector isn't present on the current page (e.g. a
 * conditionally-rendered control) are silently skipped rather than shown as
 * broken. */
export function GuidedTour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [liveSteps] = useState<TourStep[]>(() =>
    steps.filter((s) => document.querySelector(s.selector)),
  )
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardStyle, setCardStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const step = liveSteps[index]

  useEffect(() => {
    if (!step) return
    const el = document.querySelector(step.selector)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const measure = () => setRect(el ? el.getBoundingClientRect() : null)
    measure()
    const t = window.setTimeout(measure, 280)
    return () => window.clearTimeout(t)
  }, [index, step])

  useEffect(() => {
    if (!step) return
    function measure() {
      const el = document.querySelector(step!.selector)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step])

  useLayoutEffect(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cardHeight = cardRef.current?.offsetHeight ?? 160
    if (!rect) {
      setCardStyle({
        top: (vh - cardHeight) / 2,
        left: (vw - CARD_WIDTH) / 2,
      })
      return
    }
    const left = Math.min(Math.max(rect.left, CARD_MARGIN), vw - CARD_WIDTH - CARD_MARGIN)
    const spaceBelow = vh - rect.bottom
    const spaceAbove = rect.top
    const top =
      spaceBelow >= cardHeight + 24 || spaceBelow >= spaceAbove
        ? Math.min(rect.bottom + 16, vh - cardHeight - CARD_MARGIN)
        : Math.max(rect.top - cardHeight - 16, CARD_MARGIN)
    setCardStyle({ top: Math.max(top, CARD_MARGIN), left })
  }, [rect, index])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowRight') {
        setIndex((i) => Math.min(i + 1, liveSteps.length - 1))
      } else if (e.key === 'ArrowLeft') {
        setIndex((i) => Math.max(i - 1, 0))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, liveSteps.length])

  if (!step) {
    return (
      <div className="guided-tour__scrim" role="dialog" aria-modal="true" aria-label="Help">
        <div className="guided-tour__card guided-tour__card--empty" style={{ maxWidth: CARD_WIDTH }}>
          <button
            type="button"
            className="guided-tour__close"
            onClick={onClose}
            aria-label="Close help"
          >
            ×
          </button>
          <p>Nothing to highlight on this page yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="guided-tour__scrim" role="dialog" aria-modal="true" aria-label="Help">
      {rect && (
        <div
          className="guided-tour__spotlight"
          style={{
            top: rect.top - SPOTLIGHT_PAD,
            left: rect.left - SPOTLIGHT_PAD,
            width: rect.width + SPOTLIGHT_PAD * 2,
            height: rect.height + SPOTLIGHT_PAD * 2,
          }}
        />
      )}
      <div
        ref={cardRef}
        className="guided-tour__card"
        style={{ top: cardStyle.top, left: cardStyle.left, width: CARD_WIDTH }}
      >
        <button
          type="button"
          className="guided-tour__close"
          onClick={onClose}
          aria-label="Close help"
        >
          ×
        </button>
        <div className="guided-tour__step-count">
          {index + 1} / {liveSteps.length}
        </div>
        <h3 className="guided-tour__title">{step.title}</h3>
        <p className="guided-tour__body">{step.body}</p>
        <div className="guided-tour__nav">
          <button
            type="button"
            className="guided-tour__nav-btn"
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            disabled={index === 0}
            aria-label="Previous"
          >
            ← Back
          </button>
          {index < liveSteps.length - 1 ? (
            <button
              type="button"
              className="guided-tour__nav-btn guided-tour__nav-btn--primary"
              onClick={() => setIndex((i) => Math.min(i + 1, liveSteps.length - 1))}
              aria-label="Next"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              className="guided-tour__nav-btn guided-tour__nav-btn--primary"
              onClick={onClose}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
