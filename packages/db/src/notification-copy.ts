// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export type NotificationLocale = 'en' | 'fi'

export function resolveNotificationLocale(uiLocale: string | null | undefined): NotificationLocale {
  return uiLocale === 'fi' ? 'fi' : 'en'
}

type Copy = { title: string; body: string | null }

const THEME_UNDER_REVIEW = {
  en: (name: string): Copy => ({
    title: `"${name}" is in review`,
    body: 'An admin will approve or reject it soon.',
  }),
  fi: (name: string): Copy => ({
    title: `"${name}" on arvioitavana`,
    body: 'Ylläpito hyväksyy tai hylkää sen pian.',
  }),
} as const

export function themeUnderReviewCopy(locale: NotificationLocale, themeName: string): Copy {
  return THEME_UNDER_REVIEW[locale](themeName)
}
