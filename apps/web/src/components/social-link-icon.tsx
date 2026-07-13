// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

type SocialPlatform =
  | 'bandcamp'
  | 'soundcloud'
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'spotify'
  | 'discord'
  | 'twitch'
  | 'hearthis'
  | 'kick'
  | 'email'
  | 'website'

const LABEL_KEYWORDS: Array<[RegExp, SocialPlatform]> = [
  [/bandcamp/i, 'bandcamp'],
  [/soundcloud/i, 'soundcloud'],
  [/instagram|insta\b/i, 'instagram'],
  [/twitter|\bx\b/i, 'twitter'],
  [/facebook|\bfb\b/i, 'facebook'],
  [/tiktok/i, 'tiktok'],
  [/youtube|\byt\b/i, 'youtube'],
  [/spotify/i, 'spotify'],
  [/discord/i, 'discord'],
  [/twitch/i, 'twitch'],
  [/hearthis/i, 'hearthis'],
  [/\bkick\b/i, 'kick'],
  [/email|mail/i, 'email'],
]

const HOSTNAME_KEYWORDS: Array<[string, SocialPlatform]> = [
  ['bandcamp.com', 'bandcamp'],
  ['soundcloud.com', 'soundcloud'],
  ['instagram.com', 'instagram'],
  ['twitter.com', 'twitter'],
  ['x.com', 'twitter'],
  ['facebook.com', 'facebook'],
  ['tiktok.com', 'tiktok'],
  ['youtube.com', 'youtube'],
  ['youtu.be', 'youtube'],
  ['spotify.com', 'spotify'],
  ['discord.gg', 'discord'],
  ['discord.com', 'discord'],
  ['twitch.tv', 'twitch'],
  ['hearthis.at', 'hearthis'],
  ['kick.com', 'kick'],
]

/** Extracts the username from a kick.com channel URL, for building the player.kick.com embed. */
export function kickUsernameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.replace(/^www\./, '').includes('kick.com')) return null
    const username = parsed.pathname.split('/').filter(Boolean)[0]
    return username || null
  } catch {
    return null
  }
}

export function detectSocialPlatform(label: string, url: string): SocialPlatform {
  for (const [pattern, platform] of LABEL_KEYWORDS) {
    if (pattern.test(label)) return platform
  }
  if (url.startsWith('mailto:')) return 'email'
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    for (const [needle, platform] of HOSTNAME_KEYWORDS) {
      if (host.includes(needle)) return platform
    }
  } catch {
    // not a parseable URL — fall through to generic icon
  }
  return 'website'
}

function PlatformGlyph({ platform }: { platform: SocialPlatform }) {
  switch (platform) {
    case 'bandcamp':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M2 11l4-6h4l-4 6H2z" fill="currentColor" />
          <path d="M8 11l4-6h2l-4 6H8z" fill="currentColor" />
        </svg>
      )
    case 'soundcloud':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2 11h11a2.5 2.5 0 0 0 0-5 4 4 0 0 0-7.5-1.5A2.5 2.5 0 0 0 2 8v3z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'instagram':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect
            x="2"
            y="2"
            width="12"
            height="12"
            rx="3.5"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <circle cx="8" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="11.5" cy="4.5" r="0.8" fill="currentColor" />
        </svg>
      )
    case 'twitter':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2.5 2.5l5 7-5 4M13.5 2.5l-5 7 5 4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'facebook':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M9.5 13.5v-4h1.5l.3-2H9.5V6.2c0-.6.2-1 .9-1H11V3.4c-.3 0-1.1-.1-1.9-.1-2 0-3 1.2-3 3.1v2.1H4.5v2H6v4h1.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'tiktok':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M9 2.5c.3 1.7 1.4 2.8 3 3v2c-1.1 0-2.1-.3-3-1v4.3a3.3 3.3 0 1 1-3.3-3.3c.2 0 .4 0 .6.1v2a1.3 1.3 0 1 0 .7 1.2V2.5H9z"
            fill="currentColor"
          />
        </svg>
      )
    case 'youtube':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect
            x="1.5"
            y="3.5"
            width="13"
            height="9"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path d="M6.5 6l4 2-4 2V6z" fill="currentColor" />
        </svg>
      )
    case 'spotify':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2.5 5c3.5-2.2 7.5-2.2 11 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M3 8c3-1.8 7-1.8 10 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M4 11c2-1.2 6-1.2 8 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'discord':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect
            x="2"
            y="4.5"
            width="12"
            height="7.5"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <circle cx="6" cy="8.2" r="0.9" fill="currentColor" />
          <circle cx="10" cy="8.2" r="0.9" fill="currentColor" />
        </svg>
      )
    case 'twitch':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M3 2.5h10v7l-2.5 2.5H8l-2 2v-2H3v-9.5Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path
            d="M7 5.5v3M10.5 5.5v3"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'hearthis':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 13S2.5 9.4 2.5 5.9A2.9 2.9 0 0 1 8 4.3a2.9 2.9 0 0 1 5.5 1.6C13.5 9.4 8 13 8 13Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path
            d="M4.5 7h1.5l1-1.5 1.5 3 1-2h2"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'kick':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2.5 2.5v11h3V9.5l1.5 1.5v2.5h3v-3l-2.5-2.5 2.5-2.5v-3h-3v2.5L5.5 6.5V2.5h-3Z"
            fill="currentColor"
          />
        </svg>
      )
    case 'email':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect
            x="2"
            y="3.5"
            width="12"
            height="9"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M2.5 4.5l5.5 4.5 5.5-4.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      )
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M8 2.5c1.5 1.7 1.5 9.3 0 11M8 2.5c-1.5 1.7-1.5 9.3 0 11M2.5 8h11"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
      )
  }
}

/** Small platform icon resolved from a link's label or URL — bandcamp, soundcloud, instagram, etc., generic globe as fallback. */
export function SocialLinkIcon({
  label,
  url,
  className,
}: {
  label: string
  url: string
  className?: string
}) {
  const platform = detectSocialPlatform(label, url)
  return (
    <span className={className} aria-hidden>
      <PlatformGlyph platform={platform} />
    </span>
  )
}
