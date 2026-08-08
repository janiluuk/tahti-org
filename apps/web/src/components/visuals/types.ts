// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { MutableRefObject } from 'react'
import type { ColorScheme, VisualPresetSettings } from '@tahti/shared'
import { DEFAULT_VISUAL_PRESET_SETTINGS } from '@tahti/shared'

export interface VisualPresetProps {
  colorScheme: ColorScheme
  analyser?: AnalyserNode | null
  /** Live-updated knobs — read `.current` each animation frame. */
  settingsRef: MutableRefObject<VisualPresetSettings>
  /** Cover/background image to render behind the effect — only WATER_RIPPLE
   * uses this today; every other preset ignores it. */
  artworkUrl?: string | null
}

export function readSettings(ref: MutableRefObject<VisualPresetSettings>): VisualPresetSettings {
  return ref.current ?? DEFAULT_VISUAL_PRESET_SETTINGS
}
