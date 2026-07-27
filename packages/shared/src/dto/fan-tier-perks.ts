// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Structured perk codes an artist can toggle on a fan tier — a few of these
 * (FAN_CHAT, FAN_NEWSLETTER) also gate real features, see apps/api/src/lib/fan-perks.ts.
 * FanTier.perks itself is a free-text string[] (an artist can also type a custom
 * perk), so this is a display/editor convenience, not a DB-level enum. */
export const KNOWN_FAN_TIER_PERKS = [
  { key: 'FAN_CHAT', label: 'Fan-only chat' },
  { key: 'FAN_NEWSLETTER', label: 'Newsletter' },
  { key: 'FLAC', label: 'Lossless downloads' },
  { key: 'EXCLUSIVE_CONTENT', label: 'Exclusive content' },
] as const

const LABEL_BY_KEY = new Map<string, string>(KNOWN_FAN_TIER_PERKS.map((p) => [p.key, p.label]))

/** A known perk key (e.g. "FAN_CHAT") displays as its friendly label; anything
 * else is an artist's own custom-typed perk text, shown as-is. */
export function humanizeFanTierPerk(perk: string): string {
  return LABEL_BY_KEY.get(perk) ?? perk
}
