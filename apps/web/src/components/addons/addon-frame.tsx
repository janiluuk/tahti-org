// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ADDON_MESSAGE_SOURCE,
  isWidgetToHostMessage,
  type HostToWidgetMessage,
} from '@tahti/addon-sdk'

export interface AddonFrameProps {
  /** Relative path from the render feed, e.g. "/widget-sandbox/<bundleHash>". */
  sandboxUrl: string
  name: string
  context: unknown
  config: unknown
}

const DEFAULT_HEIGHT_PX = 96
const MAX_HEIGHT_PX = 2000

function isSameOriginPath(url: string): boolean {
  // Widgets never get a real navigable URL of their own — only a path is
  // ever allowlisted, so there's nothing for openLink to point off-site with.
  return url.startsWith('/') && !url.startsWith('//')
}

/** Renders one widget inside a sandboxed, cookieless iframe (see
 * /widget-sandbox/[bundleHash]) and speaks the @tahti/addon-sdk postMessage
 * protocol to it. This is the ONLY place widget code ever runs — never in the
 * main page's own JS realm. */
export function AddonFrame({ sandboxUrl, name, context, config }: AddonFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(DEFAULT_HEIGHT_PX)

  // Read via ref inside the listener below (mounted once) so a re-render with
  // new context/config doesn't need to tear down and reattach the listener.
  const contextRef = useRef(context)
  contextRef.current = context
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const frameWindow = iframeRef.current?.contentWindow
      // The trust boundary: verify this message came from OUR iframe's window
      // object specifically, never trust the (meaningless, "null") origin an
      // opaque-origin sandboxed frame reports.
      if (!frameWindow || event.source !== frameWindow) return
      if (!isWidgetToHostMessage(event.data)) return

      if (event.data.type === 'ready') {
        const init: HostToWidgetMessage = {
          source: ADDON_MESSAGE_SOURCE,
          type: 'init',
          context: contextRef.current,
          config: configRef.current,
        }
        frameWindow.postMessage(init, '*')
      } else if (event.data.type === 'resize') {
        setHeight(Math.min(Math.max(event.data.height, DEFAULT_HEIGHT_PX), MAX_HEIGHT_PX))
      } else if (event.data.type === 'open-link') {
        if (isSameOriginPath(event.data.url)) {
          window.open(event.data.url, '_blank', 'noopener,noreferrer')
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <iframe
      ref={iframeRef}
      src={sandboxUrl}
      title={name}
      sandbox="allow-scripts"
      style={{ width: '100%', height, border: 'none', display: 'block' }}
    />
  )
}
