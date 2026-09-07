# Pay-what-you-want purchases: expose existing backend on the track page

**Status:** backend field shipped (2026-09-07); frontend still to do in
the sibling `tahti-player` repo.

## Background

`tahti-player`'s `docs/todo/pay-what-you-want-pricing.md` assumed PWYW
pricing needed new schema (`pricingModel` enum, `minimumPrice`) from
scratch. It didn't — checked this repo's actual schema first:
`PurchaseTier.priceOptional` (boolean, default false) and
`Purchase.amountCents` ("what was actually paid (may be 0 for a
priceOptional free claim)") already exist, and
`POST /api/v1/u/:username/purchase-tiers/:tierId/checkout` already
accepts a caller-supplied `amountCents` override when the tier's
`priceOptional` is true (validated `>= 0`; rejected when the tier is
NOT `priceOptional`; a `$0` amount short-circuits to a free claim with
no Stripe involved at all). This has been shipping since before this
session — the todo doc in the sibling repo was simply never checked
against current code.

**What was actually missing:** `GET /api/tracks/:id` (the standalone
public track-detail endpoint the Tahti Player track page calls) never
returned `purchaseTier.priceOptional` — only `id`/`name`/`priceCents`.
So the frontend had no way to know a tier was PWYW at all, and its own
buy button always passed the tier's exact suggested price with no
amount input.

## What shipped here

- `apps/api/src/routes/tracks/get.ts`: select + return
  `purchaseTierPriceOptional` (boolean) alongside the existing
  `purchaseTierId`/`purchaseTierName`/`purchaseTierPriceCents`.
- `packages/shared/src/dto/api-responses.ts`:
  `PublicTrackDetailSchema` gained `purchaseTierPriceOptional:
  z.boolean().optional()` — needed for the route's typed OpenAPI
  response (`.passthrough()` let the raw field through at runtime
  either way, but without this the generated SDK type wouldn't have
  known about it).
- `api-client generate`: real diff this time (one field added to
  `schema.d.ts`'s `GET /api/tracks/{id}` response type).

## Not done here (frontend, sibling repo)

`tahti-player`'s `packages/tahti-web/src/views/TrackDetailView.tsx`:
- `buyTrack()` currently always passes `amountCents:
  detail.purchaseTierPriceCents ?? undefined` — needs to check the new
  `purchaseTierPriceOptional` field and, when true, show an amount
  input (pre-filled with the suggested price, floor at $0, since there
  is no separate minimum-price concept in this backend design) before
  calling `checkoutPurchaseTier` with the buyer's chosen amount instead
  of always the suggested one.
- `api/types.ts`'s `TrackDetail`-equivalent type and the mock client
  (`api/client.ts`) need the new field added/populated, matching the
  real endpoint's response shape.
- The tier *editor* (wherever artists create/edit `PurchaseTier` rows —
  a `priceOptional` toggle already exists in the create/patch API types
  per `api/purchase-tiers.ts`, so check whether the editor UI already
  exposes it before assuming that part is missing too — it may just be
  the buyer-side amount input that's actually absent).

## Verification

`apps/api`, `packages/shared`: `tsc --noEmit` and `eslint` clean.
`get.test.ts`: 6/6 pass against an ephemeral `postgres:16-alpine`
(added a `priceOptional: true` tier + `purchaseTierPriceOptional`
assertion to the existing purchase-gate test). `api-client generate`
diff reviewed — exactly the one new field, nothing else changed.
