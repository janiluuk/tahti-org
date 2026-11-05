// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Bytes to read from the start of a file before calling sniffAudioContainer. */
export const AUDIO_SNIFF_BYTES = 64

function ascii(buf: Uint8Array, offset: number, text: string): boolean {
  if (buf.length < offset + text.length) return false
  for (let i = 0; i < text.length; i += 1) {
    if (buf[offset + i] !== text.charCodeAt(i)) return false
  }
  return true
}

/**
 * Names the audio container a file starts with (`mp3`, `flac`, `wav`, `ogg`,
 * `mp4`, `aiff`, `matroska`, `aac`, `wavpack`, `ape`, `caf`, `dsd`), or
 * null when the first bytes match none of them. Only the container is
 * checked; whether the stream inside decodes is the transcoder's job.
 */
export function sniffAudioContainer(buf: Uint8Array): string | null {
  if (ascii(buf, 0, 'ID3')) return 'mp3'
  if (ascii(buf, 0, 'fLaC')) return 'flac'
  if (ascii(buf, 0, 'RIFF') && (ascii(buf, 8, 'WAVE') || ascii(buf, 8, 'RF64'))) return 'wav'
  if (ascii(buf, 0, 'RF64') || ascii(buf, 0, 'BW64')) return 'wav'
  if (ascii(buf, 0, 'OggS')) return 'ogg'
  if (ascii(buf, 4, 'ftyp')) return 'mp4'
  if (ascii(buf, 0, 'FORM') && (ascii(buf, 8, 'AIFF') || ascii(buf, 8, 'AIFC'))) return 'aiff'
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'matroska'
  if (ascii(buf, 0, 'wvpk')) return 'wavpack'
  if (ascii(buf, 0, 'MAC ')) return 'ape'
  if (ascii(buf, 0, 'caff')) return 'caf'
  if (ascii(buf, 0, 'DSD ') || ascii(buf, 0, 'FRM8')) return 'dsd'
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0) {
    // Frame sync: ADTS AAC has layer bits 00, MPEG audio (mp3/mp2) does not.
    return (buf[1]! & 0x06) === 0 ? 'aac' : 'mp3'
  }
  return null
}
