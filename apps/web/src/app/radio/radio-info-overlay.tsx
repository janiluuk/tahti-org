'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { RadioSlotsCalendar } from './radio-slots-calendar'
import type { PublicRadioSlot } from './actions'

interface RadioRotationItem {
  id: string
  title: string
  artistName: string
}

interface RadioMemberRelay {
  slug: string
  artistName: string
}

export function RadioInfoOverlay({
  rotation,
  slots,
  memberRelay,
}: {
  rotation: RadioRotationItem[]
  slots: PublicRadioSlot[]
  memberRelay: RadioMemberRelay | null
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'schedule' | 'rotation'>('schedule')

  return (
    <>
      <button
        type="button"
        className="ch-radio-info-toggle"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Schedule &amp; rotation
      </button>

      {open && (
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
                <RadioSlotsCalendar initialSlots={slots} />
              ) : (
                <>
                  {rotation.length > 0 ? (
                    <ul className="ch-radio-rotation__list">
                      {rotation.map((item) => (
                        <li key={item.id} className="ch-radio-rotation__item">
                          <span className="ch-radio-rotation__title">{item.title}</span>
                          <span className="ch-radio-rotation__artist">{item.artistName}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ch-radio-info-panel__empty">Nothing in rotation right now.</p>
                  )}
                  {memberRelay && (
                    <p className="ch-radio-info-panel__note">
                      Member relay also live:{' '}
                      <a href={`/c/${memberRelay.slug}`}>{memberRelay.artistName}</a>
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
