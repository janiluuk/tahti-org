// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { resolveWizardStep, wizardStepHref } from './_wizard-steps'

describe('resolveWizardStep', () => {
  it('locks to step 1 until a channel exists', () => {
    expect(resolveWizardStep('4', false)).toBe(1)
    expect(resolveWizardStep(undefined, false)).toBe(1)
  })
  it('honours a valid step once the channel exists', () => {
    expect(resolveWizardStep('3', true)).toBe(3)
    expect(resolveWizardStep('5', true)).toBe(5)
  })
  it('falls back to step 1 for junk or out-of-range values', () => {
    expect(resolveWizardStep('0', true)).toBe(1)
    expect(resolveWizardStep('6', true)).toBe(1)
    expect(resolveWizardStep('abc', true)).toBe(1)
    expect(resolveWizardStep(undefined, true)).toBe(1)
  })
  it('builds step hrefs', () => {
    expect(wizardStepHref(2)).toBe('/dashboard/setup-channel?step=2')
  })
})
