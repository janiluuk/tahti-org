// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { Inter, Space_Grotesk } from 'next/font/google'
import { PlayerProvider } from '@/contexts/player-context'
import { BackgroundCanvasProvider } from '@/contexts/background-canvas-context'
import { MiniPlayer } from '@/components/mini-player'
import { PublicNavBg } from '@/components/public-nav-bg'
import { ScrollRestoration } from '@/components/scroll-restoration'
import { ToastProvider } from '@/contexts/toast-context'
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
        <ToastProvider>
          <PlayerProvider>
            <BackgroundCanvasProvider>
              <Suspense fallback={null}>
                <ScrollRestoration />
              </Suspense>
              <PublicNavBg />
              <main>{children}</main>
              <MiniPlayer />
            </BackgroundCanvasProvider>
          </PlayerProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
