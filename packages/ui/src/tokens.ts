// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Tahti v8 design tokens — TypeScript source of truth.
 *
 * CSS custom properties in `tokens.css` must stay in sync with these values.
 * See docs/design/README.md for the token lock workflow.
 *
 * EVERY color, spacing value, type size, and radius in brand UI comes from here.
 * If you need a hex in a component, add it here first, then wire CSS or import.
 */

export const tokens = {
  color: {
    bg: {
      page: '#0A0E1C',
      card: '#11172A',
      cardElevated: '#162038',
      cardHover: '#1B2540',
    },
    border: {
      subtle: '#1F2940',
      strong: '#2A3550',
    },
    text: {
      primary: '#E6E9F0',
      secondary: '#A1A8BD',
      tertiary: '#5E6680',
      onBrand: '#062028',
    },
    brand: {
      50: '#E6FBFC',
      200: '#7EE7EE',
      400: '#22D3EE',
      600: '#0891B2',
      800: '#0E5C70',
    },
    /** Functional stat colors — encode meaning; do not reassign */
    stat: {
      plays: '#FFB840',
      downloads: '#3FE07A',
      fans: '#A78BFA',
      revenue: '#22D3EE',
      /** Neutral metric (platform totals, storage) — default text color */
      neutral: '#E6E9F0',
      /** Transparency / finance — cost line */
      cost: '#F87171',
      /** Transparency / finance — surplus line */
      surplus: '#22D3EE',
    },
    semantic: {
      live: '#3FE07A',
      liveBg: 'rgba(63,224,122,0.12)',
      warn: '#FFB840',
      warnBg: 'rgba(255,184,64,0.08)',
      warnBorder: '#FFB840',
      danger: '#F87171',
    },
    /** Deterministic live-chat username colors */
    chatHandle: {
      pink: '#F472B6',
      blue: '#60A5FA',
      lightPurple: '#C084FC',
      orange: '#FB923C',
    },
    /** Legacy aliases used by existing CSS (--amber, --cyan, …) */
    accent: {
      amber: '#FFB840',
      cyan: '#22D3EE',
      green: '#3FE07A',
      purple: '#A78BFA',
      coral: '#F87171',
    },
    base: {
      white: '#FFFFFF',
      black: '#000000',
    },
    /** Mockup-only BrowserFrame chrome — not for production pages */
    browserFrame: {
      dotRed: '#FF5F57',
      dotYellow: '#FEBC2E',
      dotGreen: '#28C840',
    },
    /** Third-party platform brand colors — multistream target tiles only, never text/pills */
    platformBrand: {
      twitch: '#9146FF',
      youtube: '#FF0000',
      kick: '#53FC18',
      kickFg: '#0A1F00',
      mixcloud: '#5000B9',
      facebook: '#1877F2',
      tiktok: '#000000',
      instagram: '#C13584',
    },
  },
  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },
  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  font: {
    family: {
      sans: 'Inter, system-ui, sans-serif',
      head: "'Space Grotesk', sans-serif",
      mono: 'ui-monospace, "SF Mono", monospace',
    },
    size: {
      statBig: '28px',
      display: '32px',
      h2: '22px',
      h3: '18px',
      body: '14px',
      sm: '13px',
      xs: '12px',
      label: '11px',
      micro: '10px',
    },
    weight: {
      regular: 400,
      medium: 500,
    },
  },
  shadow: {
    card: '0 4px 24px rgba(0, 0, 0, 0.4)',
    cyan: '0 8px 24px rgba(34, 211, 238, 0.25)',
    modal: '0 40px 120px rgba(0, 0, 0, 0.8)',
  },
} as const

export type Tokens = typeof tokens

/** StatCard / dashboard metric variants — TypeScript enforces meaning, not color strings */
export type StatVariant = keyof typeof tokens.color.stat

export const statVariantToCssClass: Record<StatVariant, string> = {
  plays: 'stat-card--plays',
  downloads: 'stat-card--downloads',
  fans: 'stat-card--fans',
  revenue: 'stat-card--revenue',
  neutral: 'stat-card--neutral',
  cost: 'stat-card--cost',
  surplus: 'stat-card--surplus',
}
