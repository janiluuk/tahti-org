# Replay ry — storage policy

## The principle

Replay does not enforce per-user storage limits.

We track usage. We display it. We nudge gently when it grows large. We do not
cut anyone off.

## Why

Hard storage caps are a tax on serious artists. The DJ who recorded 200 hours of
shows last year deserves to keep them. The producer with a 6-year back catalog
deserves not to choose what to delete. The podcaster archiving a 5-year talk
show deserves the full archive on their channel.

Enforcement makes the platform feel hostile to the most engaged users — exactly
the artists we exist to serve.

## How

### Soft target

Each user has a `softTargetBytes` value, default **500 MB**.

When a user crosses 100% of soft target:
- They see a banner in the dashboard: *"You've used 1.2 GB. That's more than
  most artists — and that's fine. Storage is shared, so we appreciate when
  members keep their archives lean."*
- Tone: appreciative, not threatening
- Frequency: at most once per quarter per user (email + in-app)

When a user crosses 500% of soft target (~2.5 GB on default):
- In-app banner only, no email
- Includes a "view largest items" link to help self-curate
- No pressure beyond informational

There is **no level above which usage is blocked due to soft target.**

### Hidden technical ceiling

A `hiddenCeilingBytes` value, default **50 GB**, exists only as an anti-abuse
safeguard.

This number is:
- Not exposed in any UI
- Not mentioned in marketing or member-facing docs
- Not in the public bylaws
- Only relevant to ops alerts

When ops monitoring detects a user >47.5 GB (95% of ceiling):
- Alert goes to the director and treasurer
- Manual review of the account begins
- If legitimate use: the ceiling for that user is raised (no automatic block)
- If suspected abuse (uploaded gigabytes of unrelated content, script-driven,
  etc.): manual outreach to the user, with documented reasoning

This is **judgment-based, not automatic.** No code path blocks the user.

### Per-user storage display

Every user sees in their dashboard:

- Total storage used (e.g. "2.1 GB used")
- A simple progress bar against the soft target — but the bar caps at 100%, no
  alarming red zone
- A breakdown by archive item, sortable by size and date
- "Suggest cleanup" link that shows the largest 10 items with one-click delete

We make it *easy* to be lean, but never required.

### Aggregate storage on the transparency dashboard

The public transparency page shows:
- Total platform storage: e.g. "3.2 TB across 1,200 channels"
- Average per channel: e.g. "2.7 GB"
- Median per channel: e.g. "0.8 GB"
- Top decile: e.g. "8.4 GB"

This lets the membership see, collectively, where storage is growing — and
collectively decide whether to adjust the policy.

## Cost transparency

The transparency dashboard breaks out storage as a discrete cost line:

- Hardware amortization attributable to storage (~25% of total amortization)
- Backup colocation cost
- CDN spillover from storage delivery

In Y3, total storage-related cost is approximately €15,000/year. With 4,000
paying members, that's €3.75/year/member — about 9% of the €40 Artist
subscription.

If average per-member storage doubles (from ~3 GB to 6 GB), this rises to ~€7
per member — still 18% of subscription. The model survives.

If average per-member storage 5×s (to 15 GB), cost rises to ~€19/member —
approaching half of subscription revenue. **At this point the policy must be
revisited** at AGM.

## Governance commitment

The bylaws (§8 proposed) state:

> Replay ry does not impose enforced storage limits on member channels. The
> Board may revisit this policy if aggregate storage cost exceeds 25% of
> subscription revenue, by proposing an amendment subject to member vote at
> the next General Meeting.

This makes the open-storage commitment *durable* — it can't be reversed
unilaterally by a director or board, only by the membership.

## Why this is safer than it sounds

Three safeguards keep this from going wrong:

1. **The hidden ceiling.** A single abusive account can't dump 1 TB overnight.
   At 50 GB per account, even 1,000 maxed-out accounts is 50 TB — within the
   storage node spec.
2. **Aggregate transparency.** The membership sees the growth in real time.
   Self-regulation is more powerful than enforcement, and members understand
   the org's economics.
3. **Bylaws revisitation trigger.** If the cost outpaces revenue, the bylaws
   require a member vote rather than waiting for a crisis.

## What about the soft target — could we just remove it?

We considered this. The reason to keep the soft target visible:

- It signals to new users that we care about storage costs (anchoring expectations)
- It gives a useful "you're heavy, here's how to lighten" tool to artists who
  want to be considerate
- It costs nothing technically and removes nothing artists need

The principle holds: **we display, we nudge, we don't enforce.**

## In practice

A new artist joining:
- Sees their dashboard with "0 MB / 500 MB" gauge
- Uploads a 30-minute MP3 mix (about 25 MB) — gauge updates
- After a month of activity, they're at 200 MB — gauge is happy
- After a year, they're at 3 GB — gauge is at "way above target," no
  consequences
- After 5 years, they're at 18 GB — still no consequences, no alarm

A user who runs a script uploading randomized test data:
- Crosses 47.5 GB
- Internal alert fires
- Director gets a Slack notification
- Director looks at the account, contacts the user, decides whether to raise
  ceiling or close the account based on actual behavior

This is operational judgment, not algorithmic enforcement. That is the point.
