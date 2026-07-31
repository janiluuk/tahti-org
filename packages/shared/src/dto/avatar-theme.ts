// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const LOGO_PLACEMENTS = ['AVATAR', 'COVER', 'BOTH'] as const
export type LogoPlacement = (typeof LOGO_PLACEMENTS)[number]

export const LogoPlacementSchema = z.enum(LOGO_PLACEMENTS)

/** Solid fill or multi-stop gradient for avatar / profile cover. */
export const AvatarThemeSchema = z.object({
  kind: z.enum(['solid', 'gradient']),
  /** One color for solid; two or three for gradient. */
  colors: z.array(HexColorSchema).min(1).max(3),
  /** Gradient angle in degrees (default 135). Ignored for solid. */
  angle: z.number().int().min(0).max(360).optional(),
})

export type AvatarTheme = z.infer<typeof AvatarThemeSchema>

export const LOGO_PLACEMENT_LABELS: Record<LogoPlacement, string> = {
  AVATAR: 'On avatar',
  COVER: 'On profile cover',
  BOTH: 'Avatar and cover',
}

/**
 * Curated pairs that sit well together on dark brand surfaces —
 * used for defaults and the studio shuffle / swatch picker.
 */
export const AVATAR_THEME_PRESETS: AvatarTheme[] = [
  { kind: 'gradient', colors: ['#A78BFA', '#22D3EE'], angle: 135 },
  { kind: 'gradient', colors: ['#F87171', '#FFB840'], angle: 135 },
  { kind: 'gradient', colors: ['#5B6BC4', '#22D3EE'], angle: 135 },
  { kind: 'gradient', colors: ['#8B5CF6', '#6366F1'], angle: 135 },
  { kind: 'gradient', colors: ['#3FE07A', '#22D3EE'], angle: 135 },
  { kind: 'gradient', colors: ['#F472B6', '#8B5CF6'], angle: 135 },
  { kind: 'gradient', colors: ['#0EA5E9', '#6366F1'], angle: 145 },
  { kind: 'gradient', colors: ['#F59E0B', '#EF4444'], angle: 135 },
  { kind: 'gradient', colors: ['#14B8A6', '#3B82F6'], angle: 120 },
  { kind: 'gradient', colors: ['#A855F7', '#EC4899'], angle: 135 },
  { kind: 'gradient', colors: ['#22D3EE', '#3FE07A', '#A78BFA'], angle: 135 },
  { kind: 'solid', colors: ['#22D3EE'] },
  { kind: 'solid', colors: ['#A78BFA'] },
  { kind: 'solid', colors: ['#3FE07A'] },
  { kind: 'solid', colors: ['#F87171'] },
  { kind: 'solid', colors: ['#FFB840'] },
  { kind: 'solid', colors: ['#5B6BC4'] },
  { kind: 'solid', colors: ['#F472B6'] },
]

/** Deterministic harmonious theme from a stable id (username / user id). */
export function avatarThemeFromId(id: string): AvatarTheme {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return AVATAR_THEME_PRESETS[hash % AVATAR_THEME_PRESETS.length]!
}

/** Pick a random curated theme (studio shuffle). */
export function randomAvatarTheme(exclude?: AvatarTheme | null): AvatarTheme {
  const pool =
    exclude == null
      ? AVATAR_THEME_PRESETS
      : AVATAR_THEME_PRESETS.filter((p) => avatarThemeCss(p) !== avatarThemeCss(exclude))
  const list = pool.length > 0 ? pool : AVATAR_THEME_PRESETS
  return list[Math.floor(Math.random() * list.length)]!
}

/** CSS `background` value for an avatar / cover theme. */
export function avatarThemeCss(theme: AvatarTheme): string {
  if (theme.kind === 'solid' || theme.colors.length === 1) {
    return theme.colors[0]!
  }
  const angle = theme.angle ?? 135
  const stops = theme.colors.join(', ')
  return `linear-gradient(${angle}deg, ${stops})`
}

export function parseAvatarTheme(raw: string | null | undefined): AvatarTheme | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    const result = AvatarThemeSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function parseLogoPlacement(raw: string | null | undefined): LogoPlacement | null {
  if (!raw) return null
  const result = LogoPlacementSchema.safeParse(raw)
  return result.success ? result.data : null
}

/** Resolve display theme: stored theme, else deterministic default from seed. */
export function resolveAvatarTheme(
  storedJson: string | null | undefined,
  seed: string,
): AvatarTheme {
  return parseAvatarTheme(storedJson) ?? avatarThemeFromId(seed)
}

export function logoShowsOnAvatar(placement: LogoPlacement | null | undefined): boolean {
  return placement === 'AVATAR' || placement === 'BOTH'
}

export function logoShowsOnCover(placement: LogoPlacement | null | undefined): boolean {
  return placement === 'COVER' || placement === 'BOTH'
}
