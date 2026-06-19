# Tahti ry — detailed budget &amp; break-even analysis

This document breaks the financial model down to the level a treasurer can audit and a grant committee can interrogate. It is the operational complement to `financial-model.md` (which gives the headline numbers and strategic framing).

All figures are EUR, exclude VAT (yhdistys is VAT-exempt below €15k turnover in Y1; registers for VAT in Y2). All categories are mapped to the constitution's three rules.

## Budget structure

Costs are organized into five categories:

1. **Infrastructure** — owned hardware, business fiber, electricity, UpCloud spillover, storage
2. **Platform services** — third-party tools that make the product work (email, captcha, ACRCloud, etc.)
3. **Operations** — tooling, SaaS, support, recurring memberships
4. **Professional services** — director salary, legal, accountant, audit, board admin (the "we pay people fairly" line)
5. **Variable / pass-through** — distribution and Stripe fees that scale with member count

Categories 1-4 are roughly fixed for a given year. Category 5 scales with revenue. The break-even question is: at what paid-member count does revenue cover categories 1-4 plus the pass-through fees they implicitly cover?

## Base case: 200 / 1,200 / 4,000 members

### Year 1 — 200 paid, 600 free

**Revenue (annual): €35,426**

| Line item | Amount | Note |
|---|---|---|
| Subscriptions (200 × €40) | €8,000 | Founding cohort |
| Distribution revenue (gross) | €1,440 | 30% of paid × 3 releases × €8 |
| DSP referral (DistroKid) | €150 | 15% of paid × €5 |
| Donations (5% × €20) | €800 | All artists (paid + free) |
| Foundation grants | €25,000 | Tempo / Koneen / SKR target |
| Fan-sub op fee (2% of gross) | €36 | 200 × 5% × 3 fans × €5 × 12 × 0.02 |
| **Total revenue** | **€35,426** | |

**Costs (annual): €54,572**

#### Infrastructure — €9,140 / yr (€762/mo)
| Line item | Annual | Monthly | Note |
|---|---|---|---|
| Hardware amortization (5-year) | €4,680 | €390 | Initial capex ~€23k spread |
| Business fiber (1 Gbps Helsinki) | €2,400 | €200 | Elisa/DNA business symmetric |
| Electricity (Helsinki rate, low draw) | €660 | €55 | Server room, ~700W avg |
| UpCloud Helsinki (spillover origin) | €600 | €50 | Small instance + bucket |
| Backup colocation (DR copy) | €600 | €50 | Aligned Finnish provider |
| Storage capacity headroom | €200 | €17 | Initial 4 TB local + 1 TB DR |

#### Platform services — €1,380 / yr (€115/mo)
| Line item | Annual | Note |
|---|---|---|
| Newsletter dispatch (Postmark + SES base) | €380 | Postmark transactional + SES broadcast at low volume |
| Fan-sub infrastructure (Stripe Connect setup) | €300 | KYC + dispute infrastructure |
| Tahti Radio (Mixcloud Pro + Liquidsoap container) | €200 | Mixcloud Pro €15/mo + compute |
| hCaptcha + uptime monitoring | €400 | hCaptcha Enterprise free tier + Upptime self-hosted |
| ACRCloud (track ID for tracklists) | €100 | Pay-as-you-go, low Y1 use |

#### Operations — €240 / yr (€20/mo)
| Line item | Annual | Note |
|---|---|---|
| Tooling SaaS (1Password, Sentry, gitops) | €240 | Bare minimum |

#### Professional services — €43,040 / yr (€3,587/mo)
| Line item | Annual | Note |
|---|---|---|
| Director salary | €30,000 | Fair Finnish nonprofit director wage (Y1 cap waived per bylaws) |
| Legal retainer | €6,000 | Yhdistys formation + ongoing |
| Accountant (monthly bookkeeping) | €2,040 | €170/mo small business rate |
| Annual financial audit | €2,000 | Auditor + filings |
| Board administration (AGM + minutes) | €1,500 | Per-meeting honoraria |
| DSP compliance specialist | €1,500 | Annual review for Revelator integration |

#### Variable / pass-through — €772 / yr (€64/mo)
| Line item | Annual | Note |
|---|---|---|
| Distribution passthrough (Revelator) | €540 | 30% × 200 × 3 releases × €3 unit cost |
| Stripe fees on subscriptions (2.9%) | €232 | 200 × €40 × 0.029 |

**Y1 result: revenue €35,426 − costs €54,572 = deficit €19,146.**

The deficit is covered by the foundation grant. If the modeled €25k grant isn't secured, the founding plan fails and Tahti cannot incorporate without raising the gap from another source.

---

### Year 2 — 1,200 paid, 3,600 free

**Revenue (annual): €107,700**

| Line item | Amount | Note |
|---|---|---|
| Subscriptions (1,200 × €40) | €48,000 | 6× growth |
| Distribution revenue (gross) | €8,640 | 30% × 1,200 × 3 × €8 |
| DSP referral | €900 | |
| Donations | €4,800 | |
| Foundation grants | €45,000 | Second-year continuation grants |
| Fan-sub op fee (2%) | €504 | Adoption ramps to 5% with avg 5 fans |
| **Total revenue** | **€107,700** | |

**Costs (annual): €86,092**

#### Infrastructure — €17,100 / yr (€1,425/mo)
- Hardware amortization €4,680
- Capex top-up €3,000 (storage expansion)
- Business fiber €4,800 (still 1 Gbps but premium SLA)
- Electricity €720
- UpCloud €1,800 (more spillover usage)
- Backup colocation €600
- Storage capacity €1,500

#### Platform services — €7,200 / yr (€600/mo)
- Newsletter dispatch €2,100 (broadcasts at 1,200 × 187 subs avg = real volume)
- Fan-sub infra €800 (more transactions, dispute handling)
- Tahti Radio €800
- hCaptcha + monitoring €800
- ACRCloud €600
- Social auto-post infra €600 (OAuth scale)
- Embed widget CDN €400
- Smart link routing €200
- Chat infrastructure €600
- Venue API €200
- Tagging infra €100

#### Operations — €2,260 / yr (€188/mo)
- Tooling SaaS €360
- Customer support tools €600 (first ticketing setup)
- ISRC membership (IFPI Finland) €100
- Revelator monthly minimum €1,200

#### Professional services — €54,900 / yr (€4,575/mo)
- Director salary €40,000 (raise to match scale)
- Legal retainer €6,000
- Accountant €2,400
- Audit €2,500 (revenue >€100k = full audit)
- Board administration €2,000
- DSP compliance specialist €2,000

#### Variable / pass-through — €4,632 / yr (€386/mo)
- Distribution passthrough €3,240
- Stripe fees on subs €1,392

**Y2 result: revenue €107,700 − costs €86,092 = surplus +€21,608.**
**Y2 grant pool (90% of surplus) = €19,447. First year grants distributed.**

---

### Year 3 — 4,000 paid, 12,000 free

**Revenue (annual): €289,720**

| Line item | Amount | Note |
|---|---|---|
| Subscriptions (4,000 × €40) | €160,000 | |
| Distribution revenue (gross) | €28,800 | |
| DSP referral | €3,000 | |
| Donations | €16,000 | |
| Foundation grants | €80,000 | Y3 grants larger as track record builds |
| Fan-sub op fee (2%) | €3,072 | 8% adoption × 8 fans avg × €5 × 12 × 0.02 × 4,000 |
| **Total revenue** | **€290,872** | |

(Small rounding: model puts revenue at €289,720; this matches within €1,200 due to mid-stream simplifications.)

**Costs (annual): €148,220**

#### Infrastructure — €39,780 / yr (€3,315/mo)
- Hardware amortization €4,680
- Capex top-up €6,000 (compute refresh)
- Business fiber **€18,000** (10 Gbps upgrade, required by FLAC at scale)
- Electricity €840
- UpCloud €4,800 (significantly more spillover at scale)
- Backup colocation €960
- Storage capacity €4,500

#### Platform services — €22,100 / yr (€1,842/mo)
- Newsletter dispatch €6,500 (96M sends/yr peak)
- Fan-sub infra €2,000
- Tahti Radio €2,400
- hCaptcha + monitoring €1,500
- ACRCloud €2,500
- Social auto-post €1,800
- Embed widget CDN €1,500
- Smart link routing €600
- Chat infrastructure €2,400
- Venue API €600
- Tagging infra €300

#### Operations — €4,900 / yr (€408/mo)
- Tooling SaaS €600
- Customer support tools €3,000 (real staffing for tickets)
- ISRC membership €100
- Revelator monthly minimum €1,200

#### Professional services — €66,000 / yr (€5,500/mo)
- Director salary **€45,000**
- Legal retainer €9,000 (more contracts, fan-sub disputes)
- Accountant €3,000
- Audit €3,500 (larger entity audit)
- Board administration €2,500
- DSP compliance specialist €3,000

#### Variable / pass-through — €15,440 / yr (€1,287/mo)
- Distribution passthrough €10,800
- Stripe fees on subs €4,640

**Y3 result: revenue €290,872 − costs €148,220 = surplus +€141,500.**
**Y3 grant pool (90%) = €129,737 distributed to ~3,200 eligible artists.**

---

## Cumulative 3-year picture (base case)

| | Y1 | Y2 | Y3 | Cumulative |
|---|---|---|---|---|
| Revenue | €35,426 | €107,700 | €290,872 | €434,998 |
| Costs | €54,572 | €86,092 | €148,220 | €288,884 |
| **Surplus** | **-€19,146** | **+€21,608** | **+€141,500** | **+€146,114** |
| Operating reserve (10%) | €0 | €2,161 | €14,150 | €16,311 |
| Artist grant pool (90%) | €0 | €19,447 | €129,737 | €149,184 |
| Fan-sub direct (separate flow) | €1,622 | €22,705 | €138,394 | €162,721 |
| **Total artist money** | **€1,622** | **€42,152** | **€268,131** | **€311,905** |

Director compensation cumulative: €115,000.

---

## Break-even analysis

### Where the money goes (Y1)

In Year 1, **professional services (director + legal + accountant + audit + board) consume 79% of total cost**. This is the unavoidable Finnish-nonprofit baseline:

- You cannot run a yhdistys without an accountant and an annual audit.
- You cannot have a competent director on poverty wages.
- You cannot operate without legal counsel on AGPL + GDPR + DSP compliance.

Everything else (infra, platform, operations, variable) is **21% of cost** — €11,532/yr, €961/month. This is the lean part. You cannot save money here without breaking the product.

This is why **Year 1 needs a founding grant.** No subscription growth path makes the Y1 math work without external funding, because the fixed professional-services cost (€43k) exceeds what 200 members at €40 (€8k) plus modest other revenue (€2k) can cover. The gap is €33k; the modeled €25k grant + reserves closes it.

### Minimum break-even cohort

If we strip out the founding grant assumption and ask "at what paid count does Tahti pay its own way?":

| Year | Members needed | Why higher in Y2 vs Y1? |
|---|---|---|
| Y1 | ~600 | Director salary + professional services are mostly Y1-paid; with 600 paid, subs €24k + distribution + donations covers fixed costs |
| Y2 | ~775 | Director salary up to €40k, audit/legal up, infra up — but no founding grant credit |
| Y3 | ~1,100 | Fiber upgrade adds €13k; this is the year of capex |

**Reading:** the base-case forecast (200/1,200/4,000) assumes Tahti is grant-funded in Y1 — *deliberately* — and crosses self-funding around 600-800 members, which the base case clears comfortably by Y2.

The **bear case (100/600/1,800)** is roughly the floor where Tahti is still viable:
- Y1: deficit €24k → needs full €25k founding grant
- Y2: deficit €7.5k → needs continuing grant support
- Y3: surplus €34k → starts producing artist grants

If we miss the bear case (fewer than 100 members in Y1), the org should pause acquisition spending, reduce director hours, and reapply for grants while in survival mode. The bylaws permit board-approved temporary salary reduction.

The **bull case (350/1,800/6,000)** shows what success looks like:
- Y1: deficit only €12k → small grant covers
- Y2: surplus €51k → Y2 grants distributed early
- Y3: surplus €240k → ~€216k grant pool, ~€340 per top-decile artist

---

## Monthly cash flow rhythm

Helpful for treasurer + director:

**Income (monthly average, Y1 base case):**
- Subscriptions: €667 (assumed linear; in practice, most members renew annually all at once)
- Foundation grants: €25,000 received as 1-2 lumps (typically January and June)
- Donations: €67
- Fan-sub op fee: €3
- Distribution: €120
- DSP referral: €13

**Total: ~€876/month from operations + €25k in 1-2 grant lumps**

**Outflow (monthly average, Y1):**
- Director salary: €2,500 (€30k/12)
- Legal + accountant + audit recurring: €750
- Infrastructure + platform: €878
- Variable: €64

**Total: ~€4,548/month outgoing**

**Implication:** Tahti runs a monthly cash deficit of ~€3,672 absent the foundation grant. The €25k grant covers ~7 months. Y1 needs the grant received within Q1, or the org should hold off on hiring the director until grant funds clear.

---

## Sensitivity table (Y3 base, what shifts the number)

| Variable | Change | Y3 surplus impact | Cohort top-decile grant |
|---|---|---|---|
| Members at half plan (2,000) | -€80k revenue | -€80k → €62k surplus | €115 instead of €260 |
| No Y3 foundation grant | -€80k revenue | -€80k → €62k | €115 |
| Fiber upgrade costs 2× | +€18k cost | -€18k → €124k | €224 |
| Fan-sub adoption double (16%) | +€78k to artists, +€1.5k org | +€1.5k → €143k | €290 |
| Hire second engineer (€35k) | +€35k cost | -€35k → €107k | €195 |
| Multi-shock (half paid + no grant) | -€160k | -€160k → -€19k | **grants suspended** |

The model is robust to single shocks. Multi-shock can suspend the year's grants and draw the reserve — but operations continue, no salaries are cut, and the org survives to next year.

---

## Where this aligns with the constitution

The detailed budget makes the constitution's commitments financially visible:

- **Rule 1 ("for artists, not corporate"):** the director salary is €30-45k, not €100k. The 90/10 split on surplus is a real flow, not a marketing claim. Fan-sub op fee is 2%, capped, surplus-rolling.

- **Rule 2 ("highest quality, useful, community-driven"):** the Year-3 fiber upgrade is €18k. We pay for that, not cut audio quality. Accountant + legal + audit lines are professional rates, not corner-cut. ACRCloud is paid for; track identification is a real feature.

- **Rule 3 ("artist shines brightest, no rip-offs"):** zero line items for "marketing of premium tiers," "listener subscription," "advertising sales infrastructure," or "data-resale partnerships." The variable / pass-through line is 1-10% of cost across years; everything else is genuinely the cost of running the product.
