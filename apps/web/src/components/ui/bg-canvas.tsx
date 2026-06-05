// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface AudioState {
  analyser: AnalyserNode | null
  audioCtx: AudioContext | null
  smooth: Float32Array<ArrayBuffer>
  raw: Uint8Array<ArrayBuffer>
}

interface BgCanvasProps {
  audioEl?: HTMLAudioElement | null
}

export function BgCanvas({ audioEl }: BgCanvasProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioStateRef = useRef<AudioState>({
    analyser: null,
    audioCtx: null,
    smooth: new Float32Array(256) as Float32Array<ArrayBuffer>,
    raw: new Uint8Array(256) as Uint8Array<ArrayBuffer>,
  })

  // ── Audio setup — re-runs when audioEl changes ────────────────────────────
  useEffect(() => {
    if (!audioEl) return
    const state = audioStateRef.current

    const init = async () => {
      if (state.audioCtx) return
      try {
        const ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.82
        const src = ctx.createMediaElementSource(audioEl)
        src.connect(analyser)
        analyser.connect(ctx.destination)
        state.audioCtx = ctx
        state.analyser = analyser
        if (ctx.state !== 'running') await ctx.resume()
      } catch (e) {
        console.warn('[BgCanvas audio]', e)
      }
    }

    if (!audioEl.paused) void init()
    audioEl.addEventListener('play', init, { once: true })
    return () => {
      audioEl.removeEventListener('play', init)
    }
  }, [audioEl])

  // ── Three.js scene — runs once, reads audioStateRef each frame ───────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000)
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
      { color: new THREE.Color(0.94, 0.65, 0.0),  pos: [-200,  100, -200] as [number, number, number], scale: 300 },
      { color: new THREE.Color(0.0,  0.74, 0.83), pos: [ 200,  -80, -250] as [number, number, number], scale: 350 },
      { color: new THREE.Color(0.49, 0.3,  1.0),  pos: [   0,  150, -300] as [number, number, number], scale: 280 },
      { color: new THREE.Color(0.0,  0.9,  0.46), pos: [-150, -120, -180] as [number, number, number], scale: 260 },
      { color: new THREE.Color(1.0,  0.42, 0.42), pos: [ 180,  120, -220] as [number, number, number], scale: 240 },
    ]
    const gradientMeshes = gradientColors.map((cfg) => {
      const geo = new THREE.SphereGeometry(1, 32, 32)
      const mat = new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.2, depthWrite: false })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(...cfg.pos)
      mesh.scale.setScalar(cfg.scale)
      scene.add(mesh)
      return { mesh, basePos: cfg.pos, baseScale: cfg.scale, speed: 0.3 + Math.random() * 0.4, radius: 40 + Math.random() * 60, phase: Math.random() * Math.PI * 2 }
    })

    // ── Floating rings ───────────────────────────────────────────────────────
    const ringPalette: [number, number, number][] = [[0.94, 0.65, 0.0], [0.0, 0.74, 0.83], [0.49, 0.3, 1.0], [0.0, 0.9, 0.46]]
    const ringObjs: { mesh: THREE.Mesh; rotSpeed: [number, number, number]; drift: number; phase: number }[] = []
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.TorusGeometry(30 + Math.random() * 50, 1.5, 8, 64)
      const c = ringPalette[i % ringPalette.length]
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]), transparent: true, opacity: 0.25 + Math.random() * 0.15, wireframe: true })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set((Math.random() - 0.5) * 700, (Math.random() - 0.5) * 400, -100 - Math.random() * 200)
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      scene.add(mesh)
      ringObjs.push({ mesh, rotSpeed: [(Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.1], drift: (Math.random() - 0.5) * 0.15, phase: Math.random() * Math.PI * 2 })
    }

    // ── Shooting stars ───────────────────────────────────────────────────────
    const STAR_COUNT = 40
    const starPos = new Float32Array(STAR_COUNT * 3)
    const starCol = new Float32Array(STAR_COUNT * 3)
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 3, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true })))
    const starData: { active: boolean; life: number; maxLife: number; vx: number; vy: number }[] = []
    for (let i = 0; i < STAR_COUNT; i++) {
      starData.push({ active: false, life: 0, maxLife: 0, vx: 0, vy: 0 })
      starPos[i * 3 + 1] = -9999
    }
    let lastStarTime = 0

    // ── Grid lines ───────────────────────────────────────────────────────────
    const gridLines: { line: THREE.Line }[] = []
    const gridSpacing = 80, gridExtent = 600
    for (let x = -gridExtent; x <= gridExtent; x += gridSpacing) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, -gridExtent, -300), new THREE.Vector3(x, gridExtent, -300)])
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(0.0, 0.74, 0.83), transparent: true, opacity: 0.07 }))
      scene.add(line); gridLines.push({ line })
    }
    for (let y = -gridExtent; y <= gridExtent; y += gridSpacing) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-gridExtent, y, -300), new THREE.Vector3(gridExtent, y, -300)])
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(0.49, 0.3, 1.0), transparent: true, opacity: 0.07 }))
      scene.add(line); gridLines.push({ line })
    }

    // ── Floating diamonds ────────────────────────────────────────────────────
    const diamondObjs: { mesh: THREE.Mesh; rotSpeed: number; drift: number; phase: number }[] = []
    for (let i = 0; i < 15; i++) {
      const geo = new THREE.OctahedronGeometry(4 + Math.random() * 8, 0)
      const c = palette[Math.floor(Math.random() * palette.length)]
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]), transparent: true, opacity: 0.22 + Math.random() * 0.2, wireframe: true })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set((Math.random() - 0.5) * 800, (Math.random() - 0.5) * 500, -50 - Math.random() * 150)
      scene.add(mesh)
      diamondObjs.push({ mesh, rotSpeed: 0.5 + Math.random() * 1.5, drift: (Math.random() - 0.5) * 0.2, phase: Math.random() * Math.PI * 2 })
    }

    // ── Background particles ─────────────────────────────────────────────────
    const N = 1800
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3)
    const vels = new Float32Array(N * 2), phases = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 900
      pos[i * 3 + 1] = (Math.random() - 0.5) * 500
      pos[i * 3 + 2] = (Math.random() - 0.5) * 300 - 80
      vels[i * 2] = (Math.random() - 0.5) * 0.08
      vels[i * 2 + 1] = (Math.random() - 0.5) * 0.04
      phases[i] = Math.random() * Math.PI * 2
      const c = palette[Math.floor(Math.random() * palette.length)]
      const bright = 0.15 + Math.random() * 0.35
      col[i * 3] = c[0] * bright; col[i * 3 + 1] = c[1] * bright; col[i * 3 + 2] = c[2] * bright
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 2, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true })))

    // ── Waveform layers ──────────────────────────────────────────────────────
    const WAVES = 3, WN = 400
    const waveColors: [number, number, number, number][] = [[0.0, 0.74, 0.83, 0.8], [0.94, 0.65, 0.0, 0.5], [0.49, 0.3, 1.0, 0.4]]
    const waveFreqs = [0.018, 0.012, 0.025], waveSpeeds = [2.0, 1.3, 2.8], waveAmps = [28, 18, 14], waveZ = [-40, -60, -80]
    const waveObjs: { geo: THREE.BufferGeometry; freq: number; speed: number; amp: number }[] = []
    for (let w = 0; w < WAVES; w++) {
      const wPos = new Float32Array(WN * 3), wCol = new Float32Array(WN * 3)
      const wc = waveColors[w]
      for (let i = 0; i < WN; i++) {
        const t = i / (WN - 1)
        wPos[i * 3] = (t - 0.5) * 900; wPos[i * 3 + 1] = 0; wPos[i * 3 + 2] = waveZ[w]
        wCol[i * 3] = wc[0] * wc[3]; wCol[i * 3 + 1] = wc[1] * wc[3]; wCol[i * 3 + 2] = wc[2] * wc[3]
      }
      const wg = new THREE.BufferGeometry()
      wg.setAttribute('position', new THREE.BufferAttribute(wPos, 3))
      wg.setAttribute('color', new THREE.BufferAttribute(wCol, 3))
      scene.add(new THREE.Points(wg, new THREE.PointsMaterial({ size: 4, vertexColors: true, transparent: true, opacity: 1, sizeAttenuation: true })))
      waveObjs.push({ geo: wg, freq: waveFreqs[w], speed: waveSpeeds[w], amp: waveAmps[w] })
    }

    // ── Radial spectrum analyzer ─────────────────────────────────────────────
    const SPEC_N = 128, SPEC_R = 110
    const specGroup = new THREE.Group()
    specGroup.position.set(0, 0, -20)
    scene.add(specGroup)

    const baseRingMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.0, 0.74, 0.83), transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    const baseRing = new THREE.Mesh(new THREE.RingGeometry(SPEC_R - 1.5, SPEC_R + 1.5, 128), baseRingMat)
    specGroup.add(baseRing)

    const specBars: { geo: THREE.BufferGeometry; cosA: number; sinA: number; mat: THREE.LineBasicMaterial }[] = []
    for (let i = 0; i < SPEC_N; i++) {
      const angle = (i / SPEC_N) * Math.PI * 2
      const cosA = Math.cos(angle), sinA = Math.sin(angle)
      const pts = new Float32Array(6)
      pts[0] = cosA * SPEC_R; pts[1] = sinA * SPEC_R; pts[2] = 0
      pts[3] = cosA * (SPEC_R + 20); pts[4] = sinA * (SPEC_R + 20); pts[5] = 0
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pts, 3))
      const frac = i / SPEC_N
      let r: number, gc: number, bc: number
      if      (frac < 0.25) { r = 0.94; gc = 0.65; bc = 0.0  }
      else if (frac < 0.5)  { r = 0.0;  gc = 0.74; bc = 0.83 }
      else if (frac < 0.75) { r = 0.49; gc = 0.3;  bc = 1.0  }
      else                  { r = 0.0;  gc = 0.9;  bc = 0.46 }
      const m = new THREE.LineBasicMaterial({ color: new THREE.Color(r, gc, bc), transparent: true, opacity: 0.7 })
      specGroup.add(new THREE.Line(g, m))
      specBars.push({ geo: g, cosA, sinA, mat: m })
    }

    // ── Bass-pulse spheres ───────────────────────────────────────────────────
    const pulseSphere = new THREE.Mesh(
      new THREE.SphereGeometry(55, 24, 24),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.94, 0.65, 0.0), transparent: true, opacity: 0.0, wireframe: true }),
    )
    pulseSphere.position.z = -30
    scene.add(pulseSphere)
    const pulseSphere2 = new THREE.Mesh(
      new THREE.SphereGeometry(80, 20, 20),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.0, 0.74, 0.83), transparent: true, opacity: 0.0, wireframe: true }),
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
      const { analyser, audioCtx, smooth, raw } = audioStateRef.current
      if (!analyser || !audioCtx || audioCtx.state !== 'running') return
      analyser.getByteFrequencyData(raw)
      for (let i = 0; i < 256; i++) smooth[i] = smooth[i] * 0.75 + (raw[i] / 255) * 0.25
    }
    function avg(lo: number, hi: number): number {
      const s = audioStateRef.current.smooth
      let sum = 0; for (let i = lo; i <= hi; i++) sum += s[i]; return sum / (hi - lo + 1)
    }
    function bin(i: number): number {
      return audioStateRef.current.smooth[Math.min(i, 255)]
    }

    // ── Animation loop ───────────────────────────────────────────────────────
    let frameId: number

    function animate() {
      frameId = requestAnimationFrame(animate)
      const t = Date.now() * 0.001

      sampleAudio()
      const aBass   = avg(1, 5)
      const aMid    = avg(6, 35)
      const aHigh   = avg(36, 100)
      const aEnergy = avg(1, 80)

      // Gradient orbs — bass swells first two, mids middle, highs last
      gradientMeshes.forEach((g, i) => {
        const { mesh, basePos, speed, radius, phase } = g
        mesh.position.x = basePos[0] + Math.sin(t * speed + phase) * radius
        mesh.position.y = basePos[1] + Math.cos(t * speed * 0.7 + phase) * radius * 0.6
        mesh.position.z = basePos[2] + Math.sin(t * speed * 0.5 + phase * 1.3) * radius * 0.4
        const aBand = i < 2 ? aBass : i < 4 ? aMid : aHigh
        const s = g.baseScale + Math.sin(t * speed * 0.8 + phase) * 30 + aBand * 70
        mesh.scale.setScalar(s)
        ;(mesh.material as THREE.MeshBasicMaterial).opacity = 0.14 + Math.sin(t * speed * 0.6 + phase * 0.5) * 0.06 + aEnergy * 0.12
      })

      // Rings — mids spin, bass pulses scale
      ringObjs.forEach((r) => {
        const { mesh, rotSpeed, drift, phase } = r
        const spinBoost = 1 + aMid * 2.5
        mesh.rotation.x += rotSpeed[0] * 0.01 * spinBoost
        mesh.rotation.y += rotSpeed[1] * 0.01 * spinBoost
        mesh.rotation.z += rotSpeed[2] * 0.01 * spinBoost
        mesh.position.y += Math.sin(t * 0.5 + phase) * drift * 0.1
        mesh.position.x += Math.cos(t * 0.3 + phase) * drift * 0.05
        const rs = 1 + aBass * 0.4
        mesh.scale.set(rs, rs, rs)
        const rMat = mesh.material as THREE.MeshBasicMaterial
        rMat.opacity = Math.min(0.55, (rMat.opacity || 0.28) * 0.9 + (0.28 + aBass * 0.22) * 0.1)
      })

      // Shooting stars
      if (t - lastStarTime > 2.5 + Math.random() * 3) {
        lastStarTime = t
        for (let i = 0; i < STAR_COUNT; i++) {
          if (!starData[i].active) {
            starData[i].active = true; starData[i].life = 0
            starData[i].maxLife = 0.8 + Math.random() * 1.2
            starPos[i * 3] = (Math.random() - 0.5) * 800
            starPos[i * 3 + 1] = 250 + Math.random() * 100
            starPos[i * 3 + 2] = -50 - Math.random() * 150
            starData[i].vx = (Math.random() - 0.5) * 8
            starData[i].vy = -(6 + Math.random() * 8)
            const c = palette[Math.floor(Math.random() * palette.length)]
            starCol[i * 3] = c[0]; starCol[i * 3 + 1] = c[1]; starCol[i * 3 + 2] = c[2]
            break
          }
        }
      }
      for (let i = 0; i < STAR_COUNT; i++) {
        if (starData[i].active) {
          starData[i].life += 0.016
          starPos[i * 3] += starData[i].vx
          starPos[i * 3 + 1] += starData[i].vy
          starCol[i * 3] *= 0.98; starCol[i * 3 + 1] *= 0.98; starCol[i * 3 + 2] *= 0.98
          if (starData[i].life / starData[i].maxLife >= 1) { starData[i].active = false; starPos[i * 3 + 1] = -9999 }
        }
      }
      starGeo.attributes.position.needsUpdate = true
      starGeo.attributes.color.needsUpdate = true

      // Grid — energy brightens, bass creates travelling pulse
      gridLines.forEach((g, i) => {
        const travel = Math.sin(t * 1.2 + i * 0.2) * aBass * 0.06
        const pulse = 0.05 + Math.sin(t * 0.8 + i * 0.15) * 0.04 + aEnergy * 0.14 + travel
        ;(g.line.material as THREE.LineBasicMaterial).opacity = Math.max(0.005, pulse)
      })

      // Diamonds — highs spin, bass flashes scale
      diamondObjs.forEach((d) => {
        const { mesh, rotSpeed, drift, phase } = d
        const spinBoost = 1 + aHigh * 3
        mesh.rotation.x += rotSpeed * 0.005 * spinBoost
        mesh.rotation.y += rotSpeed * 0.008 * spinBoost
        mesh.position.y += Math.sin(t * 0.4 + phase) * drift * 0.05
        mesh.position.x += Math.cos(t * 0.3 + phase) * drift * 0.03
        const s = 1 + Math.sin(t * rotSpeed + phase) * 0.3 + aBass * 0.6
        mesh.scale.setScalar(s)
        const dMat = mesh.material as THREE.MeshBasicMaterial
        dMat.opacity = Math.min(0.55, dMat.opacity * 0.92 + (0.22 + aEnergy * 0.18) * 0.08)
      })

      // Background particles
      for (let i = 0; i < N; i++) {
        pos[i * 3] += vels[i * 2]
        pos[i * 3 + 1] += vels[i * 2 + 1] + Math.sin(t * 0.3 + phases[i]) * 0.03
        if (pos[i * 3] > 450)  pos[i * 3] = -450
        if (pos[i * 3] < -450) pos[i * 3] = 450
        if (pos[i * 3 + 1] > 250)  pos[i * 3 + 1] = -250
        if (pos[i * 3 + 1] < -250) pos[i * 3 + 1] = 250
      }
      pGeo.attributes.position.needsUpdate = true

      // Waveform — each layer reacts to its freq band + per-bin displacement
      waveObjs.forEach(({ geo: wg, freq, speed, amp }, wi) => {
        const wBand = wi === 0 ? aBass : wi === 1 ? aMid : aHigh
        const effectiveAmp = amp * (1 + wBand * 2.2)
        const wPos = wg.attributes.position.array as Float32Array
        for (let i = 0; i < WN; i++) {
          const x = wPos[i * 3]
          const binVal = bin(Math.floor((i / WN) * 80))
          wPos[i * 3 + 1] =
            Math.sin(x * freq + t * speed) * effectiveAmp * 0.6 +
            Math.sin(x * freq * 2.3 + t * speed * 1.4) * effectiveAmp * 0.25 +
            Math.sin(x * freq * 0.4 + t * speed * 0.7) * effectiveAmp * 0.4 +
            binVal * 55 * wBand
        }
        wg.attributes.position.needsUpdate = true
      })

      // Radial spectrum analyzer
      specGroup.rotation.z += 0.004 + aBass * 0.012
      baseRingMat.opacity = 0.15 + aEnergy * 0.4
      baseRing.scale.setScalar(1 + aBass * 0.08)
      specBars.forEach(({ geo, cosA, sinA, mat }, i) => {
        const binVal = bin(Math.floor((i / SPEC_N) * 100))
        const barLen = 8 + binVal * 90 * (1 + aBass * 0.6)
        const pa = geo.attributes.position.array as Float32Array
        pa[3] = cosA * (SPEC_R + barLen)
        pa[4] = sinA * (SPEC_R + barLen)
        geo.attributes.position.needsUpdate = true
        mat.opacity = 0.3 + binVal * 0.7
      })

      // Bass-pulse spheres
      const ps = 1 + aBass * 2.8
      pulseSphere.scale.setScalar(ps)
      ;(pulseSphere.material as THREE.MeshBasicMaterial).opacity = Math.max(0, aBass * 0.3 - 0.02)
      pulseSphere.rotation.x += 0.006; pulseSphere.rotation.y += 0.004
      const ps2 = 1 + aMid * 1.8
      pulseSphere2.scale.setScalar(ps2)
      ;(pulseSphere2.material as THREE.MeshBasicMaterial).opacity = Math.max(0, aMid * 0.2 - 0.01)
      pulseSphere2.rotation.x -= 0.004; pulseSphere2.rotation.y += 0.007

      camera.position.x = Math.sin(t * 0.15) * 15
      camera.rotation.z = Math.sin(t * 0.1) * 0.005
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      // eslint-disable-next-line react-hooks/exhaustive-deps
      void audioStateRef.current.audioCtx?.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} className="bg-canvas" />
}
