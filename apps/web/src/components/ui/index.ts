// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

/**
 * Tahti UI component library.
 *
 * Import from `@/components/ui` in apps/web. See docs/style-guide.md.
 */

export { cn } from './cn'
export {
  Button,
  ButtonGroup,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from './button'
export { Input, type InputProps } from './input'
export { Textarea, type TextareaProps } from './textarea'
export { Select, type SelectProps } from './select'
export { Label, Field, type FieldProps } from './field'
export { Panel, type PanelProps, type PanelVariant } from './panel'
export { Heading, type HeadingProps, type HeadingLevel } from './heading'
export { Text, type TextProps, type TextTone, type TextSize } from './text'
export { Badge, type BadgeProps, type BadgeVariant } from './badge'
export { Alert, type AlertProps, type AlertVariant } from './alert'
export { Stack, Row, Divider, PageShell, Code, type PageSize, type StackGap } from './layout'
export { CopyRow, type CopyRowProps } from './copy-row'
export { Link, type LinkProps } from './link'
export { SiteFooter } from './site-footer'

/** Design token names for programmatic use (prefer CSS variables in stylesheets). */
export const tokens = {
  color: {
    primary: '#2563eb',
    success: '#16a34a',
    error: '#dc2626',
    warning: '#d97706',
    brandAmber: '#f0a500',
    brandCyan: '#00bcd4',
    brandBg: '#0a0f1e',
  },
  page: { sm: 640, md: 960, lg: 1100 },
} as const
