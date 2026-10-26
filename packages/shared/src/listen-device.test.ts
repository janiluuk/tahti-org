// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { parseListenDevice } from './listen-device.js'

describe('parseListenDevice', () => {
  it('reads desktop Chrome on Windows', () => {
    expect(
      parseListenDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      ),
    ).toEqual({
      browser: 'Chrome',
      os: 'Windows 10',
      deviceType: 'Desktop',
      deviceVendor: 'Unknown',
      isBot: false,
    })
  })

  it('reads Mobile Safari on an iPhone', () => {
    expect(
      parseListenDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({
      browser: 'Mobile Safari',
      os: 'iOS 18',
      deviceType: 'Smartphone',
      deviceVendor: 'Apple',
      isBot: false,
    })
  })

  it('reads Samsung Internet on a Galaxy phone and an Android tablet', () => {
    expect(
      parseListenDevice(
        'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
      ),
    ).toMatchObject({
      browser: 'Samsung Internet',
      os: 'Android 14',
      deviceType: 'Smartphone',
      deviceVendor: 'Samsung',
    })
    expect(
      parseListenDevice(
        'Mozilla/5.0 (Linux; Android 13; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toMatchObject({ os: 'Android 13', deviceType: 'Tablet', deviceVendor: 'Google' })
  })

  it('reads Firefox on Linux, Safari on macOS and Edge', () => {
    expect(
      parseListenDevice('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'),
    ).toMatchObject({ browser: 'Firefox', os: 'GNU/Linux', deviceType: 'Desktop' })
    expect(
      parseListenDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
      ),
    ).toMatchObject({ browser: 'Safari', os: 'macOS 10.15', deviceVendor: 'Apple' })
    expect(
      parseListenDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      ),
    ).toMatchObject({ browser: 'Edge' })
  })

  it('flags bots and app clients', () => {
    expect(parseListenDevice('Googlebot/2.1 (+http://www.google.com/bot.html)')).toMatchObject({
      browser: 'Bot',
      deviceType: 'Bot',
      isBot: true,
    })
    expect(parseListenDevice('curl/8.5.0').isBot).toBe(true)
    expect(parseListenDevice('VLC/3.0.20 LibVLC/3.0.20').browser).toBe('VLC')
  })

  it('answers Unknown for an empty header', () => {
    expect(parseListenDevice(undefined)).toEqual({
      browser: 'Unknown',
      os: 'Unknown',
      deviceType: 'Unknown',
      deviceVendor: 'Unknown',
      isBot: false,
    })
  })
})
