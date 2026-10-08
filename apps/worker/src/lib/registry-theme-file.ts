// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Builds a theme file in the shape the tahti-registry catalog validates
// (schema/theme-file.schema.json there). Tahti Player's Store reads that
// catalog, so an approved theme has to land in it to be installable. The
// registry's own workflow regenerates themes.json from the files under
// themes/, so only the theme file is written here.

type ThemeVars = Record<string, string>

export interface RegistryThemeFile {
  version: 1
  name: string
  author: string
  description: string
  tags: string[]
  palette: [string, string, string, string]
  vars: ThemeVars
  dark: ThemeVars
}

const PALETTE_KEYS = ['background', 'background-secondary', 'primary', 'foreground'] as const
const PALETTE_FALLBACK = ['rgb(17 17 17)', 'rgb(31 31 31)', 'rgb(136 136 136)', 'white'] as const

/** Keeps string values only and drops a leading `--`, which the registry refuses. */
function cleanVars(raw: unknown): ThemeVars {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: ThemeVars = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const name = key.replace(/^--/, '')
    if (name && typeof value === 'string') out[name] = value
  }
  return out
}

export function registryThemeSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'theme'
  )
}

export function buildRegistryThemeFile(theme: {
  name: string
  author: string
  varsJson: unknown
  darkJson: unknown
}): RegistryThemeFile {
  const vars = cleanVars(theme.varsJson)
  const dark = cleanVars(theme.darkJson)
  const name = theme.name.trim().slice(0, 64) || 'Untitled theme'
  const author = theme.author.trim().slice(0, 64) || 'Tahti artist'
  const palette = PALETTE_KEYS.map(
    (key, index) => dark[key] ?? vars[key] ?? PALETTE_FALLBACK[index]!,
  ) as RegistryThemeFile['palette']
  return {
    version: 1,
    name,
    author,
    // The registry requires 10-200 characters; submissions carry no description.
    description: `Community theme by ${author}, made in the Tahti theme editor.`.slice(0, 200),
    tags: [],
    palette,
    vars,
    dark,
  }
}
