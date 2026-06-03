// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Re-exports from @tahti/ui for dark public surfaces (channel, profile, smart link).
 * Import package CSS once on those routes: tokens.css + components.css.
 * Dashboard stays on local @/components/ui (light shell).
 */
export {
  Button,
  Callout,
  FormField,
  Input,
  Stat,
  StatGrid,
  LiveBadge,
  QualityBadge,
  Card,
} from '@tahti/ui'
