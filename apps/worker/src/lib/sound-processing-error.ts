// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export type SoundProcessingStage = 'download' | 'probe' | 'encode' | 'store'

const STAGE_MESSAGES: Record<SoundProcessingStage, string> = {
  download: 'The uploaded file could not be found. Try uploading it again.',
  probe: 'The file is not a supported audio format, or it is damaged.',
  encode: 'The audio could not be converted. Check that the file plays and try again.',
  store: 'The processed audio could not be saved. Try again in a few minutes.',
}

const FALLBACK_MESSAGE = 'Something went wrong while processing the audio. Try again.'

/**
 * Plain-text reason for the sound's owner. Built only from the stage the job
 * reached, never from the thrown error, so storage keys, paths and ffmpeg
 * output cannot leak into the UI.
 */
export function soundProcessingErrorMessage(stage: SoundProcessingStage | null): string {
  return stage ? STAGE_MESSAGES[stage] : FALLBACK_MESSAGE
}

/** BullMQ retries a failed job until `attempts` is used up. */
export function isFinalAttempt(job: {
  attemptsMade: number
  opts: { attempts?: number }
}): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
}
