// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import NextLink from 'next/link'
import { Text } from '@tahti/ui'
import { WIZARD_STEPS, wizardStepHref, type WizardStepId } from './_wizard-steps'

/** Frame around one wizard step: progress list + title. Steps up to `reachable` are links. */
export function WizardShell({
  current,
  reachable,
  title,
  lede,
  children,
}: {
  current: WizardStepId
  reachable: WizardStepId
  title: string
  lede: string
  children: ReactNode
}) {
  return (
    <section className="setup-wizard" aria-labelledby="setup-wizard-title">
      <nav aria-label="Setup progress">
        <ol className="setup-wizard__steps">
          {WIZARD_STEPS.map((step) => {
            const active = step.id === current
            const label = `${step.id}. ${step.label}`
            return (
              <li
                key={step.id}
                className="setup-wizard__step"
                data-active={active || undefined}
                data-done={step.id < current || undefined}
                aria-current={active ? 'step' : undefined}
              >
                {!active && step.id <= reachable ? (
                  <NextLink href={wizardStepHref(step.id)}>{label}</NextLink>
                ) : (
                  <span>{label}</span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
      <p className="setup-wizard__eyebrow">
        Step {current} of {WIZARD_STEPS.length}
      </p>
      <h1 id="setup-wizard-title" className="setup-wizard__title">
        {title}
      </h1>
      <Text tone="muted">{lede}</Text>
      <div className="setup-wizard__body">{children}</div>
    </section>
  )
}
