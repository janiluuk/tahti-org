// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export const WIZARD_STEPS = [
  { id: 1, label: 'Identity' },
  { id: 2, label: 'Genres & listing' },
  { id: 3, label: 'Look' },
  { id: 4, label: 'Rotation' },
  { id: 5, label: 'Go live' },
] as const

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id']

/** Parses `?step=`. Without a channel only step 1 is reachable; junk falls back to step 1. */
export function resolveWizardStep(raw: string | undefined, hasChannel: boolean): WizardStepId {
  if (!hasChannel) return 1
  const n = Number(raw)
  if (Number.isInteger(n) && n >= 1 && n <= WIZARD_STEPS.length) return n as WizardStepId
  return 1
}

export function wizardStepHref(step: WizardStepId): string {
  return `/dashboard/setup-channel?step=${step}`
}
