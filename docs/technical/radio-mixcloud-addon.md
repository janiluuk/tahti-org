# Tahti Radio → Mixcloud Live (PLAT-053)

## Ownership and current evidence

Mixcloud configuration belongs in the Player add-on's Configure modal. Core
owns encrypted destination persistence and the generic streaming relay. Do not
add a standalone Mixcloud settings page to core or Player.

The missing-Liquidsoap-file blocker is obsolete. The worker's
`processRadioSlotSwitchoverJob` starts Tahti Radio with the `channel` template.
`infra/liquidsoap-channel.liq.template` already contains the RTMP output marker;
the orchestrator renders enabled destinations with `buildRtmpMirrorOutput`.
The old `services/tahti-radio` telnet service is not the only radio implementation.

## Remaining implementation

- Add a board-authorized radio destination API using the existing encrypted
  RTMP target contracts. Artist endpoints must retain ownership checks.
- Extend the Mixcloud add-on Configure modal to select Tahti Radio for board
  operators. Keep creation, testing, key replacement, enable/disable, and removal
  within the add-on. Use the shared Storybook controls.
- Keep new destinations disabled until configuration is tested. The API now
  honors explicit `enabled: false`; omitted values retain existing behavior.
- Explain that the current endpoint test proves TCP reachability only, not
  Mixcloud authentication or successful broadcasting.
- Apply enabled destination changes to the running radio relay and verify that
  disabled or deleted destinations stop. Never equate a saved row with a live relay.
- Test authorization, artist/radio isolation, encrypted secrets, relay output,
  and the Configure flow. Verify Mixcloud reception with operator credentials.

Real Mixcloud reception remains unverified until a valid stream key is supplied
through the add-on. Do not publish a test broadcast without an explicit operator
action. No Mixcloud key is needed for local authorization and rendering tests.
