# User journey — Cooperative member

A **member** is a verified Tahti ry cooperative member (€40/year). Members can vote on governance motions, see the member directory, and use the full studio if they are also an **artist** (channel + releases). This is separate from **fan subscriptions** (paying an individual artist).

| Persona | Account | Typical routes |
|---------|---------|----------------|
| **Listener** | Optional | `/c/:slug`, `/u/:username`, `/r/:slug` |
| **Member** | Required, `isMember` | `/governance`, `/dashboard` (membership block) |
| **Artist** | Member + channel | `/dashboard`, `/c/:slug`, fan tiers, stream settings |

See [for-members.md](../guides/for-members.md) for step-by-step guidance.

---

## Experience overview

```mermaid
journey
    title Cooperative member on Tahti
    section Join
      Register at /join                    : 4 : Member
      Verify email                         : 3 : Member
      Pay €40/year membership on dashboard : 4 : Member
    section Participate
      Open /governance                     : 5 : Member
      Read open motions and member list    : 5 : Member
      Cast advisory vote on a motion       : 4 : Member
    section Studio (if also artist)
      Same paths as artist journey           : 5 : Artist
```

---

## Journey 1 — Become a member

**Covered by API e2e:** `artist onboarding` in `vital-flows.test.ts` (register → verify → membership checkout).

```mermaid
sequenceDiagram
    participant M as New user
    participant APP as app.tahti.live
    participant API as API

    M->>APP: /join — email, password, username
    APP->>API: POST /api/auth/register
    M->>APP: Clicks verify link
    APP->>API: GET /api/auth/verify?token=…
    M->>APP: /login → /dashboard
    M->>APP: Activates membership (dev checkout or Stripe)
    APP->>API: POST /api/me/membership/checkout
    API-->>APP: isMember true, memberNumber assigned
```

---

## Journey 2 — Governance (members only)

**Covered by bash e2e:** `tests/e2e/journeys/member.sh` and Vitest `persona-journeys.test.ts`.

```mermaid
sequenceDiagram
    participant M as Member (no channel)
    participant APP as /governance
    participant API as API

    M->>APP: /login
    M->>APP: Opens /governance
    APP->>API: GET /api/v1/governance/members (session)
    API-->>APP: Member directory (member numbers)
    APP->>API: GET /api/v1/governance/motions
    API-->>APP: Open / closed motions (tallies hidden while open)
    M->>APP: Votes YES on open motion
    APP->>API: POST /api/v1/governance/motions/:id/vote
```

Non-members receive **401** on governance routes (see `vital-flows.sh` auth guards).

---

## Journey 3 — Member who is not an artist

Many members only listen and vote. They use the **listener** paths for audio and **governance** for cooperative decisions. They do not need RTMP keys or releases.

---

## Automated coverage

| Layer | Script / test |
|-------|----------------|
| CI bash | `tests/e2e/user-journeys.sh` → `journeys/listener.sh`, `artist.sh`, `member.sh` |
| Playwright (local) | `tests/e2e/user-journeys.mjs` |
| Vitest | `apps/api/src/routes/journeys/persona-journeys.test.ts` |
| Fixtures | `apps/api/scripts/seed-e2e-screenshots.ts` (demo motion + fan sub) |
