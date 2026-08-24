// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Heading, Link, Text } from '@tahti/ui'

export default function DiscoWidgetsHelpPage() {
  return (
    <article className="brand-prose">
      <Text size="sm">
        <Link href="/help">← Help center</Link>
      </Text>

      <Heading level={1}>Contribute a Disco-widget</Heading>
      <Text>
        Disco-widgets are small, sandboxed add-ons that show up in the store on a listener&apos;s
        Discover page, an artist&apos;s channel page, or the Tahti homepage. Anyone can build one
        and submit it — publishing into a live store is still done by a Tahti admin, but getting
        your code in front of one is as simple as opening a pull request.
      </Text>

      <Heading level={2}>1. Build it</Heading>
      <Text>
        Use the <code>@tahti/widget-sdk</code> package in the tahti-org repository —{' '}
        <code>packages/widget-sdk/README.md</code> walks through the whole contract (what a
        widget exports, how it talks to the host page, and the size/security limits it runs
        under) and <code>packages/widget-sdk/example/live-status/</code> is a complete working
        example to start from.
      </Text>

      <Heading level={2}>2. Open a pull request</Heading>
      <ol>
        <li>
          Fork the tahti-org repository and add your widget under a new directory, e.g.{' '}
          <code>contrib/disco-widgets/&lt;your-widget-slug&gt;/</code> — include your source
          (<code>src/index.ts</code>), a short <code>README.md</code> describing what it does and
          which scope it targets (listener, artist, or admin), and note any config it expects.
        </li>
        <li>Push your branch and open a pull request against tahti-org&apos;s main branch.</li>
        <li>
          In the PR description, be explicit about:
          <ul>
            <li>
              <strong>What it&apos;s for</strong> — the widget&apos;s purpose and who it&apos;s
              for.
            </li>
            <li>
              <strong>What to test</strong> — concrete steps a reviewer can follow to verify it
              works (e.g. build the bundle, load it via the sandbox, confirm it renders correctly
              with representative context data, and behaves reasonably with none).
            </li>
          </ul>
        </li>
      </ol>

      <Text tone="muted" size="sm">
        New to pull requests? GitHub&apos;s own guide covers the basics:{' '}
        <a
          href="https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request"
          target="_blank"
          rel="noopener noreferrer"
        >
          Creating a pull request
        </a>
        .
      </Text>

      <Heading level={2}>3. What happens next</Heading>
      <Text>
        A maintainer reviews the code in your PR. Once it&apos;s merged, an admin builds your
        widget, publishes it through the Disco-widgets admin panel, and approves it — at that
        point it&apos;s live in its store, credited to you, with no further action needed on your
        end.
      </Text>
    </article>
  )
}
