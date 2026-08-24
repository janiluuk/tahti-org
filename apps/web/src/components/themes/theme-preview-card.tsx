// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/* eslint-disable no-restricted-syntax -- decorative mock traffic-light dots
 * in the preview card's fixed chrome (not driven by the theme's own vars),
 * unrelated to this app's own design tokens. */

import type { CSSProperties } from 'react'

// A reduced-scope port of the standalone tool's mock "player" preview
// (.player/.p-* markup) — same idea as ChannelColorScheme's technique
// elsewhere in this app (set CSS custom properties, let the markup reference
// them via var(--x)), just scoped to this local preview element instead of a
// live channel page.

function cssVars(vars: Record<string, string>): CSSProperties {
  const style: Record<string, string> = {}
  for (const [key, value] of Object.entries(vars)) style[`--${key}`] = value
  return style as CSSProperties
}

export function ThemePreviewCard({ vars }: { vars: Record<string, string> }) {
  return (
    <div
      style={{
        ...cssVars(vars),
        borderRadius: 'calc(var(--radius, 10px) + 4px)',
        overflow: 'hidden',
        background: 'var(--background)',
        color: 'var(--foreground)',
        border: '1px solid var(--border)',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {['var(--destructive, #e05252)', '#e0c052', '#52e074'].map((c, i) => (
          <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
        ))}
        <div
          style={{
            flex: 1,
            background: 'var(--muted)',
            color: 'var(--mutedForeground)',
            borderRadius: 'var(--radius, 8px)',
            padding: '6px 10px',
            fontSize: 12,
          }}
        >
          Search your library…
        </div>
        <span
          style={{
            background: 'var(--secondary)',
            color: 'var(--secondaryForeground)',
            padding: '3px 8px',
            borderRadius: 999,
            fontSize: 10,
          }}
        >
          v1
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', minHeight: 220 }}>
        <div
          style={{
            background: 'var(--card)',
            borderRight: '1px solid var(--border)',
            padding: '12px 10px',
            fontSize: 12,
          }}
        >
          {['Now Playing', 'Search', 'Playlists', 'Favorites', 'Settings'].map((item, i) => (
            <div
              key={item}
              style={{
                padding: '7px 8px',
                borderRadius: 'var(--radius, 6px)',
                marginBottom: 3,
                background: i === 0 ? 'var(--accent)' : 'transparent',
                color: i === 0 ? 'var(--accentForeground)' : 'var(--mutedForeground)',
                fontWeight: i === 0 ? 600 : 400,
              }}
            >
              {item}
            </div>
          ))}
        </div>
        <div style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Up next</h3>
          {[
            { title: 'Midnight Drive', dur: '3:41', playing: true },
            { title: 'Slow Static', dur: '4:02', playing: false },
            { title: 'Glass Room', dur: '2:58', playing: false },
          ].map((t) => (
            <div
              key={t.title}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 'var(--radius, 6px)',
                marginBottom: 4,
                fontSize: 12,
                background: t.playing ? 'var(--primary)' : 'transparent',
                color: t.playing ? 'var(--primaryForeground)' : 'inherit',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  background: 'var(--muted)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>{t.title}</div>
              <div style={{ opacity: 0.65, fontSize: 11 }}>{t.dur}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 16px',
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'var(--primary)',
            color: 'var(--primaryForeground)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          ▶
        </div>
        <div style={{ fontSize: 12, flex: 1 }}>
          Midnight Drive
          <div style={{ color: 'var(--mutedForeground)', fontSize: 11, marginTop: 2 }}>
            The Longwave — Signals EP
          </div>
        </div>
        <div
          style={{
            flex: 2,
            height: 4,
            background: 'var(--muted)',
            borderRadius: 99,
            overflow: 'hidden',
          }}
        >
          <div style={{ width: '38%', height: '100%', background: 'var(--accent)' }} />
        </div>
      </div>
    </div>
  )
}
