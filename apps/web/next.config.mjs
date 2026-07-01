// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  transpilePackages: [
    '@tahti/audio-edit',
    '@tahti/shared',
    '@tahti/ui',
    '@waveform-playlist/browser',
  ],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // ffmpeg.wasm is browser-only (WASM + Worker); its package.json "node" export condition
  // resolves to an empty stub, which the RSC server-graph build otherwise tries to analyze
  // for real exports (FFFSType etc.) and warns. Treat it as external so only the client
  // bundle (which 'use client' callers actually load) ever resolves it.
  experimental: {
    serverComponentsExternalPackages: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  webpack: (config, { webpack, isServer }) => {
    // TypeScript ESM uses .js extensions in source; webpack needs this to resolve them to .ts
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    }
    // bundled-tor-exits.ts (server-only) uses node: built-ins; stub them out in the client build
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (r) => {
          r.request = r.request.replace(/^node:/, '')
        }),
      )
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        url: false,
        crypto: false,
      }
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/dashboard/archive/:id/editor/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
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
