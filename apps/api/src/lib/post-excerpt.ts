// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const ELLIPSIS = '…'

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match
  })
}

/** Markdown and HTML reduced to the words a reader would see. */
export function stripPostMarkup(body: string): string {
  return decodeEntities(
    body
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/^\s*(```|~~~).*$/gm, ' ')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s*\[[^\]]+\]:\s+\S+.*$/gm, ' ')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s*([-*_])(\s*\1){2,}\s*$/gm, ' ')
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
      .replace(/`+([^`]*)`+/g, '$1')
      .replace(/(\*\*|__|~~)(?=\S)([\s\S]*?\S)\1/g, '$2')
      // Single-character emphasis only when it wraps a phrase, so snake_case
      // words and lone asterisks survive.
      .replace(/(^|[^\w*])[*_](?=\S)([^*_\n]*?\S)[*_](?![\w*])/g, '$1$2'),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Plain-text preview of a post body, at most `max` characters including the
 * trailing ellipsis that marks a cut. Prefers to cut at a word boundary.
 */
export function postExcerpt(body: string, max: number): string {
  const text = stripPostMarkup(body)
  const chars = Array.from(text)
  if (chars.length <= max) return text

  const room = chars.slice(0, max - ELLIPSIS.length).join('')
  const lastSpace = room.lastIndexOf(' ')
  const cut = lastSpace >= room.length * 0.6 ? room.slice(0, lastSpace) : room
  return `${cut.replace(/[\s.,;:!?-]+$/, '')}${ELLIPSIS}`
}
