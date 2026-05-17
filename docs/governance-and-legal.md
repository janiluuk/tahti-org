# Tahti ry — governance and legal framework

## Legal form

**Tahti ry** — registered nonprofit association (*rekisteröity yhdistys*) under
the Finnish Yhdistyslaki (Associations Act 503/1989).

Registered at PRH (Finnish Patent and Registration Office) — registration cost
~€100, processing time 2–4 weeks. Founding meeting requires three founding
members (any natural persons).

## Why yhdistys, not osuuskunta or säätiö

- **Osuuskunta (cooperative):** more complex governance, member capital
  contributions, more onerous registration. Right answer if profit *distribution*
  to members were the goal — but in our model the surplus is awarded as grants,
  not member dividends.
- **Säätiö (foundation):** requires endowment capital (€25k minimum), board
  oversight by foundation supervisor, more constrained operationally. Right
  answer only if a benefactor donates the endowment.
- **Yhdistys:** simplest registration, lowest ongoing burden, well-understood by
  Finnish foundations and grant officers, allows employee compensation,
  membership-based governance. **Best fit for our shape.**

## Bylaws sketch

The bylaws (*säännöt*) are the governing document. Key clauses for Tahti ry:

### Purpose (§2)

> The purpose of the association is to advance the work of independent musicians
> and DJs by:
> a) providing them with a free, open-source broadcasting tool ("the
>    Platform") with a 24/7 channel, live broadcasting, automatic archiving,
>    chat, and distribution capabilities;
> b) operating the Platform under fair and transparent terms;
> c) annually distributing operating surplus, after a 10% operating reserve, as
>    grants to artist members, weighted by listener engagement on their channels;
> d) supporting the development of free, open-source audio broadcasting
>    technology.

### Membership (§3)

- Membership is open to natural persons engaged in music creation or audio
  broadcasting
- A member is created automatically upon first paid subscription to the Platform
- Membership lapses if the subscription lapses for more than 90 days
- Members have one vote each in the General Meeting

### General Meeting (§5)

- Annual General Meeting held by end of March
- Notice given to all members at least 14 days in advance
- Meeting may be held electronically (Finnish law explicitly permits this since 2017)
- Decisions by simple majority unless these bylaws specify otherwise
- Members may submit motions; motions must be circulated 7 days before vote

### Board (§6)

- 3–5 trustees elected at the AGM for 2-year terms (staggered)
- Board elects chair from among trustees
- Board sets maintenance team compensation annually, subject to §10 cap
- Board approves the annual report and grant distribution before publication

### Director and maintenance team (§7)

- The Board may appoint a **director** and recognize **maintenance team**
  members (trained member-operators for infra, support, and treasurer functions)
- The director runs day-to-day operations and reports to the Board monthly
- There is **no standing director salary** in the operating budget
- The director is a **maintenance team member** with the same compensation
  rules as other team members (§10)

### Transparency (§9)

- Monthly financial rollup published within 30 days of month-end
- Annual report published within 90 days of fiscal year-end (i.e. by end of March)
- Annual report includes full grant distribution detail (per-channel,
  anonymized as "Channel #N" unless artist opts into public attribution)
- All financial data available via public read-only API

### Compensation cap (§10)

- **Maintenance team** = director + board-approved operators who perform
  ongoing platform operations (deploy, support, ledger, grant runs)
- When operating **surplus is positive** after audited costs, the Board may
  allocate a **maintenance compensation pool** from that surplus
- The pool is divided **equally** among every active maintenance team member
  for that fiscal year (the director receives the same per-person amount as
  any other operator — no premium tier)
- Total maintenance team compensation per fiscal year shall not exceed 30%
  of total revenue for that year
- No board member shall receive compensation other than reimbursement of
  documented expenses (board service is voluntary)
- Bylaws amendments require ⅔ majority of members present at AGM

### Surplus distribution (§11)

- After audit, the operating surplus = total revenue − total costs for the fiscal year
  (costs exclude maintenance compensation — that is paid from surplus per §10)
- If surplus is positive, the Board may first allocate the maintenance
  compensation pool (§10), split equally among active team members
- On the **remainder**, 10% is retained as operating reserve, until reserve = 6 months
  of average monthly costs; thereafter additional retention requires AGM vote
- 90% of surplus distributed as grants to artist members within the following
  fiscal year, weighted by **engagement units** accumulated during the
  reporting period, calculated as:
  - 1 unit per eligible free-listener download
  - 5 units per eligible fan-subscriber download
  - 1 unit per €1 of fan-subscription revenue received by the artist
- Members with fewer than 5 engagement units during the period are excluded
  (anti-gaming threshold; subject to AGM amendment)
- Listener-hours are explicitly **not** a basis for grant calculation; they
  remain as a vanity metric only
- Unclaimed grants (member fails to confirm within 30 days) roll into the
  following year's grant pool

### Fan-to-artist subscriptions (§11.b — NEW v6)

- Tahti ry takes **0% of fan-to-artist subscription revenue**
- A minimal operational fee not exceeding 2% of the gross is taken to cover
  Stripe processing infrastructure, GDPR compliance overhead, refund handling,
  and customer support attributable to the fan-sub system
- This operational fee is consumed by actual costs; any surplus from this
  line item rolls into the following year's artist grant pool
- Stripe transaction fees pass through to the artist
- The 2% cap is reviewable annually by member vote
- Bylaws amendments to this §11.b require ⅔ majority of members present at AGM

### Dissolution (§12)

- Dissolution requires ⅔ majority at two consecutive General Meetings
- On dissolution, any remaining assets are donated to a Finnish nonprofit with
  a similar mission, designated at the dissolving meeting
- No assets may be distributed to members on dissolution

## Board composition strategy

For an association running a tech platform handling money on behalf of artists,
the board should include:

1. **Chair** — a respected figure in Finnish/EU electronic music scene (artist,
   label founder, or scene organizer)
2. **Treasurer** — someone with nonprofit financial governance experience
   (board roles in other Finnish ry's count)
3. **Tech trustee** — a software engineer or technologist who can sanity-check
   the platform decisions you make as director
4. **Artist representative** — elected from the membership starting Year 2
5. **(Optional) Legal/compliance trustee** — IP lawyer or association-law specialist

In Y1 you recruit 1–4 from your network. By Y2 the elected artist representative
joins.

## AGPL implications

AGPL-3.0 means:

1. **Anyone can use, modify, distribute the code.** Anyone can run their own
    Tahti clone. Encourage this — it's the point.

2. **Network-deployed modifications must be open-sourced.** If a third party
   runs a modified version and exposes it as a service (`replay.example.com`),
   they must publish their modified source. This prevents AWS-style appropriation.

3. **Every page links to source.** Per AGPL §13, the public-facing service must
   provide the running version's source. Implementation: footer link + `/source`
   endpoint returning a tarball.

4. **Forks are fine, friendly even.** If someone wants to run Tahti-flavored for
   their local scene, encourage it. The association doesn't lose anything; the
   AGPL ensures we get any improvements back.

5. **AGPL doesn't prevent the nonprofit from charging for the hosted service.**
   Subscription fees are not "redistribution" — they're "operation." Legally
   clean.

## Compliance and reporting

### Mandatory (Finnish law)

- **Membership register** — kept current, available to PRH and auditor on request
- **Annual financial statement** — submitted to PRH within 6 months of fiscal year-end
- **Audit** — required for associations with revenue >€100k (we hit this Y2);
  audited financial statements form part of the annual report
- **Tax filings** — annual tax return; nonprofit status doesn't exempt VAT, so
  VAT registration required from ~Y1 (VAT threshold €15k revenue)
- **Bookkeeping** — double-entry, retained 6 years (Finnish Accounting Act)

### Voluntary but recommended

- **GDPR data protection registry** — internal document of processing
  activities; required if personal data processing is "regular and systematic"
  (which it is, for member data)
- **DPA agreements** with all data processors (Stripe, Revelator, Mixcloud,
  Bunny CDN, hosting provider, etc.)
- **DSA (Digital Services Act) compliance** — public point-of-contact for
  notice-and-action, especially because chat involves user-generated content

### Financial cycle

| Month | Activity |
|---|---|
| Jan | Calendar year start (fiscal year matches calendar) |
| Feb | Finalize prior-year ledger; auditor engagement |
| Mar | Audit complete; annual grant calculation; AGM by month end |
| Apr | Annual report published; grant disbursements begin |
| May | First grant payouts complete |
| Jun–Dec | Ongoing operations; monthly transparency rollups |

## Funding sources Tahti ry is eligible for

**Finnish:**
- Business Finland: Tempo (early stage), Innovation Voucher, Co-Innovation
- Koneen Säätiö (Kone Foundation) — strong fit for cultural/societal innovation
- Suomen Kulttuurirahasto (Finnish Cultural Foundation)
- Helsinki city culture grants
- ELY-keskukset (regional grants)
- Music Finland (Musex) export support

**EU:**
- Creative Europe — Culture strand (€30k–150k for cross-border projects)
- Erasmus+ (if education element added)
- Horizon Europe (less likely for our scope, but possible)

**Targeted donor categories:**
- Aligned Finnish nonprofits and cooperatives (Resonate, Snowflake, etc.)
- Tech companies with cultural-mission sponsorship budgets (Bandcamp, Mixcloud
  itself if relations develop)
- Individual major donors (artist patrons, scene supporters)

## Founding timeline

| Month | Activity |
|---|---|
| -3 | Engage Finnish association law specialist (~€2k consultation budget) |
| -2 | Draft bylaws; identify and approach 3 founding members + board candidates |
| -1 | Founding meeting; sign bylaws; submit PRH registration |
| 0 | Y1 begins; PRH registration typically complete within 2–4 weeks |
| 0 | Apply for Business Finland Tempo grant (8–12 week decision); apply to Koneen Säätiö (~3 month cycle) |
| 0–3 | Build M0–M2 |
| 3–6 | Launch private beta with hand-recruited artists; build M3–M5 |
| 6 | First grant funding ideally secured |
| 6–12 | Build M6–M7 (multistream + distribution) |
| 12 | First AGM; review Y1 (no grant disbursement — no surplus) |

## Personal risk

Operating as a *yhdistys* director has limited personal liability — the
association is a separate legal entity. But:

- You're personally liable for any criminal acts (fraud, embezzlement)
- You can be held liable for tax compliance failures if knowingly negligent
- Director liability insurance (~€500/yr) is recommended

Get the insurance. Sleep better.
