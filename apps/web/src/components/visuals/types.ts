// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ColorScheme } from '@tahti/shared'

export interface VisualPresetProps {
  colorScheme: ColorScheme
  analyser?: AnalyserNode | null
}
