# Listening parties (API)

**Status:** partial

API half of the Listening Party feature: scheduling, derived timeline, public
party view, party-scoped pre-release stream, channel list, purchase tiers,
"Now playing" chat lines. Design and endpoints:
[`docs/technical/listening-parties.md`](../technical/listening-parties.md).
The web half (party page, studio form) is built in `../tahti-player` against
the same contract.

## Left

- [ ] Fold into `HISTORY.md` / `features.md` when the PR is ready to merge.
- [ ] Request bodies are validated in the handlers, so OpenAPI (and
      `@tahti/api-client`) types the responses only, like the other routes.
- [ ] Later projects: server playout into the channel HLS, formats /
      pre-orders / physical goods, party-only slow mode in chat.
