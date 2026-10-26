// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Coarse device facts for a listen session, read from the User-Agent header
 * so Studio stats can show browser / OS / device shares. Only these labels
 * are stored, never the raw UA string. A hand-rolled table instead of a UA
 * library: the stats only need the big names, everything else is "Unknown".
 */
export interface ListenDevice {
  browser: string
  os: string
  deviceType: 'Desktop' | 'Smartphone' | 'Tablet' | 'Bot' | 'Unknown'
  deviceVendor: string
  isBot: boolean
}

export const LISTEN_DEVICE_UNKNOWN = 'Unknown'

const BOT_UA =
  /(bot\b|bot\/|crawler|spider|slurp|curl\/|wget\/|python-requests|python-urllib|scrapy|headlesschrome|phantomjs|java\/|go-http-client|okhttp|axios\/|node-fetch|lighthouse|facebookexternalhit|embedly|preview)/i

const BROWSERS: [RegExp, string][] = [
  [/\bVLC\b|LibVLC/i, 'VLC'],
  [/\bTauri\b|tahti-desktop/i, 'Tahti Desktop'],
  [/MicroMessenger/i, 'WeChat'],
  [/\bEdg(e|A|iOS)?\//, 'Edge'],
  [/\bOPR\/|\bOpera\b/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/\bYaBrowser\//, 'Yandex'],
  [/\bVivaldi\//, 'Vivaldi'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/CriOS\/|Chrome\/|Chromium\//, 'Chrome'],
  [/Version\/[\d.]+.*Mobile.*Safari\//, 'Mobile Safari'],
  [/Version\/[\d.]+.*Safari\//, 'Safari'],
]

const VENDORS: [RegExp, string][] = [
  [/iPhone|iPad|iPod|Macintosh|Mac OS X/, 'Apple'],
  [/SM-[A-Z0-9]+|Samsung|GT-[A-Z0-9]+/i, 'Samsung'],
  [/HUAWEI|Honor|; (ELE|VOG|ANE|MAR|LYA)-/i, 'Huawei'],
  [/Pixel|Nexus/, 'Google'],
  [/OnePlus/i, 'OnePlus'],
  [/OPPO|; CPH\d{4}/i, 'OPPO'],
  [/; RMX\d{4}|Realme/i, 'Realme'],
  [/Xiaomi|Redmi|POCO|; M\d{4}[A-Z0-9]+/i, 'Xiaomi'],
  [/vivo|; V\d{4}/i, 'vivo'],
  [/Sony|; (SO|XQ)-[A-Z0-9]+/i, 'Sony'],
  [/Nokia/i, 'Nokia'],
  [/moto|Motorola/i, 'Motorola'],
]

function windowsName(version: string): string {
  if (version === '10.0') return 'Windows 10'
  if (version === '6.3') return 'Windows 8.1'
  if (version === '6.2') return 'Windows 8'
  if (version === '6.1') return 'Windows 7'
  return 'Windows'
}

function osName(ua: string): string {
  const windows = /Windows NT (\d+\.\d+)/.exec(ua)
  if (windows) return windowsName(windows[1]!)
  const ios = /(?:iPhone|iPad|iPod)[^)]*? OS (\d+)_/.exec(ua)
  if (ios) return `iOS ${ios[1]}`
  const android = /Android (\d+)/.exec(ua)
  if (android) return `Android ${android[1]}`
  if (/Android/.test(ua)) return 'Android'
  const mac = /Mac OS X (\d+)[._](\d+)/.exec(ua)
  if (mac) return mac[1] === '10' ? `macOS 10.${mac[2]}` : `macOS ${mac[1]}`
  if (/Macintosh/.test(ua)) return 'macOS'
  if (/CrOS/.test(ua)) return 'ChromeOS'
  if (/Linux|X11/.test(ua)) return 'GNU/Linux'
  return LISTEN_DEVICE_UNKNOWN
}

function deviceType(ua: string, os: string): ListenDevice['deviceType'] {
  if (/iPad|Tablet|Kindle|Silk\//i.test(ua)) return 'Tablet'
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return 'Tablet'
  if (/iPhone|iPod|Mobile|Android/.test(ua)) return 'Smartphone'
  if (/^(Windows|macOS|GNU\/Linux|ChromeOS)/.test(os)) return 'Desktop'
  return 'Unknown'
}

export function parseListenDevice(userAgent: string | null | undefined): ListenDevice {
  const ua = (userAgent ?? '').slice(0, 512)
  if (!ua.trim()) {
    return {
      browser: LISTEN_DEVICE_UNKNOWN,
      os: LISTEN_DEVICE_UNKNOWN,
      deviceType: 'Unknown',
      deviceVendor: LISTEN_DEVICE_UNKNOWN,
      isBot: false,
    }
  }
  if (BOT_UA.test(ua)) {
    return {
      browser: 'Bot',
      os: 'Bot',
      deviceType: 'Bot',
      deviceVendor: LISTEN_DEVICE_UNKNOWN,
      isBot: true,
    }
  }
  const os = osName(ua)
  return {
    browser: BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? LISTEN_DEVICE_UNKNOWN,
    os,
    deviceType: deviceType(ua, os),
    deviceVendor: VENDORS.find(([pattern]) => pattern.test(ua))?.[1] ?? LISTEN_DEVICE_UNKNOWN,
    isBot: false,
  }
}
