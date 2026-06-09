// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { VisualPresetProps } from './types'

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.15;

    float n1 = noise(uv * 2.5 + vec2(t, t * 0.5));
    float n2 = noise(uv * 4.0 - vec2(t * 0.7, t * 0.3));
    float band = smoothstep(0.3, 0.7, uv.y + n1 * 0.3 - n2 * 0.15);
    float edge = smoothstep(0.0, 0.15, uv.y) * smoothstep(1.0, 0.85, uv.y);

    vec3 col = mix(uColor1, uColor2, band);
    col = mix(col, uColor3, n2 * 0.4);
    float alpha = edge * (0.4 + n1 * 0.3);
    gl_FragColor = vec4(col, alpha);
  }
`

export function AuroraPreset({ colorScheme }: VisualPresetProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const w = mount.clientWidth || 1
    const h = mount.clientHeight || 1

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(w, h, false)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 5

    const c1 = new THREE.Color(colorScheme.accent)
    const c2 = new THREE.Color(colorScheme.highlight)
    const c3 = new THREE.Color(colorScheme.muted)

    const uniforms = {
      uTime: { value: 0 },
      uColor1: { value: c1 },
      uColor2: { value: c2 },
      uColor3: { value: c3 },
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
    })
    const geo = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geo, mat)
    scene.add(mesh)

    let raf: number
    let disposed = false

    function animate() {
      if (disposed) return
      raf = requestAnimationFrame(animate)
      uniforms.uTime.value += 0.016
      renderer.render(scene, camera)
    }

    animate()

    const ro = new ResizeObserver(() => {
      const nw = mount.clientWidth || 1
      const nh = mount.clientHeight || 1
      renderer.setSize(nw, nh, false)
    })
    ro.observe(mount)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      geo.dispose()
      mat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
    }
  }, [colorScheme.accent, colorScheme.highlight, colorScheme.muted])

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
