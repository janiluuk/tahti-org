// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { BrandLogo } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'
import { statusPageUrl } from '@/lib/status-page'

export default function GatewayPage() {
  const statusUrl = statusPageUrl()
  return (
    <>
      <BgCanvas />
      <div className="auth-shell">
        <div className="gateway-card">
          <BrandLogo href="https://tahti.live" />

          <div className="gateway-hero">
            <h1 className="gateway-title">
              Broadcasting for
              <br />
              independent artists.
            </h1>
            <p className="gateway-sub">
              A nonprofit platform built to support artists — not algorithms.
            </p>
          </div>

          <div className="gateway-ctas">
            <Link href="/listen" className="ui-btn ui-btn--primary ui-btn--lg gateway-cta-primary">
              Listen now
            </Link>
            <Link href="/login" className="ui-btn ui-btn--secondary ui-btn--lg">
              Artist log in
            </Link>
          </div>

          <ul className="gateway-features" aria-label="Platform features">
            <li>
              <span className="gateway-feature-icon" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2 11 Q8 5 14 11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4.5 13 Q8 9 11.5 13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="8" cy="7" r="1.5" fill="currentColor" />
                </svg>
              </span>
              Live HLS broadcasting with archive
            </li>
            <li>
              <span className="gateway-feature-icon" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M8 5v6M6 6.5c0-.83.67-1.5 1.5-1.5h1c.83 0 1.5.67 1.5 1.5S9.33 8 8.5 8h-1C6.67 8 6 8.67 6 9.5S6.67 11 7.5 11h1c.83 0 1.5-.67 1.5-1.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              Fan subscriptions with artist payouts
            </li>
            <li>
              <span className="gateway-feature-icon" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 2L9.8 6.2L14.5 6.5L11 9.6L12 14L8 11.5L4 14L5 9.6L1.5 6.5L6.2 6.2Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Annual grant pool from membership fees
            </li>
          </ul>

          <div className="gateway-footer">
            <Link href="/apply" className="gateway-footer__link">
              Apply for the beta
            </Link>
            <span className="gateway-footer__sep">·</span>
            <a href={statusUrl} className="gateway-footer__link">
              Status
            </a>
            <span className="gateway-footer__sep">·</span>
            <a href="https://tahti.live" className="gateway-footer__link">
              tahti.live
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
