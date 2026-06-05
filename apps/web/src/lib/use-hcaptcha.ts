// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'

const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? ''

declare global {
  interface Window {
    hcaptcha?: {
      render(container: string | HTMLElement, params: Record<string, string>): string
      getResponse(widgetId?: string): string
      reset(widgetId?: string): void
    }
    onHcaptchaLoad?: () => void
  }
}

/** Returns captcha container ref, widget id ref, and whether hCaptcha is required. */
export function useHcaptcha(enabled: boolean) {
  const captchaRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | undefined>(undefined)
  const required = Boolean(HCAPTCHA_SITE_KEY)

  useEffect(() => {
    if (!enabled || !required) return

    const render = () => {
      if (!captchaRef.current || !window.hcaptcha) return
      widgetIdRef.current = window.hcaptcha.render(captchaRef.current, {
        sitekey: HCAPTCHA_SITE_KEY,
        theme: 'dark',
      })
    }

    if (window.hcaptcha) {
      render()
    } else {
      window.onHcaptchaLoad = render
      const script = document.createElement('script')
      script.src = 'https://js.hcaptcha.com/1/api.js?onload=onHcaptchaLoad&render=explicit'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }, [enabled, required])

  function getToken(): string | undefined {
    if (!required || !window.hcaptcha) return undefined
    return window.hcaptcha.getResponse(widgetIdRef.current)
  }

  function reset() {
    window.hcaptcha?.reset(widgetIdRef.current)
  }

  return { captchaRef, required, getToken, reset }
}
