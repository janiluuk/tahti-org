// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { isAllowedSnsSubscribeUrl } from './newsletter-bounce.js'

describe('isAllowedSnsSubscribeUrl', () => {
  it('allows https SNS regional hosts', () => {
    expect(
      isAllowedSnsSubscribeUrl(
        'https://sns.eu-west-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=arn&Token=t',
      ),
    ).toBe(true)
  })

  it('rejects non-SNS hosts and non-https', () => {
    expect(isAllowedSnsSubscribeUrl('https://evil.example/?Action=ConfirmSubscription')).toBe(false)
    expect(
      isAllowedSnsSubscribeUrl('http://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription'),
    ).toBe(false)
    expect(isAllowedSnsSubscribeUrl('not-a-url')).toBe(false)
  })
})
