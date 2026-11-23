// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readdir, readFile } from 'node:fs/promises'

const WATCHED_COMMANDS = new Set(['ffmpeg', 'ffprobe'])
const DEFAULT_MAX_RUNTIME_SEC = 45 * 60
const DEFAULT_INTERVAL_MS = 60 * 1000
// Linux reports process start times in clock ticks; USER_HZ is 100 on every
// architecture the worker image is built for.
const CLOCK_TICKS_PER_SEC = 100

export interface ChildProcessInfo {
  pid: number
  command: string
  runtimeSec: number
}

/**
 * Parses one `/proc/<pid>/stat` line. The command sits in parentheses and may
 * itself contain spaces or parentheses, so fields are split after the last `)`.
 */
export function parseProcStat(
  stat: string,
  uptimeSec: number,
): { pid: number; ppid: number; command: string; runtimeSec: number } | null {
  const open = stat.indexOf('(')
  const close = stat.lastIndexOf(')')
  if (open < 0 || close < open) return null
  const pid = Number(stat.slice(0, open).trim())
  const command = stat.slice(open + 1, close)
  // Fields after the command start at field 3 (state); ppid is field 4 and
  // starttime is field 22.
  const rest = stat
    .slice(close + 1)
    .trim()
    .split(/\s+/)
  const ppid = Number(rest[1])
  const startTicks = Number(rest[19])
  if (!Number.isFinite(pid) || !Number.isFinite(ppid) || !Number.isFinite(startTicks)) return null
  const runtimeSec = Math.max(0, uptimeSec - startTicks / CLOCK_TICKS_PER_SEC)
  return { pid, ppid, command, runtimeSec }
}

/** ffmpeg / ffprobe processes started by `parentPid`, with how long each has run. */
export async function listMediaChildren(parentPid: number): Promise<ChildProcessInfo[]> {
  const uptimeSec = Number((await readFile('/proc/uptime', 'utf8')).split(/\s+/)[0])
  const entries = await readdir('/proc')
  const children: ChildProcessInfo[] = []
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue
    let stat: string
    try {
      stat = await readFile(`/proc/${entry}/stat`, 'utf8')
    } catch {
      continue
    }
    const parsed = parseProcStat(stat, uptimeSec)
    if (!parsed || parsed.ppid !== parentPid || !WATCHED_COMMANDS.has(parsed.command)) continue
    children.push({ pid: parsed.pid, command: parsed.command, runtimeSec: parsed.runtimeSec })
  }
  return children
}

export function overdueChildren(
  children: ChildProcessInfo[],
  maxRuntimeSec: number,
): ChildProcessInfo[] {
  return children.filter((child) => child.runtimeSec > maxRuntimeSec)
}

export function maxRuntimeSecFromEnv(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_RUNTIME_SEC
}

/**
 * Kills this worker's ffmpeg / ffprobe children that have run longer than
 * `maxRuntimeSec`. A hung encode otherwise holds its BullMQ job active forever
 * and, at WORKER_CONCURRENCY=1, every job queued behind it. Killing the process
 * makes fluent-ffmpeg reject, so the job fails through its normal error path
 * (status, owner notice, logs). Linux only: elsewhere it stays off.
 */
export function startFfmpegWatchdog(
  options: {
    maxRuntimeSec?: number
    intervalMs?: number
    kill?: (pid: number) => void
    list?: (parentPid: number) => Promise<ChildProcessInfo[]>
  } = {},
): () => void {
  if (process.platform !== 'linux' && !options.list) return () => {}
  const maxRuntimeSec =
    options.maxRuntimeSec ?? maxRuntimeSecFromEnv(process.env.FFMPEG_MAX_RUNTIME_SEC)
  const kill = options.kill ?? ((pid: number) => process.kill(pid, 'SIGKILL'))
  const list = options.list ?? listMediaChildren
  let running = false

  const tick = async (): Promise<void> => {
    if (running) return
    running = true
    try {
      for (const child of overdueChildren(await list(process.pid), maxRuntimeSec)) {
        try {
          kill(child.pid)
          console.warn(
            JSON.stringify({
              component: 'ffmpeg-watchdog',
              msg: `killed ${child.command} pid ${child.pid} after ${Math.round(child.runtimeSec)}s`,
              pid: child.pid,
              command: child.command,
              runtimeSec: Math.round(child.runtimeSec),
              maxRuntimeSec,
            }),
          )
        } catch (err) {
          console.warn(
            JSON.stringify({
              component: 'ffmpeg-watchdog',
              msg: `could not kill ${child.command} pid ${child.pid}`,
              error: err instanceof Error ? err.message : String(err),
            }),
          )
        }
      }
    } catch (err) {
      console.warn(
        JSON.stringify({
          component: 'ffmpeg-watchdog',
          msg: 'process scan failed',
          error: err instanceof Error ? err.message : String(err),
        }),
      )
    } finally {
      running = false
    }
  }

  const timer = setInterval(() => void tick(), options.intervalMs ?? DEFAULT_INTERVAL_MS)
  timer.unref()
  return () => clearInterval(timer)
}
