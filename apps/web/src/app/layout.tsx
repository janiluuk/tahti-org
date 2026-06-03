// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tahti — your channel, always on',
  description: 'A nonprofit broadcasting platform for independent artists. AGPL-3.0-licensed.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
        <footer
          style={{
            padding: '1rem',
            marginTop: '2rem',
            borderTop: '1px solid #eee',
            fontSize: '0.875rem',
            color: '#666',
          }}
        >
          <p>
            Tahti ry — nonprofit broadcasting platform for independent artists.{' '}
            <a href="https://github.com/tahtiapp/tahti">Source code (AGPL-3.0)</a>
          </p>
        </footer>
      </body>
    </html>
  )
}
