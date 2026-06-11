// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter, Space_Grotesk } from 'next/font/google'
import { PlayerProvider } from '@/contexts/player-context'
import { MiniPlayer } from '@/components/mini-player'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Tahti — your channel, always on',
  description: 'A nonprofit broadcasting platform for independent artists. AGPL-3.0-licensed.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <PlayerProvider>
          <main>{children}</main>
          <MiniPlayer />
        </PlayerProvider>
      </body>
    </html>
  )
}
