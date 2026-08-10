'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { RadioScheduleList } from './radio-schedule-list'
import type { PublicRadioSlot } from './actions'
import { resolveChannelUrl } from '@/lib/app-url'

interface RadioRotationItem {
  id: string
  title: string
  artistName: string
  /** Null for curated/compilation tracks (e.g. Tahti Selects' CC0 rotation)
   * with no real Tahti profile to link the artist name to. */
  artistUsername: string | null
}

interface RadioMemberRelay {
  slug: string
  artistName: string
}

function IconCalendar() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2"
        y="3.5"
        width="12"
        height="10.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M2 6.5h12M5 2v3M11 2v3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function RadioInfoOverlay({
  rotation,
  slots,
  memberRelay,
  iconOnly = false,
}: {
  rotation: RadioRotationItem[]
  slots: PublicRadioSlot[]
  memberRelay: RadioMemberRelay | null
  /** Compact icon-only trigger (calendar glyph, no label) — used next to the
   * channel banner, where a full text button would crowd the header row. */
  iconOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'schedule' | 'rotation'>('schedule')

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        className={
          iconOnly ? 'ch-radio-info-toggle ch-radio-info-toggle--icon' : 'ch-radio-info-toggle'
        }
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Schedule & rotation"
        title="Schedule & rotation"
      >
        <IconCalendar />
        {!iconOnly && <span>Schedule &amp; rotation</span>}
      </button>
      {open &&
        createPortal(
          <div className="ch-radio-info-overlay" role="presentation" onClick={() => setOpen(false)}>
            <div
              className="ch-radio-info-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Schedule and rotation"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ch-radio-info-panel__header">
                <div className="ch-radio-info-panel__tabs">
                  <button
                    type="button"
                    className={`ch-radio-info-panel__tab${tab === 'schedule' ? ' active' : ''}`}
                    onClick={() => setTab('schedule')}
                  >
                    Live artist slots
                  </button>
                  <button
                    type="button"
                    className={`ch-radio-info-panel__tab${tab === 'rotation' ? ' active' : ''}`}
                    onClick={() => setTab('rotation')}
                  >
                    In the rotation
                  </button>
                </div>
                <button
                  type="button"
                  className="ch-radio-info-panel__close"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="ch-radio-info-panel__body">
                {tab === 'schedule' ? (
                  <RadioScheduleList slots={slots} />
                ) : (
                  <>
                    {rotation.length > 0 ? (
                      <ul className="ch-radio-rotation__list">
                        {rotation.map((item) =>
                          item.artistUsername ? (
                            <li key={item.id} className="ch-radio-rotation__item">
                              <Link
                                href={`/u/${item.artistUsername}`}
                                className="ch-radio-rotation__link"
                              >
                                <span className="ch-radio-rotation__title">{item.title}</span>
                                <span className="ch-radio-rotation__artist">{item.artistName}</span>
                              </Link>
                            </li>
                          ) : (
                            <li key={item.id} className="ch-radio-rotation__item">
                              <div className="ch-radio-rotation__link">
                                <span className="ch-radio-rotation__title">{item.title}</span>
                                <span className="ch-radio-rotation__artist">{item.artistName}</span>
                              </div>
                            </li>
                          ),
                        )}
                      </ul>
                    ) : (
                      <p className="ch-radio-info-panel__empty">Nothing in rotation right now.</p>
                    )}
                    {memberRelay && (
                      <p className="ch-radio-info-panel__note">
                        Member relay also live:{' '}
                        <Link href={resolveChannelUrl(memberRelay.slug)}>
                          {memberRelay.artistName}
                        </Link>
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
