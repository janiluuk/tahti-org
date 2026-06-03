// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  recordStripeWebhookHandlerFailure,
  recordStripeWebhookVerifyFailure,
  renderStripeWebhookMetricLines,
} from './stripe-webhook-metrics.js'

describe('stripe-webhook-metrics', () => {
  it('renders prometheus counters after recording failures', () => {
    recordStripeWebhookVerifyFailure()
    recordStripeWebhookHandlerFailure()
    const text = renderStripeWebhookMetricLines().join('\n')
    expect(text).toContain('tahti_stripe_webhook_verify_failures_total')
    expect(text).toContain('tahti_stripe_webhook_handler_failures_total')
  })
})
