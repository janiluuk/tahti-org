// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

export type PublicFooterProps = {
  /** Status page URL — internal `/status` or external Upptime, resolved by the caller. */
  statusUrl?: string
}

const FOOTER_LINKS: { href: string; label: string }[] = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/for-artists', label: 'For artists' },
  { href: '/about', label: 'About' },
  { href: '/venues', label: 'Venues' },
  { href: '/governance', label: 'Governance' },
  { href: '/transparency', label: 'Transparency' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/agpl', label: 'Source (AGPL)' },
]

/** Shared bottom-of-page link row for public brand surfaces — surfaces governance/legal pages site-wide. */
export function PublicFooter({ statusUrl = '/status' }: PublicFooterProps) {
  return (
    <footer className="home-footer">
      {FOOTER_LINKS.map((link, index) => (
        <span key={link.href} style={{ display: 'contents' }}>
          {index > 0 && <span className="home-footer__sep">·</span>}
          <Link href={link.href} className="home-footer__link">
            {link.label}
          </Link>
        </span>
      ))}
      <span className="home-footer__sep">·</span>
      <a href={statusUrl} className="home-footer__link">
        Status
      </a>
    </footer>
  )
}
