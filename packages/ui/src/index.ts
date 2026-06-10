// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * @tahti/ui — single source for all Tahti UI components.
 *
 * Import CSS once per surface:
 * - Brand (dark public): tokens.css + components.css + brand-channel.css (or brand-studio.css)
 * - Admin (dashboard/forms): admin-tokens.css + admin-ui.css
 *
 * See docs/design-system.md and .cursor/rules/ui-library.mdc
 */

// Dashboard / forms (default Button, Panel, etc.)
export * from './admin'

// Public dark shells (channel, profile, smart link, studio)
export * from './brand'

// Marketing site primitives (Nav, MktButton, Stat, …)
export {
  Button as MarketingButton,
  Card,
  ToolCard,
  Badge as MarketingBadge,
  LiveBadge,
  QualityBadge,
  Callout,
  UrlBox,
  SectionHeader,
  Stat,
  StatGrid,
  Input as MarketingInput,
  FormField,
  Nav,
} from './marketing'
export type { ButtonProps as MarketingButtonProps } from './marketing/Button'
export type { CardProps } from './marketing/Card'
export type { CalloutProps } from './marketing/Callout'
export type { SectionHeaderProps } from './marketing/SectionHeader'

// Shared utilities
export { cn } from './lib/cn'
export { SafePlainText } from './lib/safe-plain-text'
export { escapeHtml, plainTextToHtml } from './lib/escape-html'

/** v8 brand design tokens — see docs/design-closing-gap.md */
export {
  tokens as brandTokens,
  statVariantToCssClass,
  type StatVariant,
  type Tokens,
} from './tokens'

// Back-compat alias used by apps/web (admin light surface)
export { adminTokens as tokens } from './admin'
