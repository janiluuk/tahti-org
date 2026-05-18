# Tahti ry — business evaluation

This is the honest assessment of Tahti as a business proposition. It is written for the founder, the founding board, and any grant officer or aligned org reviewing whether to back this venture. It is not a pitch deck.

## Executive summary

**Tahti is viable as a sustainable Finnish nonprofit producing modest but real artist economic outcomes.** It will not become a unicorn, a venture-backed scale-up, or a household name. It will, plausibly, distribute ~€312k to ~3,200 artists over three years while paying its director a fair Finnish wage and operating on Finnish infrastructure. This is a small, beautiful business — provided three specific things go right.

**The three things:**

1. A founding grant of €20-25k lands in Year 1
2. The org reaches 200+ paid members by end of Year 1
3. The director does not burn out or quit

If any of these fails, Tahti does not survive its first year. If all three succeed, Tahti reaches operational self-funding by Y2 and distributes meaningful grants by Y3.

## What this is, structurally

A registered Finnish association (yhdistys) building open-source software, paying one salary, generating modest subscription revenue, and redistributing surplus to its artist members annually. The legal form is well-established, the operational model is conservative, and the financial expectations are realistic.

Comparable orgs to think about (none are exact analogs):
- **Resonate (cooperative streaming, UK/Berlin):** member-owned, has struggled for sustainability but persists for 8+ years. Listener-side cooperative; Tahti is artist-side.
- **Faircamp (decentralized publishing tool):** open-source, hobby-scale, no nonprofit structure. Tool, not org.
- **Mixcloud (commercial, London):** for-profit but ethically distinct, blanket-licensed for DJ mixes. Closest commercial peer. ~50 staff, ~£5M revenue.
- **Bandcamp (commercial, since 2008):** existence-proof that artist-aligned commercial models can work at scale. Now Songtradr-owned, story unclear.

None of these are Finnish, none are nonprofits-by-design, none combine channel-first + fan-subs + transparent ledger. Tahti is genuinely novel in the combination — not in any single piece.

## The business in three numbers

| | Y1 | Y2 | Y3 |
|---|---|---|---|
| Org revenue (subs + grants + dist) | €35k | €108k | €291k |
| Org cost (staff + infra + ops) | €55k | €86k | €148k |
| Artist money distributed (grants + fan-sub direct) | €2k | €42k | €268k |

**3-year cumulative: €312k to artists. €115k director compensation. €17k operating reserve.**

These numbers are modeled, not promised. The model rests on assumptions reviewed in `docs/financial-model.md` and stress-tested in `docs/budget-detailed.md`.

## What could make this work

Positive signals — things that already exist or are demonstrably attainable:

1. **There is a real, named problem.** Independent musicians genuinely struggle with platform fragmentation (SoundCloud + Mixcloud + Spotify + Bandcamp + Patreon + Instagram), genuinely lose audio quality at the listener tier, genuinely have AI competition on Spotify, genuinely have grown skeptical of Patreon's cut. The competitive critique in `docs/strategy-and-product.md` is verifiable, not speculative.

2. **The Finnish nonprofit landscape is supportive.** Business Finland Tempo grants up to €50k for early-stage innovation; Koneen Säätiö actively funds artistic infrastructure; SKR has been supporting digital culture for a decade. None of these are guaranteed — but the funding environment is meaningfully better than for a comparable US or UK venture.

3. **The technology is mature.** Liquidsoap, Icecast, FLAC, HLS, Stripe Connect, Postmark, AGPL — all battle-tested. This is not bleeding-edge engineering; it's careful integration. Build risk is moderate, not high.

4. **The community pre-exists.** Helsinki's electronic + ambient + experimental music scene is active and tight-knit. Finding 30 founding artists is plausible. Reaching 200 by Y1 end requires beyond-scene outreach, but is not extraordinary.

5. **The unit economics are honest.** €40/year is below what most artists already pay for SoundCloud Pro Unlimited (~$192/yr), Mixcloud Pro (~€180/yr), or Bandcamp Pro (~$120/yr) — and competitive with all of them. The conversion narrative ("you're already paying more for less") has substance.

6. **The director's compensation is not heroic.** €30k Y1 → €45k Y3 is below median Finnish tech salaries, in line with Finnish nonprofit director compensation. The founder is paying themselves a salary that is real but modest. No equity dilution downstream means the salary is the whole comp.

## What could break this

Negative signals — risks that aren't dismissable:

1. **Year-1 funding gap is real and binding.** The base case shows a Y1 deficit of €19k. Without a foundation grant landing in Q1, the org cannot pay its director and cannot operate. Grant decisions are stochastic. The mitigation is parallel applications (Tempo + Koneen + SKR), but the worst-case is all three rejecting, in which case the org cannot incorporate.

2. **200 paid members in Y1 is optimistic, not conservative.** Many Finnish indie SaaS startups struggle to hit 100 paid users in Year 1. Tahti's recruitment story (Helsinki scene + scene press + word of mouth) is reasonable but unproven. The bear case (100 paid) is the realistic floor; if even that fails, the model breaks.

3. **The engagement-unit grant model could be controversial in practice.** When the first grants are distributed in March of Year 2, the top-decile getting ~€20-30 and the bottom-decile getting ~€2 may produce contested AGM debate. The constitution permits formula amendment by member vote, but the social cost of the first controversy is real and could fragment the membership.

4. **AGPL is a moat *and* a vulnerability.** The org cannot become extractive because the license forbids it. But the org also cannot defend against a well-funded fork. If a commercial player adapts Tahti's UI + adds proprietary features + competes for the same artist base, AGPL doesn't prevent it — only the network effect does. And the network effect is small in Y1-Y2.

5. **Director burnout is the most likely cause of failure.** Solo-founder Finnish nonprofits often fail not from lack of funding but from director exhaustion in Year 1-2. The constitution mandates fair pay; the operational reality of running a yhdistys + writing code + recruiting artists + handling support + applying for grants is more than 40 hours/week. Mitigation: hire a contractor early (Month 6-9), not late (Month 18+).

6. **Infrastructure at scale has one cliff:** Y3 fiber upgrade. If 10 Gbps business fiber in Helsinki costs significantly more than €18k/year, the budget breaks. We can route through UpCloud or activate Bunny CDN, but each undermines the "all-Finnish infrastructure" story. Negotiate fiber contract in Month 24, not Month 30.

7. **Foundation grants are not perpetual.** Year 1-3 grants are budgeted at €25k → €45k → €80k. Year 4+ grants are not budgeted because the org should be self-sustaining by then. If the grant pipeline weakens earlier than expected — for example, if Tempo restructures or Koneen's priorities shift — Y2 or Y3 surplus collapses.

8. **Director turnover is structurally hard.** Tahti's bylaws assume that the director can be replaced over time. In practice, founder-as-director is the *only* model that works for 2-3 years (institutional knowledge, network, vision). The succession plan documented in governance is real but untested. If the founder leaves at Month 18, the org may not survive.

## What "success" looks like (and what it doesn't)

**Success at end of Year 3:**
- ~4,000 paid members across Finland + Estonia + Sweden + Germany
- ~€130k in artist grants distributed annually (~€260 average for engaged artists)
- ~€138k in direct fan-subs flowing to artists annually
- Director paid €45k/year, supported by one engineer + one part-time customer support
- 2 elected artist board members + founder + 1 outside advisor
- Operational reserve €16k+, growing
- Public audited financials going back 3 years
- Tahti Radio playing on Mixcloud Live continuously
- ~25 venue partners across Nordic + Baltic
- Press coverage in Rumba, Soundi, Politico EU (the European tech ethics angle)
- Tahti is mentioned in the same breath as Bandcamp and Mixcloud, with a smaller user base but a stronger ethical position

**What "success" does NOT mean:**
- Tahti is not "the next Spotify" or "the next SoundCloud." We do not compete at that scale.
- The director does not become wealthy. They are paid fairly, that's it.
- There is no "exit." No acquisition, no IPO, no scale-up valuation.
- We are not solving the music industry. We are giving 4,000 specific artists a better deal.

**What "failure" looks like and how to recognize it:**
- Year 1: fewer than 100 paid members + no founding grant secured → org cannot operate. Founder seeks employment, project paused indefinitely.
- Year 2: paid members <500, fan-sub adoption <2%, foundation grants drying up → director salary cut by board vote, contractor hours reduced, roadmap paused. Survival mode for 6-12 months while reapplying for grants.
- Year 3: technology working but membership plateau at 1,500-2,000 → org operates but doesn't reach scaling thresholds. Director continues at €40k/year salary, grants modest (~€30-50k pool). Quiet, sustainable, smaller than planned.

The middle scenario (Year 3 plateau) is the most likely actual outcome. It is not failure — it is a small business doing real work for real artists.

## The decision the founder needs to make

Tahti is a 5-10 year commitment. The founder will spend that time on this org's behalf, paid modestly, with no equity upside and no exit. The reward is the work itself + the small but real economic outcomes for the artists.

Before incorporating, the founder should be able to answer yes to all of:

- Can I afford 6 months of personal runway if the founding grant is delayed?
- Am I prepared to be in this for 5+ years, not 18 months?
- Am I OK with a Finnish-nonprofit-director income level for that whole period?
- Do I have a co-founder, board member, or trusted advisor who will tell me uncomfortable truths?
- Am I OK with the worst plausible outcome (the Year 3 plateau scenario): I work hard for 3 years, the org distributes €100k or so in grants, and we don't change the music industry?

If any of these is "no," the project should be reshaped or paused.

## The decision a grant officer needs to make

A grant officer evaluating Tahti for Tempo / Koneen / SKR funding should ask:

1. **Is the legal structure real?** Yhdistys with bylaws + Y-tunnus = yes, this is a legitimate Finnish nonprofit.
2. **Is the financial plan plausible?** The €19k Y1 deficit is the funding-ask shape. The grant covers a recognizable founding need.
3. **Does the founder have a credible track record?** Audit the founder's previous work in music tech, broadcasting, or nonprofit operations.
4. **Will the funds be accounted for?** The transparency policy (`docs/transparency-policy.md`) commits to public ledgers and audited financials. This is verifiable post-grant.
5. **Will the public benefit be tangible?** ~€312k to ~3,200 artists over 3 years is a concrete answer.
6. **What happens if it fails?** AGPL means the code survives. The membership can take over operations. There is no "burning $5M of grant money on AWS bills" failure mode.

For a grant officer, Tahti is a low-risk grant: small, well-structured, accountable, with a clear public-benefit thesis.

## My honest recommendation

To the founder: **proceed, but only if Phase 0 actually closes.** Do not start Phase 1 development without a confirmed €15k+ grant. Do not start without your own 6-month runway. Do not start without at least one experienced board member who will hold you accountable.

To the board: **hold the director to the constitution.** The most likely way Tahti drifts is not through bad faith but through scope creep ("let's add this feature," "let's accept this small advertising deal," "let's hire a marketing person") — each individually defensible, cumulatively destructive. The board's job is to say no.

To grant officers: **fund the founding year.** The Y1 ask is small (€20-25k), well-specified, and the org's track record is the constitution + the plan + the audited path. The expected ROI to the funder's stated public-benefit goals is high.

To artists considering joining: **try the free tier first.** Tahti's value proposition only matters if the product actually works for *your* practice. If your art is occasional ambient sets, Tahti is a great fit. If your art is club residencies with five-figure listener counts on social, your math is different. We are not the answer for everyone, and we don't need to be.

## What I'm not saying

I am not saying Tahti will succeed. I am not saying the model is novel enough to attract press coverage. I am not saying foundation grants will continue beyond Year 3. I am not saying the membership will stay aligned at the AGM. I am not saying the audio-quality story will move enough listeners to matter.

I am saying: **the plan is sound, the math is honest, the legal structure is correct, and the principles are well-articulated.** This is a substantially better-prepared launch than 90% of Finnish startups I would encounter, and it is positioned to deliver real, modest, accountable value to a population (independent musicians) that genuinely needs better infrastructure.

That's the business evaluation. Make of it what you will.

— Drafted as an honest internal memo, not a pitch document.
