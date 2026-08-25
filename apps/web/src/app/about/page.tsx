// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import Image from 'next/image'
import { Breadcrumb } from '@tahti/ui'
import '@tahti/ui/src/styles/about-page.css'
import channelImg from '/public/screenshots/channel.png'
import dashboardImg from '/public/screenshots/dashboard.png'
import listenImg from '/public/screenshots/listen.png'
import profileImg from '/public/screenshots/profile.png'
import statsImg from '/public/screenshots/stats.png'

export const metadata: Metadata = {
  title: 'About Tahti',
  description:
    'Tahti is a home for music and live shows: a nonprofit broadcasting platform with a real release system, direct fan support, and artist governance.',
}

function Showcase({
  url,
  img,
  alt,
  eyeline,
  title,
  children,
  reverse,
}: {
  url: string
  img: typeof channelImg
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

export default function AboutPage() {
  return (
    <div className="about-page">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'About' }]} />

      <header className="about-hero">
        <div>
          <div className="about-eyebrow">About tahti.live</div>
          <h1>A home for your music, and your live shows.</h1>
          <p className="about-lede">
            We built Tahti on one belief: artists should spend their time making art. So we automate
            the tedious, mechanical work drawn from two decades in streaming, and leave you free to
            do what you are actually good at.
          </p>
          <div className="about-callouts">
            <div className="about-callout">
              <div className="about-label">Release system</div>
              <div className="about-value">
                A real discography, publishing workflow, and distribution path.
              </div>
            </div>
            <div className="about-callout">
              <div className="about-label">Broadcast platform</div>
              <div className="about-value">
                A proper live stack for performers, DJs, podcasters, and collectives.
              </div>
            </div>
            <div className="about-callout">
              <div className="about-label">Quality</div>
              <div className="about-value">
                Lossless sound for listeners, without turning it into a premium paywall.
              </div>
            </div>
          </div>
          <div className="about-cta-row">
            <a href="/join" className="about-cta-primary">
              Join Tahti →
            </a>
            <a href="/login" className="about-cta-secondary">
              Sign in
            </a>
          </div>
        </div>
        <aside className="about-hero-card">
          <div className="about-k">Time back for your art</div>
          <div className="about-v">
            We handle the busywork: metadata, numbering, delivery, platform reach, and the rest of
            the mechanical load.
          </div>
          <p>You make the music. We take care of the rest.</p>
        </aside>
      </header>

      <section className="about-section" id="what">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">What we are</div>
            <h2>Two things at once.</h2>
          </div>
          <p>
            Tahti is both a discography and release system, and a live broadcasting platform built
            for performers.
          </p>
        </div>
        <div className="about-grid-2">
          <div className="about-card about-card--cyan">
            <h3>A real discography</h3>
            <p>
              Upload once, keep control of the library, and publish from there. Releases, archive,
              and fan records stay with you.
            </p>
          </div>
          <div className="about-card about-card--violet">
            <h3>A proper broadcasting platform</h3>
            <p>
              Run weekly shows or daily ones. Enter a name and description, and we handle the
              episode structure so the show can keep moving.
            </p>
          </div>
        </div>
      </section>

      <section className="about-section" id="broadcast">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Built for broadcasters</div>
            <h2>Live performance sits at the heart of it.</h2>
          </div>
          <p>
            We get you connected in minutes, not an evening lost in forums, whatever you broadcast
            with.
          </p>
        </div>
        <div className="about-grid-3">
          <div className="about-card about-card--amber">
            <h3>Guided setup</h3>
            <p>
              OBS, Mixxx, Traktor, butt, or straight from the browser. You get the exact server and
              stream key you need, plus a connect step before you go on air.
            </p>
          </div>
          <div className="about-card about-card--cyan">
            <h3>Multistreaming</h3>
            <p>
              Restream the same live show to Twitch, YouTube, or Kick at once so you can reach the
              audience already watching elsewhere without splitting your effort.
            </p>
          </div>
          <div className="about-card about-card--violet">
            <h3>Tahti Radio</h3>
            <p>
              A 24/7 meta-stream where artists book slots and go on air in one continuous broadcast,
              scheduled back-to-back.
            </p>
          </div>
        </div>
        <div className="about-quote">The music never stops because someone clicked a menu.</div>
      </section>

      <Showcase
        url="tahti.live/c/your-channel"
        img={channelImg}
        alt="Channel page — live broadcast, archive, and chat"
        eyeline="Your channel"
        title="Live now, archive after."
        reverse
      >
        Listeners land on one page for everything: the live player when you are on air, your archive
        the rest of the time, and chat running alongside either way.
      </Showcase>

      <section className="about-section" id="listeners">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Listeners hear the real thing</div>
            <h2>No watered-down version.</h2>
          </div>
          <p>We do not gate quality at the listener tier.</p>
        </div>
        <div className="about-grid-2">
          <div className="about-card about-card--green">
            <h3>Member channels</h3>
            <p>
              A free listener hears the same lossless FLAC the artist streams. We do not charge
              people extra to hear it properly.
            </p>
          </div>
          <div className="about-card about-card--amber">
            <h3>Free-tier artists</h3>
            <p>
              Artists on the free tier broadcast at 192 kbps MP3. It is still cleaner than most
              platforms give free listeners at all.
            </p>
          </div>
        </div>
      </section>

      <Showcase
        url="tahti.live/listen"
        img={listenImg}
        alt="Discover page — live channels, replays, and new releases"
        eyeline="Discover"
        title="One place to find who's playing."
      >
        Live channels, recent replays, and new releases from across Tahti, without an algorithm
        deciding what you are allowed to see.
      </Showcase>

      <section className="about-section" id="for">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Who it is for</div>
            <h2>Anyone who wants a real home for their work.</h2>
          </div>
          <p>
            Not a profile on someone else&rsquo;s platform, but a stage and a discography of your
            own.
          </p>
        </div>
        <div className="about-grid-3">
          <div className="about-card">
            <h3>The DJ</h3>
            <p>Weekly show, same set, too many uploads, too many destinations.</p>
          </div>
          <div className="about-card">
            <h3>The producer</h3>
            <p>A deep catalogue that deserves better than a compressed stream.</p>
          </div>
          <div className="about-card">
            <h3>The experimental artist</h3>
            <p>Sound that arrives exactly as it left the studio.</p>
          </div>
          <div className="about-card">
            <h3>The talk-radio host</h3>
            <p>Broadcasting that is structured, reliable, and easy to keep moving.</p>
          </div>
          <div className="about-card">
            <h3>The podcaster</h3>
            <p>Clear publishing, clean delivery, and an audience that can follow along.</p>
          </div>
          <div className="about-card">
            <h3>The collective</h3>
            <p>A shared channel, moderators, and a space to build together.</p>
          </div>
        </div>
      </section>

      <section className="about-section" id="release">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Publishing and releases</div>
            <h2>One upload, then choose how far it goes.</h2>
          </div>
          <p>
            Your library stays first in the chain. You decide who sees it: specific fans,
            subscribers, or the world.
          </p>
        </div>
        <div className="about-flow">
          <div className="about-card">
            <h3>Your library</h3>
            <p>You control the source copy, the discography, and the audience boundary.</p>
          </div>
          <div className="about-arrow">→</div>
          <div className="about-card">
            <h3>Release</h3>
            <p>A smart link that points fans to Spotify, Apple Music, Bandcamp, and more.</p>
          </div>
          <div className="about-arrow">→</div>
          <div className="about-card">
            <h3>Distribution</h3>
            <p>Built-in metadata delivery, store delivery, and direct publishing to Mixcloud.</p>
          </div>
        </div>
        <div className="about-grid-2" style={{ marginTop: '16px' }}>
          <div className="about-card about-card--amber">
            <h3>No platform cut</h3>
            <p>The distributor charges its own delivery fee. That is the only cost in the chain.</p>
          </div>
          <div className="about-card about-card--cyan">
            <h3>Release mechanics handled</h3>
            <p>
              Episode numbering, metadata, delivery, and platform reach are the parts we automate.
            </p>
          </div>
        </div>
      </section>

      <section className="about-section" id="catalogue">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Bring your catalogue in and take it out</div>
            <h2>Movement in both directions.</h2>
          </div>
          <p>We work with your existing archive, and we do not trap it here.</p>
        </div>
        <div className="about-grid-2">
          <div className="about-card">
            <h3>Import</h3>
            <p>
              Pull a catalogue in from SoundCloud, Bandcamp, or Mixcloud, or link Google Drive to
              publish as you go.
            </p>
          </div>
          <div className="about-card">
            <h3>Export</h3>
            <p>Your releases, archive, and fan records can be exported whenever you want.</p>
          </div>
          <div className="about-card about-card--green">
            <h3>Storage</h3>
            <p>
              Generous storage, no quota meter in your face, and soft safeguards against abuse
              behind the scenes.
            </p>
          </div>
          <div className="about-card about-card--violet">
            <h3>Ownership</h3>
            <p>If you built it here, it is still yours when you leave.</p>
          </div>
        </div>
      </section>

      <section className="about-section" id="studio">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Your studio</div>
            <h2>The control room for everything you run.</h2>
          </div>
          <p>Not a generic dashboard. A working desk for broadcasting and releasing.</p>
        </div>
        <div className="about-grid-4">
          <div className="about-card">
            <h3>Go live</h3>
            <p>Manage broadcasts from preflight to on-air.</p>
          </div>
          <div className="about-card">
            <h3>Manage library</h3>
            <p>Keep releases, archive, and metadata in one place.</p>
          </div>
          <div className="about-card">
            <h3>Cut releases</h3>
            <p>Build release pages and smart links quickly.</p>
          </div>
          <div className="about-card">
            <h3>See stats</h3>
            <p>Track the numbers that matter, including revenue.</p>
          </div>
          <div className="about-card">
            <h3>Design your channel</h3>
            <p>Control the look and structure of your public space.</p>
          </div>
          <div className="about-card">
            <h3>Set your schedule</h3>
            <p>Plan live shows and recurring slots.</p>
          </div>
          <div className="about-card">
            <h3>Audio touch-ups</h3>
            <p>Trim and normalize the basics without leaving the flow.</p>
          </div>
          <div className="about-card">
            <h3>Direct support</h3>
            <p>Keep fan support close to the work and the audience.</p>
          </div>
        </div>
      </section>

      <Showcase
        url="tahti.live/dashboard"
        img={dashboardImg}
        alt="Artist dashboard — broadcast, library, releases, stats"
        eyeline="Your studio"
        title="Everything you run, in one dashboard."
        reverse
      >
        Go live, manage the library, cut releases, watch stats, and design the channel — the control
        room, not a scattered set of settings pages.
      </Showcase>

      <section className="about-section" id="space">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Your own space</div>
            <h2>A home on the web that you shape.</h2>
          </div>
          <p>Your-name.tahti.live, your design, your audience.</p>
        </div>
        <div className="about-grid-2">
          <div className="about-card about-card--cyan">
            <h3>Design control</h3>
            <p>
              Presets to get moving quickly, or a custom look down to individual releases and shows.
            </p>
          </div>
          <div className="about-card about-card--violet">
            <h3>Audience tools</h3>
            <p>
              Live chat, newsletter, direct messages, and a press kit and gallery for your channel.
            </p>
          </div>
        </div>
      </section>

      <Showcase
        url="your-name.tahti.live"
        img={profileImg}
        alt="Public artist profile — bio, music, releases"
        eyeline="Your own space"
        title="A page that's actually yours."
      >
        Bio, releases, and archive on a name that&apos;s yours, not a profile competing for
        attention against a feed of everyone else on the platform.
      </Showcase>

      <section className="about-section" id="support">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Direct fan support</div>
            <h2>Fans can back you directly.</h2>
          </div>
          <p>Subscriptions from a euro up to a hundred a month. You set the price.</p>
        </div>
        <div className="about-grid-2">
          <div className="about-card about-card--green">
            <div className="about-metric">
              <div className="about-num">98%</div>
              <div className="about-label">Kept by the artist</div>
            </div>
            <p style={{ marginTop: '12px' }}>
              We take 2% only to cover card processing and running costs.
            </p>
          </div>
          <div className="about-card about-card--amber">
            <h3>A direct relationship</h3>
            <p>Fans back you, not a middleman. The relationship stays yours, not ours.</p>
          </div>
        </div>
      </section>

      <section className="about-section" id="paid">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">How you get paid</div>
            <h2>Two paths, both tipped your way.</h2>
          </div>
          <p>We keep the model simple: direct support plus a yearly share of surplus.</p>
        </div>
        <div className="about-grid-2">
          <div className="about-card">
            <h3>Direct fan money</h3>
            <p>
              When a fan sends a euro, you keep 98 cents. We take 2% for bank and running costs.
            </p>
          </div>
          <div className="about-card">
            <h3>Shared grant pot</h3>
            <p>
              Each year we share our surplus with artists as grants. The more real engagement you
              gather, the bigger your slice.
            </p>
          </div>
        </div>
        <div className="about-card" style={{ marginTop: '16px' }}>
          <h3>What counts</h3>
          <div className="about-pill-row">
            <span className="about-pill">
              <b>Counts:</b> downloads
            </span>
            <span className="about-pill">
              <b>Counts:</b> fan-sub money
            </span>
            <span className="about-pill">
              <b>Does not count:</b> passive background streams
            </span>
          </div>
          <p className="about-footer-note">
            The system is built so the classic bot-farm trick does not pay. We count deliberate
            actions, not idle play counts.
          </p>
        </div>
      </section>

      <section className="about-section" id="trust">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Keeping it honest</div>
            <h2>Built to resist gaming, and built to be accountable.</h2>
          </div>
          <p>We flag anomalies for humans, tell the artist, and give a right of appeal.</p>
        </div>
        <div className="about-grid-3">
          <div className="about-card">
            <h3>Structural defense</h3>
            <p>
              Passive listening earns nothing. Downloads are counted once per account, with rate
              limits.
            </p>
          </div>
          <div className="about-card">
            <h3>Pattern detection</h3>
            <p>
              We are building tools that look for the tidy shape of fake activity, not the messy
              shape of real fandom.
            </p>
          </div>
          <div className="about-card">
            <h3>Human review</h3>
            <p>
              No silent algorithmic punishment. We would rather miss something than penalize someone
              who did nothing wrong.
            </p>
          </div>
        </div>
      </section>

      <Showcase
        url="tahti.live/dashboard/stats"
        img={statsImg}
        alt="Artist stats — plays, downloads, and grant estimate"
        eyeline="Real numbers"
        title="Plays, downloads, and your running grant estimate."
        reverse
      >
        No listener-hours as a vanity headline. Just the engagement units that actually feed the
        annual grant formula, visible to you as they accrue.
      </Showcase>

      <section className="about-section" id="mixes">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Original work and mixes</div>
            <h2>We treat them differently.</h2>
          </div>
          <p>That distinction matters if the release system is going to mean anything.</p>
        </div>
        <div className="about-grid-2">
          <div className="about-card about-card--coral">
            <h3>Original work</h3>
            <p>
              Tracks and releases are yours. Claiming work that is not yours breaks the rules and
              gets acted on.
            </p>
          </div>
          <div className="about-card about-card--cyan">
            <h3>Mixes and sets</h3>
            <p>
              We welcome them. We ask for a tracklist, and where an artist is on Tahti, you can link
              straight to their channel.
            </p>
          </div>
        </div>
      </section>

      <section className="about-section" id="open">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Open by design</div>
            <h2>You are never locked in.</h2>
          </div>
          <p>The code is open, every page links to its source, and your data can come with you.</p>
        </div>
        <div className="about-grid-2">
          <div className="about-card">
            <h3>AGPL all the way down</h3>
            <p>Anyone running the code, us included, must publish the exact source they run.</p>
          </div>
          <div className="about-card">
            <h3>Forkable by default</h3>
            <p>
              We welcome forks. If you want out, your releases, archive, and fan records can go with
              you.
            </p>
          </div>
        </div>
        <div className="about-card" style={{ marginTop: '16px' }}>
          <h3>What that means in practice</h3>
          <div className="about-grid-2 about-tight" style={{ marginTop: '6px' }}>
            <p>If prices crept up, the community could fork the platform and run it their way.</p>
            <p>If ads or data-selling ever slipped in, the public source would not hide it.</p>
            <p>
              If the platform were ever sold or folded, the code and the data would still be there.
            </p>
            <p>If a feature you rely on disappeared, a fork could keep it alive.</p>
          </div>
        </div>
      </section>

      <section className="about-section" id="helsinki">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Rooted in Helsinki</div>
            <h2>Finnish nonprofit on Finnish infrastructure.</h2>
          </div>
          <p>
            We run on our own hardware in Helsinki, with UpCloud&rsquo;s Helsinki region for
            overflow and no third-party CDN.
          </p>
        </div>
        <div className="about-grid-3">
          <div className="about-card about-card--cyan">
            <h3>Privacy</h3>
            <p>You do not need an account to listen. We set no analytics cookies.</p>
          </div>
          <div className="about-card about-card--violet">
            <h3>Low-knowledge identifiers</h3>
            <p>
              The identifiers we do handle are hashed and rotated daily, so we genuinely cannot tell
              the same listener came back yesterday.
            </p>
          </div>
          <div className="about-card about-card--green">
            <h3>Constitutional limits</h3>
            <p>
              We do not sell data, and we do not chase vanity metrics like listener-hours as a
              headline number.
            </p>
          </div>
        </div>
      </section>

      <section className="about-section" id="people">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">The people behind it</div>
            <h2>Built to outlast any one person.</h2>
          </div>
          <p>Founder included.</p>
        </div>
        <div className="about-grid-2">
          <div className="about-card">
            <h3>Founding team</h3>
            <p>
              Founded by Jani, who has been building software and streaming since the early 2000s,
              alongside a senior UX designer focused on making the capability usable.
            </p>
          </div>
          <div className="about-card">
            <h3>Governance shape</h3>
            <p>
              A paid director on a modest nonprofit salary, a real hiring process, and a documented
              succession plan. The board gains an elected artist representative in year two and
              becomes artist-majority by year four.
            </p>
          </div>
        </div>
      </section>

      <section className="about-section" id="plans">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Plans</div>
            <h2>Free to listen, one artist membership, no upsell maze.</h2>
          </div>
          <p>Listening stays free. Artist membership is the single paid tier.</p>
        </div>
        <div className="about-grid-2">
          <div className="about-card">
            <h3>Free</h3>
            <p>
              Listen in full lossless on member channels, follow artists, join live chat, and
              support the artists you love.
            </p>
            <p style={{ marginTop: '10px' }}>
              You can also start a channel and try broadcasting, up to about an hour a week at 192
              kbps.
            </p>
          </div>
          <div className="about-card about-card--cyan">
            <h3>Artist Membership - 40 EUR a year</h3>
            <p>
              Broadcast live in lossless FLAC with no weekly airtime cap, plus release tools, your
              own space, live chat, newsletter, direct messages, storage, and a vote at the AGM.
            </p>
          </div>
        </div>
      </section>

      <section className="about-section" id="funding">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">How we are funded</div>
            <h2>Clean money only.</h2>
          </div>
          <p>
            Member subscriptions, direct fan support, and cultural grants. No venture capital, no
            equity, no outside owner.
          </p>
        </div>
        <div className="about-grid-2">
          <div className="about-card">
            <h3>Surplus policy</h3>
            <p>
              90% of any surplus goes back to artists as grants. The rest holds a small reserve
              capped at six months of costs.
            </p>
          </div>
          <div className="about-card">
            <h3>Early reality</h3>
            <p>
              The first year is planned to run at a deficit, covered by a founding grant. The first
              grant pool is small and grows with the membership.
            </p>
          </div>
        </div>
        <div className="about-footer-note">
          Target funders include the Finnish Cultural Foundation, Kone Foundation, and Creative
          Europe. Applied-to versus awarded should be kept distinct in public copy.
        </div>
      </section>

      <section className="about-section" id="governance">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Governance</div>
            <h2>You own it.</h2>
          </div>
          <p>We are an association, not a platform that you merely rent space on.</p>
        </div>
        <div className="about-grid-2">
          <div className="about-card">
            <h3>One member, one vote</h3>
            <p>
              Artist members are real members. Proposals and feedback run continuously, and formal
              decisions happen at the AGM.
            </p>
          </div>
          <div className="about-card">
            <h3>Locked promises</h3>
            <p>
              Never taking a cut of fan support, never selling listener data, and never running ads
              are embedded in the constitution.
            </p>
          </div>
        </div>
      </section>

      <section className="about-section" id="transparency">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Transparency</div>
            <h2>The books are open.</h2>
          </div>
          <p>Bylaws public. Finances public. Pay public. Grants public.</p>
        </div>
        <div className="about-grid-3">
          <div className="about-card">
            <h3>Monthly ledger</h3>
            <p>Append-only, not a once-a-year PDF.</p>
          </div>
          <div className="about-card">
            <h3>Independent audit</h3>
            <p>The public numbers are checkable.</p>
          </div>
          <div className="about-card">
            <h3>Public compensation</h3>
            <p>What we pay the people running it is visible.</p>
          </div>
        </div>
      </section>

      <section className="about-section" id="roadmap">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Roadmap and timeline</div>
            <h2>This is already running.</h2>
          </div>
          <p>The beta is live now, and the machinery underneath works on real data.</p>
        </div>
        <div className="about-grid-2">
          <div className="about-card">
            <h3>Near term</h3>
            <p>
              Finish the new interface, keep the invite round moving, and smooth the rough edges
              surfaced by real use.
            </p>
          </div>
          <div className="about-card">
            <h3>Next up</h3>
            <p>
              Deeper audio editing, multitrack and stem tools, stronger anti-gaming detection, and
              more distribution and integration options.
            </p>
          </div>
        </div>
      </section>

      <section className="about-section" id="risks">
        <div className="about-section-head">
          <div>
            <div className="about-eyeline">Honest risks</div>
            <h2>What could go wrong, and what we are doing about it.</h2>
          </div>
          <p>
            We are not promising perfection. We are promising clarity, and that you will hear it
            from us first.
          </p>
        </div>
        <div className="about-grid-4">
          <div className="about-card">
            <h3>We could stay small</h3>
            <p>We are starting with communities, not shouting into the void.</p>
          </div>
          <div className="about-card">
            <h3>Funding timing</h3>
            <p>If grants arrive slower, development slows, but the promises do not change.</p>
          </div>
          <div className="about-card">
            <h3>A small team</h3>
            <p>Succession and artist-majority governance are in from the start.</p>
          </div>
          <div className="about-card">
            <h3>Infrastructure growth</h3>
            <p>
              Current capacity covers the early member base, with upgrades arriving as the
              membership pays for them.
            </p>
          </div>
        </div>
      </section>

      <div className="about-cta-banner">
        <h2>Bring your show to Tahti.</h2>
        <p>
          Free to start, lossless for members, and yours to take with you if you ever leave. No card
          required to try it.
        </p>
        <div className="about-cta-row">
          <a href="/join" className="about-cta-primary">
            Join Tahti →
          </a>
          <a href="/login" className="about-cta-secondary">
            Sign in
          </a>
        </div>
      </div>

      <div className="about-footer-note">
        Tahti is built so the people making the work keep the time, the audience, and the ownership.
      </div>
    </div>
  )
}
