// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

/**
 * CSS text layer modes inspired by examples on
 * https://freefrontend.com/css-text-effects/ (MIT-licensed demos).
 */

export const TEXT_LAYER_SOURCE_URL = 'https://freefrontend.com/css-text-effects/'

export const TEXT_LAYER_MODE_META = {
  GRADIENT_SHIMMER: {
    label: 'Animated gradient shimmer',
    source: 'Animated Gradient Text',
  },
  COSMIC_NEON: {
    label: 'Cosmic neon glow',
    source: 'Cosmic Neon Text Effect',
  },
  LAYERED_WAVE_3D: {
    label: '3D layered wave',
    source: 'Interactive 3D Layered Text Wave Effect',
  },
  SHIMMER_LINES: {
    label: 'Shimmer lines',
    source: 'Text Shimmer Lines Effect',
  },
  GHOST_ECHO: {
    label: 'Ghost echo',
    source: 'Vertical Ghost Text Hover Effect',
  },
} as const
