// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** M11: in-process counters for Stripe webhook failures (scraped via /metrics). */

let verifyFailures = 0
let handlerFailures = 0

export function recordStripeWebhookVerifyFailure(): void {
  verifyFailures++
}

export function recordStripeWebhookHandlerFailure(): void {
  handlerFailures++
}

export function renderStripeWebhookMetricLines(): string[] {
  return [
    '# HELP tahti_stripe_webhook_verify_failures_total Stripe signature verification failures.',
    '# TYPE tahti_stripe_webhook_verify_failures_total counter',
    `tahti_stripe_webhook_verify_failures_total ${verifyFailures}`,
    '# HELP tahti_stripe_webhook_handler_failures_total Stripe webhook handler errors (500 responses).',
    '# TYPE tahti_stripe_webhook_handler_failures_total counter',
    `tahti_stripe_webhook_handler_failures_total ${handlerFailures}`,
  ]
}
