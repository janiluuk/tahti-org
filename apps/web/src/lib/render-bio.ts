// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// PLAT-054: server-side Markdown → sanitised HTML for artist bios.

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Allow class on any element (needed for some rehype defaults)
    '*': [...(defaultSchema.attributes?.['*'] ?? [])],
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // Allow images in bios
    'img',
  ],
}

const processor = unified()
  .use(remarkParse)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeSanitize, schema)
  .use(rehypeStringify)

export async function renderBio(markdown: string): Promise<string> {
  const result = await processor.process(markdown)
  return String(result)
}
