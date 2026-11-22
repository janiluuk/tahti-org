// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const LINK_PAGE_MAX_OWN_LINKS = 20
export const LINK_PAGE_MAX_SOUNDS = 20
export const LINK_PAGE_MAX_SETS = 20
export const LINK_PAGE_DEFAULT_SOUNDS = 5
export const LINK_PAGE_DEFAULT_SETS = 5

export const LinkPageOwnLinkSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().url().max(2000),
})

export const LinkPagePlayModeSchema = z.enum(['inline', 'open'])

export const LinkPageConfigSchema = z.object({
  ownLinks: z.array(LinkPageOwnLinkSchema).max(LINK_PAGE_MAX_OWN_LINKS).default([]),
  soundIds: z.array(z.string().min(1).max(64)).max(LINK_PAGE_MAX_SOUNDS).default([]),
  setIds: z.array(z.string().min(1).max(64)).max(LINK_PAGE_MAX_SETS).default([]),
  playMode: LinkPagePlayModeSchema.default('inline'),
})

export const LinkPageConfigPatchSchema = z
  .object({
    ownLinks: z.array(LinkPageOwnLinkSchema).max(LINK_PAGE_MAX_OWN_LINKS).optional(),
    soundIds: z.array(z.string().min(1).max(64)).max(LINK_PAGE_MAX_SOUNDS).optional(),
    setIds: z.array(z.string().min(1).max(64)).max(LINK_PAGE_MAX_SETS).optional(),
    playMode: LinkPagePlayModeSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' })

export type LinkPageOwnLink = z.infer<typeof LinkPageOwnLinkSchema>
export type LinkPagePlayMode = z.infer<typeof LinkPagePlayModeSchema>
export type LinkPageConfig = z.infer<typeof LinkPageConfigSchema>
export type LinkPageConfigPatch = z.infer<typeof LinkPageConfigPatchSchema>

/** Keys in User.socialLinks that are URLs shown on the link page (not meta). */
export const LINK_PAGE_SOCIAL_KEYS = [
  'website',
  'instagram',
  'facebook',
  'x',
  'tiktok',
  'youtube',
  'soundcloud',
  'bandcamp',
  'mixcloud',
  'spotify',
  'hearthisAt',
  'twitch',
  'kick',
  'discord',
] as const

export type LinkPageSocialKey = (typeof LINK_PAGE_SOCIAL_KEYS)[number]

export const LinkPageSocialLinkSchema = z.object({
  key: z.string(),
  label: z.string(),
  url: z.string(),
  source: z.enum(['profile', 'own']),
  id: z.string().optional(),
})

export const LinkPageSoundCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  coverUrl: z.string().nullable(),
  durationSec: z.number().int().nullable(),
  playUrl: z.string().nullable().optional(),
  badge: z.enum(['live', 'replay']).nullable().optional(),
})

export const LinkPageSetCardSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  coverUrl: z.string().nullable(),
  itemCount: z.number().int(),
  url: z.string(),
})

export const PublicLinkPageSchema = z.object({
  playMode: LinkPagePlayModeSchema,
  links: z.array(LinkPageSocialLinkSchema),
  sounds: z.array(LinkPageSoundCardSchema),
  sets: z.array(LinkPageSetCardSchema),
  siteUrl: z.string(),
  linkPageUrl: z.string(),
})

export type PublicLinkPage = z.infer<typeof PublicLinkPageSchema>

export function parseLinkPageConfig(raw: unknown): LinkPageConfig {
  const parsed = LinkPageConfigSchema.safeParse(raw ?? {})
  if (parsed.success) return parsed.data
  return LinkPageConfigSchema.parse({})
}

export function socialLinksForLinkPage(
  socialLinks: unknown,
): Array<{ key: string; label: string; url: string; source: 'profile' }> {
  if (!socialLinks || typeof socialLinks !== 'object') return []
  const bag = socialLinks as Record<string, unknown>
  const out: Array<{ key: string; label: string; url: string; source: 'profile' }> = []
  for (const key of LINK_PAGE_SOCIAL_KEYS) {
    const value = bag[key]
    if (typeof value !== 'string') continue
    const url = value.trim()
    if (!url) continue
    out.push({
      key,
      label: linkPageSocialLabel(key),
      url,
      source: 'profile',
    })
  }
  return out
}

export function linkPageSocialLabel(key: string): string {
  const labels: Record<string, string> = {
    website: 'Website',
    instagram: 'Instagram',
    facebook: 'Facebook',
    x: 'X',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    soundcloud: 'SoundCloud',
    bandcamp: 'Bandcamp',
    mixcloud: 'Mixcloud',
    spotify: 'Spotify',
    hearthisAt: 'hearthis.at',
    twitch: 'Twitch',
    kick: 'Kick',
    discord: 'Discord',
  }
  return labels[key] ?? key
}
