// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import {
  createMyTheme,
  deleteMyTheme,
  fetchMyThemes,
  patchMyTheme,
  submitMyThemePublic,
} from '@/lib/themes-client'

export async function listMyThemes() {
  return fetchMyThemes()
}

export async function saveNewTheme(input: {
  name: string
  vars: Record<string, string>
  dark: Record<string, string>
}) {
  return createMyTheme(input)
}

export async function updateMyTheme(
  id: string,
  patch: { name?: string; vars?: Record<string, string>; dark?: Record<string, string> },
) {
  return patchMyTheme(id, patch)
}

export async function removeMyTheme(id: string) {
  return deleteMyTheme(id)
}

export async function submitThemeAsPublic(id: string) {
  return submitMyThemePublic(id)
}
