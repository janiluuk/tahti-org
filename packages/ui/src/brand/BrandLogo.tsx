// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

type BrandLogoProps = {
  href?: string
}

/** TAHTI wordmark with amber bar — auth and public brand pages. */
export function BrandLogo({ href = '/' }: BrandLogoProps) {
  return (
    <Link href={href} className="brand-logo">
      <span className="brand-logo-bar" aria-hidden />
      TAHTI
    </Link>
  )
}
