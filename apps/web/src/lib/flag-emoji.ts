/** Convert ISO 3166-1 alpha-2 code to a regional indicator flag emoji (e.g. "FI" → "🇫🇮"). */
export function flagEmoji(cc: string): string {
  if (!cc || cc.length !== 2) return ''
  const upper = cc.toUpperCase()
  return [...upper].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('')
}
