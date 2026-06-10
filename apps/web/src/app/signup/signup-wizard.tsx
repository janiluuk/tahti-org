// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { SIGNUP_STEPS, type SignupStepId } from '@/lib/signup'

export function SignupWizard({ current }: { current: SignupStepId }) {
  const currentIndex = SIGNUP_STEPS.findIndex((s) => s.id === current)

  return (
    <nav className="signup-wizard" aria-label="Signup progress">
      <ol className="signup-wizard__list">
        {SIGNUP_STEPS.map((step, index) => {
          const done = index < currentIndex
          const active = step.id === current
          const className = [
            'signup-wizard__step',
            done ? 'signup-wizard__step--done' : '',
            active ? 'signup-wizard__step--active' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <li key={step.id} className={className} aria-current={active ? 'step' : undefined}>
              {done ? (
                <Link href={step.href} className="signup-wizard__link">
                  <span className="signup-wizard__num">{index + 1}</span>
                  <span className="signup-wizard__label">{step.label}</span>
                </Link>
              ) : (
                <span className="signup-wizard__link">
                  <span className="signup-wizard__num">{index + 1}</span>
                  <span className="signup-wizard__label">{step.label}</span>
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
