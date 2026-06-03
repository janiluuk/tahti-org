// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Link } from './link'

export function SiteFooter() {
  return (
    <footer className="ui-footer">
      <p style={{ margin: 0 }}>
        Tahti ry — nonprofit broadcasting platform for independent artists.{' '}
        <Link href="https://github.com/tahtiapp/tahti">Source code (AGPL-3.0)</Link>
      </p>
    </footer>
  )
}
