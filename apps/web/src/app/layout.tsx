// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { Inter, Space_Grotesk } from 'next/font/google'
import { brandTokens } from '@tahti/ui'
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
  applicationName: 'Tahti',
  formatDetection: { telephone: false },
  // App-like: when added to the home screen, run standalone with a dark status
  // bar that matches the brand background instead of white browser chrome.
  appleWebApp: {
    capable: true,
    title: 'Tahti',
    statusBarStyle: 'black-translucent',
  },
}

/**
 * iOS home-indicator / notch insets (env(safe-area-inset-*)) only resolve when
 * viewport-fit=cover is set, and the shared --fixed-stack-bottom contract in
 * globals.css depends on them. themeColor/colorScheme match the mobile browser
 * chrome to the dark brand background so the address-bar show/hide never
 * flashes a white band at the top.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: brandTokens.color.bg.page,
  colorScheme: 'dark',
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
