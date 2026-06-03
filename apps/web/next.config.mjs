// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@tahti/shared', '@tahti/ui'],
  typescript: { ignoreBuildErrors: false },
  webpack(config) {
    // @tahti/shared uses NodeNext `.js` import specifiers for `.ts` sources.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    // Avoid pulling Node-only shared modules (bundled-tor-exits, etc.) into the client bundle.
    config.resolve.alias['@tahti/shared'] = path.resolve(
      __dirname,
      '../../packages/shared/src/web.ts',
    )
    return config
  },
  async headers() {
    return [
      {
        source: '/embed/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/((?!embed).*)',
        headers: [
          { key: 'X-Source-Code', value: 'https://github.com/tahtiapp/tahti' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
