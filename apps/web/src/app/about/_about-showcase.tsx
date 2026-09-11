// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Image, { type StaticImageData } from 'next/image'

export function AboutShowcase({
  url,
  img,
  alt,
  eyeline,
  title,
  children,
  reverse,
}: {
  url: string
  img: StaticImageData
  alt: string
  eyeline: string
  title: string
  children: string
  reverse?: boolean
}) {
  return (
    <div className={`about-showcase${reverse ? ' about-showcase--reverse' : ''}`}>
      <div className="about-showcase-text">
        <div className="about-eyeline">{eyeline}</div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      <div className="about-showcase-frame">
        <div className="about-showcase-chrome">
          <span className="about-showcase-dot" aria-hidden />
          <span className="about-showcase-dot" aria-hidden />
          <span className="about-showcase-dot" aria-hidden />
          <span className="about-showcase-url">{url}</span>
        </div>
        <Image src={img} alt={alt} />
      </div>
    </div>
  )
}
