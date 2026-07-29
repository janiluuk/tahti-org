// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { ShaderCrossfadeTransition } from './shader-transition-base'
import type { SlideshowTransitionProps } from './types'

const FRAGMENT = `
  uniform sampler2D uMapFrom;
  uniform sampler2D uMapTo;
  uniform float uAspectFrom;
  uniform float uAspectTo;
  uniform float uContainerAspect;
  uniform float uProgress;
  uniform float uTime;
  varying vec2 vUv;

  float rand(float x) {
    return fract(sin(x * 12.9898) * 43758.5453);
  }

  void main() {
    vec2 uvA = coverUv(vUv, uContainerAspect, uAspectFrom);
    vec2 uvB = coverUv(vUv, uContainerAspect, uAspectTo);

    float bandWidth = 0.14;
    float wipeX = uProgress * (1.0 + bandWidth * 2.0) - bandWidth;
    float dist = vUv.x - wipeX;
    float reveal = step(dist, 0.0);
    float inBand = smoothstep(-bandWidth, 0.0, dist) * (1.0 - smoothstep(0.0, bandWidth, dist));

    vec2 jitterOffset = vec2(0.0);
    if (inBand > 0.0) {
      float block = floor(vUv.y * 26.0);
      jitterOffset.x = (rand(block + floor(uTime * 24.0)) - 0.5) * 0.05 * inBand;
    }

    vec4 colA = texture2D(uMapFrom, uvA + jitterOffset);
    vec4 colB = texture2D(uMapTo, uvB + jitterOffset);
    vec3 baseCol = mix(colA.rgb, colB.rgb, reveal);

    float shift = inBand * 0.018;
    float rA = texture2D(uMapFrom, uvA + jitterOffset + vec2(shift, 0.0)).r;
    float rB = texture2D(uMapTo, uvB + jitterOffset + vec2(shift, 0.0)).r;
    float bA = texture2D(uMapFrom, uvA + jitterOffset - vec2(shift, 0.0)).b;
    float bB = texture2D(uMapTo, uvB + jitterOffset - vec2(shift, 0.0)).b;
    float r = mix(rA, rB, reveal);
    float b = mix(bA, bB, reveal);

    vec3 col = vec3(r, baseCol.g, b) + inBand * vec3(0.15, 0.85, 1.0) * 0.4;

    gl_FragColor = vec4(col, 1.0);
  }
`

/** A digital glitch band with RGB channel splitting sweeps left-to-right, revealing the next banner. */
export function GlitchWipeTransition(props: SlideshowTransitionProps) {
  return <ShaderCrossfadeTransition {...props} fragmentShader={FRAGMENT} />
}
