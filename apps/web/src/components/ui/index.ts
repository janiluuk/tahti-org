// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Re-export @tahti/ui — do not add components here.
 * @see packages/ui and .cursor/rules/ui-library.mdc
 */
export * from '@tahti/ui'

/** App-only: Three.js gateway background (not in @tahti/ui — depends on three). */
export { BgCanvas } from './bg-canvas'
