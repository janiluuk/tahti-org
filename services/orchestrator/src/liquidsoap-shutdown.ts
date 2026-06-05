// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** STREAM-010: telnet command registered in liquidsoap-channel.liq.template */
export const LIQUIDSOAP_GRACEFUL_SHUTDOWN_COMMAND = 'graceful_shutdown'

export const LIQUIDSOAP_TELNET_PORT = parseInt(process.env.LIQUIDSOAP_TELNET_PORT ?? '19000', 10)

/** Fade duration in liquidsoap template + buffer before docker stop. */
export const LIQUIDSOAP_FADE_SEC = parseInt(process.env.LIQUIDSOAP_FADE_SEC ?? '4', 10)

export function liquidsoapGracefulShutdownShell(containerName: string): string {
  return [
    `docker exec ${containerName} sh -c`,
    `'echo ${LIQUIDSOAP_GRACEFUL_SHUTDOWN_COMMAND} | nc -w 2 127.0.0.1 ${LIQUIDSOAP_TELNET_PORT}'`,
  ].join(' ')
}

export function liquidsoapGracefulShutdownWaitMs(fadeSec = LIQUIDSOAP_FADE_SEC): number {
  return (fadeSec + 2) * 1000
}
