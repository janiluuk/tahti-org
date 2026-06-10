// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Lightweight client-side Markdown -> HTML for the newsletter "how it lands
// in inbox" preview. Sent newsletters are plain text (see
// apps/worker/src/jobs/newsletter-dispatch.ts) — this preview only helps the
// artist visualize structure (headings, emphasis, links, lists) before sending.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderInline(text: string): string {
  let out = escapeHtml(text)
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  )
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
  return out
}

export function renderNewsletterPreview(markdown: string): string {
  const blocks = markdown.trim().split(/\n{2,}/)
  return blocks
    .map((block) => {
      const heading = block.match(/^(#{1,6})\s+(.*)$/)
      if (heading) {
        // Map markdown h1-h6 onto h3-h5 so headings nest under the email subject.
        const level = Math.min(heading[1].length + 2, 5)
        return `<h${level}>${renderInline(heading[2])}</h${level}>`
      }
      if (/^[-*]\s+/.test(block)) {
        const items = block
          .split('\n')
          .map((line) => line.replace(/^[-*]\s+/, ''))
          .map((line) => `<li>${renderInline(line)}</li>`)
          .join('')
        return `<ul>${items}</ul>`
      }
      return `<p>${renderInline(block).replace(/\n/g, '<br />')}</p>`
    })
    .join('')
}
