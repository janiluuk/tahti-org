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
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 uvA = coverUv(vUv, uContainerAspect, uAspectFrom);
    vec2 uvB = coverUv(vUv, uContainerAspect, uAspectTo);
    vec4 colA = texture2D(uMapFrom, uvA);
    vec4 colB = texture2D(uMapTo, uvB);

    float n = hash(floor(vUv * 70.0));
    float reveal = step(n, uProgress);
    float edge = smoothstep(uProgress - 0.08, uProgress, n) - smoothstep(uProgress, uProgress + 0.08, n);

    vec3 col = mix(colA.rgb, colB.rgb, reveal);
    col += edge * vec3(0.85, 0.92, 1.0) * 1.4;

    gl_FragColor = vec4(col, 1.0);
  }
`

/** The current banner dissolves into a scatter of glowing points as the next one resolves. */
export function ParticleDissolveTransition(props: SlideshowTransitionProps) {
  return <ShaderCrossfadeTransition {...props} fragmentShader={FRAGMENT} />
}
