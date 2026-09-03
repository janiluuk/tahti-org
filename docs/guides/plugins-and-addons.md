---
description: How Tahti can be extended with plugins, widgets, visual tools, and integrations
---

# Plugins and add-ons

Tahti is designed to be adaptable. Most of the product is built from small,
replaceable capabilities rather than one fixed workflow, so you can choose a
setup that fits the way you listen, publish, broadcast, or run the
cooperative.

Some capabilities are built into the platform and are available immediately.
Others are add-ons that you enable for a particular page or account. This
keeps the everyday interface focused while leaving room for different kinds
of artists, listeners, broadcasters, and administrators.

## Choose the setup that fits you

- **Listener:** keep the player, queue, favourites, chat, and selected
  Discover widgets; you do not need an artist or cooperative account.
- **Artist:** add profile, channel, release, visual, archive, and audience
  tools as your catalogue grows.
- **Broadcaster:** use the broadcast, radio, recording, and multistream tools
  without having to configure the rest of the studio.
- **Member:** use governance and cooperative information alongside your
  normal listener or artist setup.
- **Administrator:** enable the operational tools needed for moderation,
  radio curation, storage, finance, and governance.

There is no requirement to enable every category. A small setup is a valid
setup, and an artist can change it later without rebuilding their channel.

## Add-on categories

### Import and integrations

Import tools bring audio or catalogue information into your workspace. They
can include local uploads, private storage, connected services, search-based
imports, and link-based sources. Integrations are account connections such as
external music services or distribution destinations. They are kept separate
from the core player so a connection can be added or removed without changing
your catalogue.

### Visuals and themes

Themes change the overall interface. Visual add-ons change the atmosphere of
a channel, release, or player surface: for example a particle field,
waveform, aurora, or another audio-reactive scene. Visuals can be enabled,
configured, or turned off independently of the music itself.

### Release and catalogue tools

Release tools cover artwork, metadata, track order, smart links,
fingerprinting, and delivery preparation. A release can use its own visual
style, which means the same artist can give different releases different
identities without changing the channel design.

### Broadcast and radio

Broadcast add-ons cover encoder setup, live status, recording, radio
playlists, station discovery, and multistream destinations. These are useful
when you are on air, but they do not need to be present in a listener-focused
setup.

### Discovery and channel widgets

Disco-widgets are small, sandboxed add-ons that can appear on Discover, an
artist channel, or another approved surface. They receive only the public
context selected for that surface and communicate through the widget host.
They cannot read the parent page, cookies, or private account data.

Anyone can propose a widget. A maintainer reviews the code, and an
administrator publishes and approves it for the relevant store. See [Contribute
a Disco-widget](/help/disco-widgets) for the submission process.

### Audio tools

Audio-editor plugins are processing steps such as gain, EQ, compression,
limiting, and filtering. They are composed into a chain, so you can use only
the processing you need and keep the rest of the editor uncluttered.

### Governance and administration

Governance and administrative tools are role-gated rather than listener
add-ons. Members see cooperative decisions and voting; administrators see
moderation, operational status, finance, and curation tools. This separation
prevents empty or irrelevant controls from appearing for people who cannot
use them.

## Why some categories are not visible

The store builds its category filters from the add-ons actually available in
the current store and scope. Categories with no published items are omitted,
and a category is not shown merely because it existed in an older registry.
This keeps the store honest: every visible category has something you can
inspect or enable.

The same principle applies to account and admin navigation. A feature that is
not available for your role, scope, or current store should not leave behind
an empty page or a dead category.

## Building an extension

Choose the smallest extension point that matches your idea:

1. Use an **audio-editor plugin** for a deterministic processing step.
2. Use a **Disco-widget** for a public, sandboxed visual or information
   surface.
3. Use a **provider/integration** when the feature needs a defined account or
   catalogue connection.
4. Use a **core platform change** when the capability needs private data,
   permissions, storage, billing, or moderation.

Player Store listings (installable plugins and themes) live in the sibling
[tahti-registry](https://github.com/janiluuk/tahti-registry) checkout
(`../tahti-registry`), not in this API monorepo. A new Store plugin must appear
in that repo's `plugins.json`; a changed one must bump `version` there. See
root `AGENTS.md`.

Security, permissions, and public/private boundaries are part of the design,
not an afterthought. An extension should declare what it needs, work when
optional context is missing, and fail without hiding the rest of the app.

For implementation details, start with the [widget SDK README](../../packages/widget-sdk/README.md)
or the [audio editor plugin registry](../../packages/audio-edit/src/plugins/registry.ts).
