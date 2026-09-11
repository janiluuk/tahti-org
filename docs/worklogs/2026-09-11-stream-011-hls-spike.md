# STREAM-011 B — HLS quality ladder spike

Status: high-bitrate AAC implementation complete; true lossless remains open.

Liquidsoap 2.2.5's HLS documentation supports multiple encoded streams from
`output.file.hls`, but says the HLS RFC-compatible browser codecs are MP3 and
AAC and recommends MPEG-TS packaging for compatibility. Its fMP4 example shows
that MP4 output can be configured, but the current development documentation
states that fMP4 became fully supported for audio/video HLS only in Liquidsoap
2.4.3. The deployed channel templates are still written for the 2.2 line and
emit the lossless rendition as FLAC in MPEG-TS, which the repository's existing
`stream-quality.ts` incident notes already identify as unplayable in mainstream
browser MSE.

References:

- [Liquidsoap 2.2.5 HLS output](https://www.liquidsoap.info/doc-2.2.5/hls_output.html)
- [Liquidsoap 2.2.5 `output.file.hls` reference](https://www.liquidsoap.info/doc-2.2.5/reference/source-output)
- [Current fMP4 support note](https://www.liquidsoap.info/doc-dev/hls_output.html)

Decision: do not advertise or route listeners to `stream-flac` yet. The channel
and rotation templates now emit a browser-compatible 320 kbps AAC rendition;
the worker generates and mirrors `master.m3u8` with `#EXT-X-STREAM-INF` entries
for AAC and `stream-mp3-192`, allowing hls.js to choose per listener. A true
lossless rendition needs a version-pinned Liquidsoap upgrade plus playback tests
in hls.js and Safari before it can be accepted.
