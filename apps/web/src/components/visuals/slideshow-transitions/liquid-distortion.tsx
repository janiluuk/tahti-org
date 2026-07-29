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

  void main() {
    // Ripple intensity peaks mid-transition, settles flat at both ends.
    float wobble = sin(uProgress * 3.14159265);
    vec2 disp = vec2(
      sin(vUv.y * 11.0 + uTime * 5.0) * 0.035,
      sin(vUv.x * 11.0 + uTime * 5.0) * 0.035
    ) * wobble;

    vec2 uvA = coverUv(vUv + disp, uContainerAspect, uAspectFrom);
    vec2 uvB = coverUv(vUv - disp, uContainerAspect, uAspectTo);

    vec4 colA = texture2D(uMapFrom, uvA);
    vec4 colB = texture2D(uMapTo, uvB);

    gl_FragColor = vec4(mix(colA.rgb, colB.rgb, uProgress), 1.0);
  }
`

/** A rippling liquid distortion washes the current banner into the next. */
export function LiquidDistortionTransition(props: SlideshowTransitionProps) {
  return <ShaderCrossfadeTransition {...props} fragmentShader={FRAGMENT} />
}
