// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import {
  computeKeepSegments,
  isInsideCut,
  mergeCuts,
  postCutDuration,
  sourceTimeToPostCut,
} from './segments.js'
import { EditListSchema, type EditList } from './types.js'

export interface ValidationIssue {
  path: string
  message: string
}

export interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
  edit?: EditList
}

export function validateEditList(input: unknown): ValidationResult {
  const parsed = EditListSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    }
  }
  return validateEditListParsed(parsed.data)
}

export function validateEditListParsed(edit: EditList): ValidationResult {
  const issues: ValidationIssue[] = []
  const merged = mergeCuts(edit.cuts)

  for (let i = 0; i < edit.cuts.length; i++) {
    const cut = edit.cuts[i]!
    if (cut.end <= cut.start) {
      issues.push({ path: `cuts[${i}]`, message: 'Cut end must be after start' })
    }
    if (cut.end > edit.sourceDuration + 1e-6) {
      issues.push({ path: `cuts[${i}]`, message: 'Cut extends past source duration' })
    }
  }

  const segments = computeKeepSegments(edit.sourceDuration, merged)
  if (postCutDuration(segments) <= 0) {
    issues.push({ path: 'cuts', message: 'All audio would be removed' })
  }

  for (let i = 0; i < edit.fades.length; i++) {
    const fade = edit.fades[i]!
    if (fade.duration <= 0) continue
    if (isInsideCut(fade.at, merged)) {
      issues.push({ path: `fades[${i}]`, message: 'Fade overlaps a removed region' })
      continue
    }
    const postAt = sourceTimeToPostCut(fade.at, segments)
    if (postAt === null) {
      issues.push({ path: `fades[${i}]`, message: 'Fade anchor is inside a cut' })
    }
  }

  if (edit.eq.enabled && edit.eq.bands.length === 0) {
    issues.push({ path: 'eq.bands', message: 'EQ enabled but no bands configured' })
  }

  return issues.length === 0 ? { ok: true, issues: [], edit } : { ok: false, issues }
}
