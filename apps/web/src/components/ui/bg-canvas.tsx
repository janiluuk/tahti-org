// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useBackgroundCanvasSuspended } from '@/contexts/background-canvas-context'

interface AudioState {
  analyser: AnalyserNode | null
  smooth: Float32Array<ArrayBuffer>
  raw: Uint8Array<ArrayBuffer>
}

interface BgCanvasProps {
  /** Shared analyser node from PlayerProvider — connected once playback starts. */
  analyser?: AnalyserNode | null
  /** Softer motion + lower opacity — for /radio behind channel content. */
  variant?: 'default' | 'subtle'
}

export function BgCanvas({ analyser = null, variant = 'default' }: BgCanvasProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioStateRef = useRef<AudioState>({
    analyser: null,
    smooth: new Float32Array(256) as Float32Array<ArrayBuffer>,
    raw: new Uint8Array(256) as Uint8Array<ArrayBuffer>,
  })

  useEffect(() => {
    audioStateRef.current.analyser = analyser
  }, [analyser])

  // Some pages (e.g. a channel with its own visual preset) mount a second,
  // page-level WebGL visualizer that fully covers this one — no point paying
  // for two full animated scenes when only one is ever visible. Read via a
  // ref inside animate() rather than as an effect dependency, same reasoning
  // as audioStateRef: this must not tear down and rebuild the whole scene.
  const suspended = useBackgroundCanvasSuspended()
  const suspendedRef = useRef(suspended)
  useEffect(() => {
    suspendedRef.current = suspended
  }, [suspended])

  // ── Three.js scene — runs once, reads audioStateRef each frame ───────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const subtle = variant === 'subtle'
    const op = (v: number) => v * (subtle ? 0.28 : 1)
    const motion = subtle ? 0.18 : 1
    // Deliberately much less dampened than motion/opacity — the point of the subtle
    // variant is a quiet background at rest that still visibly comes alive with the
    // music, not a background that merely nods along to it.
    const react = subtle ? 0.75 : 1

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
    } catch (e) {
      // WebGL context creation genuinely fails in the wild — GPU acceleration
      // disabled (VMs, remote desktops, battery-saver, some corporate policy),
      // driver blocklists, or exhausted per-page context limits. Previously
      // silent: the canvas just sat on its flat --bg fill with zero indication
      // anything was attempted. Log it and fall back to a static CSS gradient
      // so the page still reads as branded rather than broken.
      console.error('[bg-canvas] WebGL context creation failed, using static fallback', e)
      canvas.classList.add('bg-canvas--webgl-fallback')
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      2000,
    )
    camera.position.z = 400

    const palette: [number, number, number][] = [
      [0.94, 0.65, 0.0],
      [0.0, 0.74, 0.83],
      [0.49, 0.3, 1.0],
      [0.0, 0.9, 0.46],
      [1.0, 0.42, 0.42],
    ]

    // ── Gradient orbs ────────────────────────────────────────────────────────
    const gradientColors = [
      {
        color: new THREE.Color(0.94, 0.65, 0.0),
        pos: [-200, 100, -200] as [number, number, number],
        scale: 300,
      },
      {
        color: new THREE.Color(0.0, 0.74, 0.83),
        pos: [200, -80, -250] as [number, number, number],
        scale: 350,
      },
      {
        color: new THREE.Color(0.49, 0.3, 1.0),
        pos: [0, 150, -300] as [number, number, number],
        scale: 280,
      },
      {
        color: new THREE.Color(0.0, 0.9, 0.46),
        pos: [-150, -120, -180] as [number, number, number],
        scale: 260,
      },
      {
        color: new THREE.Color(1.0, 0.42, 0.42),
        pos: [180, 120, -220] as [number, number, number],
        scale: 240,
      },
    ]
    const gradientMeshes = gradientColors.map((cfg) => {
      const geo = new THREE.SphereGeometry(1, 32, 32)
      const mat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: op(0.2),
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(...cfg.pos)
      mesh.scale.setScalar(cfg.scale)
      scene.add(mesh)
      return {
        mesh,
        basePos: cfg.pos,
        baseScale: cfg.scale,
        speed: (0.3 + Math.random() * 0.4) * motion,
        radius: (40 + Math.random() * 60) * motion,
        phase: Math.random() * Math.PI * 2,
      }
    })

    // ── Floating rings ───────────────────────────────────────────────────────
    const ringPalette: [number, number, number][] = [
      [0.94, 0.65, 0.0],
      [0.0, 0.74, 0.83],
      [0.49, 0.3, 1.0],
      [0.0, 0.9, 0.46],
    ]
    const ringObjs: {
      mesh: THREE.Mesh
      rotSpeed: [number, number, number]
      drift: number
      phase: number
    }[] = []
    for (let i = 0; i < (subtle ? 5 : 8); i++) {
      const geo = new THREE.TorusGeometry(30 + Math.random() * 50, 1.5, 8, 64)
      const c = ringPalette[i % ringPalette.length]
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(c[0], c[1], c[2]),
        transparent: true,
        opacity: op(0.25 + Math.random() * 0.15),
        wireframe: true,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(
        (Math.random() - 0.5) * 700,
        (Math.random() - 0.5) * 400,
        -100 - Math.random() * 200,
      )
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      scene.add(mesh)
      ringObjs.push({
        mesh,
        rotSpeed: [
          (Math.random() - 0.5) * 0.3 * motion,
          (Math.random() - 0.5) * 0.2 * motion,
          (Math.random() - 0.5) * 0.1 * motion,
        ],
        drift: (Math.random() - 0.5) * 0.15 * motion,
        phase: Math.random() * Math.PI * 2,
      })
    }

    // ── Shooting stars ───────────────────────────────────────────────────────
    const STAR_COUNT = subtle ? 18 : 40
    const starPos = new Float32Array(STAR_COUNT * 3)
    const starCol = new Float32Array(STAR_COUNT * 3)
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3))
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          size: 3,
          vertexColors: true,
          transparent: true,
          opacity: op(0.9),
          sizeAttenuation: true,
        }),
      ),
    )
    const starData: { active: boolean; life: number; maxLife: number; vx: number; vy: number }[] =
      []
    for (let i = 0; i < STAR_COUNT; i++) {
      starData.push({ active: false, life: 0, maxLife: 0, vx: 0, vy: 0 })
      starPos[i * 3 + 1] = -9999
    }
    let lastStarTime = 0

    // ── Grid lines ───────────────────────────────────────────────────────────
    // Two merged LineSegments (vertical/cyan, horizontal/purple) instead of 32
    // individual THREE.Line objects — was 32 draw calls for a barely-visible
    // background grid. Per-line opacity pulse is averaged within each group
    // (material opacity isn't per-vertex), losing the subtle inter-line
    // ripple but keeping the overall bass/energy breathing.
    const gridSpacing = 80,
      gridExtent = 600
    const vLinePositions: number[] = []
    for (let x = -gridExtent; x <= gridExtent; x += gridSpacing) {
      vLinePositions.push(x, -gridExtent, -300, x, gridExtent, -300)
    }
    const hLinePositions: number[] = []
    for (let y = -gridExtent; y <= gridExtent; y += gridSpacing) {
      hLinePositions.push(-gridExtent, y, -300, gridExtent, y, -300)
    }
    const vLineCount = vLinePositions.length / 6
    const hLineCount = hLinePositions.length / 6

    const vGridGeo = new THREE.BufferGeometry()
    vGridGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(vLinePositions), 3),
    )
    const vGridMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.0, 0.74, 0.83),
      transparent: true,
      opacity: op(0.07),
    })
    scene.add(new THREE.LineSegments(vGridGeo, vGridMat))

    const hGridGeo = new THREE.BufferGeometry()
    hGridGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(hLinePositions), 3),
    )
    const hGridMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.49, 0.3, 1.0),
      transparent: true,
      opacity: op(0.07),
    })
    scene.add(new THREE.LineSegments(hGridGeo, hGridMat))

    // ── Floating diamonds ────────────────────────────────────────────────────
    const diamondObjs: { mesh: THREE.Mesh; rotSpeed: number; drift: number; phase: number }[] = []
    for (let i = 0; i < (subtle ? 8 : 15); i++) {
      const geo = new THREE.OctahedronGeometry(4 + Math.random() * 8, 0)
      const c = palette[Math.floor(Math.random() * palette.length)]
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(c[0], c[1], c[2]),
        transparent: true,
        opacity: op(0.22 + Math.random() * 0.2),
        wireframe: true,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(
        (Math.random() - 0.5) * 800,
        (Math.random() - 0.5) * 500,
        -50 - Math.random() * 150,
      )
      scene.add(mesh)
      diamondObjs.push({
        mesh,
        rotSpeed: (0.5 + Math.random() * 1.5) * motion,
        drift: (Math.random() - 0.5) * 0.2 * motion,
        phase: Math.random() * Math.PI * 2,
      })
    }

    // ── Background particles ─────────────────────────────────────────────────
    const N = subtle ? 900 : 1800
    const pos = new Float32Array(N * 3),
      col = new Float32Array(N * 3)
    const vels = new Float32Array(N * 2),
      phases = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 900
      pos[i * 3 + 1] = (Math.random() - 0.5) * 500
      pos[i * 3 + 2] = (Math.random() - 0.5) * 300 - 80
      vels[i * 2] = (Math.random() - 0.5) * 0.08
      vels[i * 2 + 1] = (Math.random() - 0.5) * 0.04
      phases[i] = Math.random() * Math.PI * 2
      const c = palette[Math.floor(Math.random() * palette.length)]
      const bright = (0.15 + Math.random() * 0.35) * (subtle ? 0.55 : 1)
      col[i * 3] = c[0] * bright
      col[i * 3 + 1] = c[1] * bright
      col[i * 3 + 2] = c[2] * bright
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    scene.add(
      new THREE.Points(
        pGeo,
        new THREE.PointsMaterial({
          opacity: op(0.85),
          size: subtle ? 1.5 : 2,
          sizeAttenuation: true,
        }),
      ),
    )

    // ── Waveform layers ──────────────────────────────────────────────────────
    const WAVES = 3,
      WN = 400
    const waveColors: [number, number, number, number][] = [
      [0.0, 0.74, 0.83, 0.8],
      [0.94, 0.65, 0.0, 0.5],
      [0.49, 0.3, 1.0, 0.4],
    ]
    const waveFreqs = [0.018, 0.012, 0.025],
      waveSpeeds = [2.0, 1.3, 2.8].map((s) => s * motion),
      waveAmps = [28, 18, 14].map((a) => a * (subtle ? 0.45 : 1)),
      waveZ = [-40, -60, -80]
    const waveObjs: { geo: THREE.BufferGeometry; freq: number; speed: number; amp: number }[] = []
    for (let w = 0; w < WAVES; w++) {
      const wPos = new Float32Array(WN * 3),
        wCol = new Float32Array(WN * 3)
      const wc = waveColors[w]
      for (let i = 0; i < WN; i++) {
        const t = i / (WN - 1)
        wPos[i * 3] = (t - 0.5) * 900
        wPos[i * 3 + 1] = 0
        wPos[i * 3 + 2] = waveZ[w]
        wCol[i * 3] = wc[0] * wc[3]
        wCol[i * 3 + 1] = wc[1] * wc[3]
        wCol[i * 3 + 2] = wc[2] * wc[3]
      }
      const wg = new THREE.BufferGeometry()
      wg.setAttribute('position', new THREE.BufferAttribute(wPos, 3))
      wg.setAttribute('color', new THREE.BufferAttribute(wCol, 3))
      scene.add(
        new THREE.Points(
          wg,
          new THREE.PointsMaterial({
            size: 4,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true,
          }),
        ),
      )
      waveObjs.push({ geo: wg, freq: waveFreqs[w], speed: waveSpeeds[w], amp: waveAmps[w] })
    }

    // ── Radial spectrum analyzer ─────────────────────────────────────────────
    const SPEC_N = 128,
      SPEC_R = 110
    const specGroup = new THREE.Group()
    specGroup.position.set(0, 0, -20)
    scene.add(specGroup)

    const baseRingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.0, 0.74, 0.83),
      transparent: true,
      opacity: op(0.2),
      side: THREE.DoubleSide,
    })
    const baseRing = new THREE.Mesh(
      new THREE.RingGeometry(SPEC_R - 1.5, SPEC_R + 1.5, 128),
      baseRingMat,
    )
    specGroup.add(baseRing)

    // A single merged LineSegments geometry instead of 128 individual
    // THREE.Line objects — was issuing 128 draw calls + 128 separate GPU
    // buffer uploads every frame for this one element alone. Per-vertex
    // color still gives each bar its own hue/bloom; only the opacity
    // (previously per-bar) is now a single material-wide value driven by
    // the average bin energy, since LineBasicMaterial has no per-vertex alpha.
    const specAngles: { cosA: number; sinA: number; baseColor: [number, number, number] }[] = []
    const specPos = new Float32Array(SPEC_N * 6)
    const specCol = new Float32Array(SPEC_N * 6)
    for (let i = 0; i < SPEC_N; i++) {
      const angle = (i / SPEC_N) * Math.PI * 2
      const cosA = Math.cos(angle),
        sinA = Math.sin(angle)
      specPos[i * 6] = cosA * SPEC_R
      specPos[i * 6 + 1] = sinA * SPEC_R
      specPos[i * 6 + 2] = 0
      specPos[i * 6 + 3] = cosA * (SPEC_R + 20)
      specPos[i * 6 + 4] = sinA * (SPEC_R + 20)
      specPos[i * 6 + 5] = 0
      const frac = i / SPEC_N
      let r: number, gc: number, bc: number
      if (frac < 0.25) {
        r = 0.94
        gc = 0.65
        bc = 0.0
      } else if (frac < 0.5) {
        r = 0.0
        gc = 0.74
        bc = 0.83
      } else if (frac < 0.75) {
        r = 0.49
        gc = 0.3
        bc = 1.0
      } else {
        r = 0.0
        gc = 0.9
        bc = 0.46
      }
      specCol[i * 6] = r
      specCol[i * 6 + 1] = gc
      specCol[i * 6 + 2] = bc
      specCol[i * 6 + 3] = r
      specCol[i * 6 + 4] = gc
      specCol[i * 6 + 5] = bc
      specAngles.push({ cosA, sinA, baseColor: [r, gc, bc] })
    }
    const specGeo = new THREE.BufferGeometry()
    specGeo.setAttribute('position', new THREE.BufferAttribute(specPos, 3))
    specGeo.setAttribute('color', new THREE.BufferAttribute(specCol, 3))
    const specMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: op(0.7),
    })
    specGroup.add(new THREE.LineSegments(specGeo, specMat))

    // ── Bass-pulse spheres ───────────────────────────────────────────────────
    const pulseSphere = new THREE.Mesh(
      new THREE.SphereGeometry(55, 24, 24),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.94, 0.65, 0.0),
        transparent: true,
        opacity: 0.0,
        wireframe: true,
      }),
    )
    pulseSphere.position.z = -30
    scene.add(pulseSphere)
    const pulseSphere2 = new THREE.Mesh(
      new THREE.SphereGeometry(80, 20, 20),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.0, 0.74, 0.83),
        transparent: true,
        opacity: 0.0,
        wireframe: true,
      }),
    )
    pulseSphere2.position.z = -40
    scene.add(pulseSphere2)

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    // ── Audio helpers — read from shared ref each frame ──────────────────────
    function sampleAudio() {
      const { analyser, smooth, raw } = audioStateRef.current
      if (!analyser || analyser.context.state !== 'running') return
      analyser.getByteFrequencyData(raw)
      for (let i = 0; i < 256; i++) smooth[i] = smooth[i] * 0.75 + (raw[i] / 255) * 0.25
    }
    function avg(lo: number, hi: number): number {
      const s = audioStateRef.current.smooth
      let sum = 0
      for (let i = lo; i <= hi; i++) sum += s[i]
      return sum / (hi - lo + 1)
    }
    function bin(i: number): number {
      return audioStateRef.current.smooth[Math.min(i, 255)]
    }

    // ── Animation loop ───────────────────────────────────────────────────────
    let frameId: number
    // This is a soft, slow-moving ambient background, not something that
    // needs 60fps precision — throttling to ~30fps halves every recurring
    // cost in this scene (CPU math for ~1800/900 particles + 3×400 waveform
    // points, and the GPU buffer re-upload their needsUpdate triggers every
    // rendered frame) with no perceptible visual difference, since t is
    // wall-clock-based (Date.now()) rather than frame-count-based — motion
    // timing stays correct even though we render half as often.
    const FRAME_INTERVAL_MS = 1000 / 30
    let lastFrameTime = 0

    function animate() {
      frameId = requestAnimationFrame(animate)
      if (suspendedRef.current) return
      const now = performance.now()
      if (now - lastFrameTime < FRAME_INTERVAL_MS) return
      lastFrameTime = now
      const t = Date.now() * 0.001

      sampleAudio()
      const aBass = avg(1, 5) * react
      const aMid = avg(6, 35) * react
      const aHigh = avg(36, 100) * react
      const aEnergy = avg(1, 80) * react

      // Gradient orbs — bass swells first two, mids middle, highs last
      gradientMeshes.forEach((g, i) => {
        const { mesh, basePos, speed, radius, phase } = g
        mesh.position.x = basePos[0] + Math.sin(t * speed + phase) * radius * motion
        mesh.position.y = basePos[1] + Math.cos(t * speed * 0.7 + phase) * radius * 0.6 * motion
        mesh.position.z =
          basePos[2] + Math.sin(t * speed * 0.5 + phase * 1.3) * radius * 0.4 * motion
        const aBand = i < 2 ? aBass : i < 4 ? aMid : aHigh
        const s = g.baseScale + Math.sin(t * speed * 0.8 + phase) * 30 * motion + aBand * 70 * react
        mesh.scale.setScalar(s)
        ;(mesh.material as THREE.MeshBasicMaterial).opacity =
          op(0.14) + Math.sin(t * speed * 0.6 + phase * 0.5) * op(0.06) + aEnergy * op(0.12)
      })

      // Rings — mids spin, bass pulses scale
      ringObjs.forEach((r) => {
        const { mesh, rotSpeed, drift, phase } = r
        const spinBoost = 1 + aMid * 2.5 * react
        mesh.rotation.x += rotSpeed[0] * 0.01 * spinBoost
        mesh.rotation.y += rotSpeed[1] * 0.01 * spinBoost
        mesh.rotation.z += rotSpeed[2] * 0.01 * spinBoost
        mesh.position.y += Math.sin(t * 0.5 + phase) * drift * 0.1
        mesh.position.x += Math.cos(t * 0.3 + phase) * drift * 0.05
        const rs = 1 + aBass * 0.4 * react
        mesh.scale.set(rs, rs, rs)
        const rMat = mesh.material as THREE.MeshBasicMaterial
        rMat.opacity = Math.min(
          op(0.55),
          (rMat.opacity || op(0.28)) * 0.9 + (op(0.28) + aBass * op(0.22)) * 0.1,
        )
      })

      // Shooting stars
      if (t - lastStarTime > (2.5 + Math.random() * 3) * (subtle ? 2.8 : 1)) {
        lastStarTime = t
        for (let i = 0; i < STAR_COUNT; i++) {
          if (!starData[i].active) {
            starData[i].active = true
            starData[i].life = 0
            starData[i].maxLife = 0.8 + Math.random() * 1.2
            starPos[i * 3] = (Math.random() - 0.5) * 800
            starPos[i * 3 + 1] = 250 + Math.random() * 100
            starPos[i * 3 + 2] = -50 - Math.random() * 150
            starData[i].vx = (Math.random() - 0.5) * 8 * motion
            starData[i].vy = -(6 + Math.random() * 8) * motion
            const c = palette[Math.floor(Math.random() * palette.length)]
            starCol[i * 3] = c[0]
            starCol[i * 3 + 1] = c[1]
            starCol[i * 3 + 2] = c[2]
            break
          }
        }
      }
      for (let i = 0; i < STAR_COUNT; i++) {
        if (starData[i].active) {
          starData[i].life += 0.016
          starPos[i * 3] += starData[i].vx
          starPos[i * 3 + 1] += starData[i].vy
          starCol[i * 3] *= 0.98
          starCol[i * 3 + 1] *= 0.98
          starCol[i * 3 + 2] *= 0.98
          if (starData[i].life / starData[i].maxLife >= 1) {
            starData[i].active = false
            starPos[i * 3 + 1] = -9999
          }
        }
      }
      starGeo.attributes.position.needsUpdate = true
      starGeo.attributes.color.needsUpdate = true

      // Grid — energy brightens, bass creates travelling pulse (averaged
      // across each merged group instead of set per-line).
      let vGridOpacitySum = 0
      for (let i = 0; i < vLineCount; i++) {
        const travel = Math.sin(t * 1.2 + i * 0.2) * aBass * 0.06 * react
        vGridOpacitySum += Math.max(
          0.002,
          op(0.05) + Math.sin(t * 0.8 + i * 0.15) * op(0.04) + aEnergy * op(0.14) + travel,
        )
      }
      vGridMat.opacity = vGridOpacitySum / vLineCount

      let hGridOpacitySum = 0
      for (let i = 0; i < hLineCount; i++) {
        const idx = vLineCount + i
        const travel = Math.sin(t * 1.2 + idx * 0.2) * aBass * 0.06 * react
        hGridOpacitySum += Math.max(
          0.002,
          op(0.05) + Math.sin(t * 0.8 + idx * 0.15) * op(0.04) + aEnergy * op(0.14) + travel,
        )
      }
      hGridMat.opacity = hGridOpacitySum / hLineCount

      // Diamonds — highs spin, bass flashes scale
      diamondObjs.forEach((d) => {
        const { mesh, rotSpeed, drift, phase } = d
        const spinBoost = 1 + aHigh * 3 * react
        mesh.rotation.x += rotSpeed * 0.005 * spinBoost
        mesh.rotation.y += rotSpeed * 0.008 * spinBoost
        mesh.position.y += Math.sin(t * 0.4 + phase) * drift * 0.05
        mesh.position.x += Math.cos(t * 0.3 + phase) * drift * 0.03
        const s = 1 + Math.sin(t * rotSpeed + phase) * 0.3 * motion + aBass * 0.6 * react
        mesh.scale.setScalar(s)
        const dMat = mesh.material as THREE.MeshBasicMaterial
        dMat.opacity = Math.min(
          op(0.55),
          dMat.opacity * 0.92 + (op(0.22) + aEnergy * op(0.18)) * 0.08,
        )
      })

      // Background particles
      for (let i = 0; i < N; i++) {
        pos[i * 3] += vels[i * 2] * motion
        pos[i * 3 + 1] += vels[i * 2 + 1] * motion + Math.sin(t * 0.3 + phases[i]) * 0.03 * motion
        if (pos[i * 3] > 450) pos[i * 3] = -450
        if (pos[i * 3] < -450) pos[i * 3] = 450
        if (pos[i * 3 + 1] > 250) pos[i * 3 + 1] = -250
        if (pos[i * 3 + 1] < -250) pos[i * 3 + 1] = 250
      }
      pGeo.attributes.position.needsUpdate = true

      // Waveform — each layer reacts to its freq band + per-bin displacement
      waveObjs.forEach(({ geo: wg, freq, speed, amp }, wi) => {
        const wBand = wi === 0 ? aBass : wi === 1 ? aMid : aHigh
        const effectiveAmp = amp * (1 + wBand * 2.2 * react)
        const wPos = wg.attributes.position.array as Float32Array
        for (let i = 0; i < WN; i++) {
          const x = wPos[i * 3]
          const binVal = bin(Math.floor((i / WN) * 80))
          wPos[i * 3 + 1] =
            Math.sin(x * freq + t * speed) * effectiveAmp * 0.6 +
            Math.sin(x * freq * 2.3 + t * speed * 1.4) * effectiveAmp * 0.25 +
            Math.sin(x * freq * 0.4 + t * speed * 0.7) * effectiveAmp * 0.4 +
            binVal * 55 * wBand * react
        }
        wg.attributes.position.needsUpdate = true
      })

      // Radial spectrum analyzer
      specGroup.rotation.z += (0.004 + aBass * 0.012) * motion
      baseRingMat.opacity = op(0.22) + aEnergy * op(0.55)
      baseRing.scale.setScalar(1 + aBass * 0.08 * react)
      let specOpacitySum = 0
      for (let i = 0; i < SPEC_N; i++) {
        const { cosA, sinA, baseColor } = specAngles[i]!
        const binVal = bin(Math.floor((i / SPEC_N) * 100))
        // More vivid: bars reach further, sit brighter at rest, and the loudest
        // bins bloom toward white instead of just fading up their base hue.
        const barLen = 10 + binVal * 130 * (1 + aBass * 0.9 * react) * react
        specPos[i * 6 + 3] = cosA * (SPEC_R + barLen)
        specPos[i * 6 + 4] = sinA * (SPEC_R + barLen)
        const bloom = Math.min(1, binVal * 1.4)
        const rr = baseColor[0] + (1 - baseColor[0]) * bloom * 0.6
        const gg = baseColor[1] + (1 - baseColor[1]) * bloom * 0.6
        const bb = baseColor[2] + (1 - baseColor[2]) * bloom * 0.6
        specCol[i * 6] = rr
        specCol[i * 6 + 1] = gg
        specCol[i * 6 + 2] = bb
        specCol[i * 6 + 3] = rr
        specCol[i * 6 + 4] = gg
        specCol[i * 6 + 5] = bb
        specOpacitySum += op(0.45) + binVal * op(0.85)
      }
      specGeo.attributes.position.needsUpdate = true
      specGeo.attributes.color.needsUpdate = true
      specMat.opacity = specOpacitySum / SPEC_N

      // Bass-pulse spheres
      const ps = 1 + aBass * 2.8 * react
      pulseSphere.scale.setScalar(ps)
      ;(pulseSphere.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        aBass * op(0.3) - op(0.02),
      )
      pulseSphere.rotation.x += 0.006 * motion
      pulseSphere.rotation.y += 0.004 * motion
      const ps2 = 1 + aMid * 1.8 * react
      pulseSphere2.scale.setScalar(ps2)
      ;(pulseSphere2.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        aMid * op(0.2) - op(0.01),
      )
      pulseSphere2.rotation.x -= 0.004 * motion
      pulseSphere2.rotation.y += 0.007 * motion

      camera.position.x = Math.sin(t * 0.15) * 15 * motion
      camera.rotation.z = Math.sin(t * 0.1) * 0.005 * motion
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
    }
  }, [variant]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      className={variant === 'subtle' ? 'bg-canvas bg-canvas--subtle' : 'bg-canvas'}
    />
  )
}
