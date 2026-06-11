// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

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

import { tokens } from '../tokens'

/** Design token names for programmatic use (prefer CSS variables in stylesheets). */
export const adminTokens = {
  color: {
    primary: tokens.color.brand[600],
    success: tokens.color.accent.green,
    error: tokens.color.accent.coral,
    warning: tokens.color.accent.amber,
    brandAmber: tokens.color.accent.amber,
    brandCyan: tokens.color.brand[400],
    brandBg: tokens.color.bg.page,
  },
  page: { sm: 640, md: 1140, lg: 1080 },
} as const
