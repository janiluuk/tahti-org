// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { postExcerpt, stripPostMarkup } from './post-excerpt.js'

describe('stripPostMarkup', () => {
  it('removes markdown syntax but keeps the words', () => {
    const body = [
      '# New EP out',
      '',
      'It is **finally** here, check [the release](https://tahti.live/r/ep) and _enjoy_.',
      '',
      '- track one',
      '- track `two`',
      '> quoted line',
      '![cover art](https://img.example/cover.png)',
    ].join('\n')
    expect(stripPostMarkup(body)).toBe(
      'New EP out It is finally here, check the release and enjoy. track one track two quoted line cover art',
    )
  })

  it('removes HTML tags and decodes entities', () => {
    expect(
      stripPostMarkup('<p>Tour &amp; merch</p><script>alert(1)</script><br/>See&nbsp;you'),
    ).toBe('Tour & merch See you')
  })

  it('keeps snake_case words and lone asterisks intact', () => {
    expect(stripPostMarkup('my_track_name is 5 * 3 stars')).toBe('my_track_name is 5 * 3 stars')
  })

  it('collapses whitespace and newlines', () => {
    expect(stripPostMarkup('  one\n\n\ttwo   three \n')).toBe('one two three')
  })
})

describe('postExcerpt', () => {
  it('returns short text unchanged without an ellipsis', () => {
    expect(postExcerpt('Short and sweet.', 280)).toBe('Short and sweet.')
  })

  it('returns text exactly at the limit unchanged', () => {
    const text = 'a'.repeat(280)
    expect(postExcerpt(text, 280)).toBe(text)
  })

  it('cuts long text to the limit at a word boundary and ends with an ellipsis', () => {
    const body = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ')
    const excerpt = postExcerpt(body, 280)
    expect(Array.from(excerpt).length).toBeLessThanOrEqual(280)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt.slice(0, -1)).toMatch(/word\d+$/)
    expect(body.startsWith(excerpt.slice(0, -1))).toBe(true)
  })

  it('hard-cuts a single unbroken run of characters', () => {
    const excerpt = postExcerpt('x'.repeat(500), 280)
    expect(excerpt).toBe(`${'x'.repeat(279)}…`)
  })

  it('counts characters by code point so emoji are never split', () => {
    const excerpt = postExcerpt('🎵'.repeat(300), 280)
    expect(Array.from(excerpt)).toHaveLength(280)
    expect(excerpt).toBe(`${'🎵'.repeat(279)}…`)
  })

  it('measures the limit after markup is stripped', () => {
    const body = `**${'b'.repeat(279)}**`
    expect(postExcerpt(body, 280)).toBe('b'.repeat(279))
  })
})
