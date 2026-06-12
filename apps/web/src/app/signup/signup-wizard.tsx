// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { StatusPill } from '@tahti/ui'
import { SIGNUP_STEPS, type SignupStepId } from '@/lib/signup'

export function SignupWizard({ current }: { current: SignupStepId }) {
  const currentIndex = SIGNUP_STEPS.findIndex((s) => s.id === current)

  return (
    <nav className="signup-wizard" aria-label="Signup progress">
      <ol className="signup-wizard__list">
        {SIGNUP_STEPS.map((step, index) => {
          const done = index < currentIndex
          const active = step.id === current
          const stepLabel = `${index + 1} · ${step.label.toUpperCase()}`

          return (
            <li
              key={step.id}
              className="signup-wizard__step"
              aria-current={active ? 'step' : undefined}
            >
              {index > 0 && <span className="signup-wizard__arrow">→</span>}
              {active ? (
                <StatusPill tone="cyan">{stepLabel}</StatusPill>
              ) : done ? (
                <Link href={step.href} className="signup-wizard__link">
                  {stepLabel}
                </Link>
              ) : (
                <span className="signup-wizard__link">{stepLabel}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
