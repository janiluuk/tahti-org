# Tahti ry — AGM playbook

Template for the annual general meeting (AGM). Adjust to match approved bylaws (*säännöt*).
Legal review required before first use.

## Timeline

| When | Action | Owner |
|------|--------|-------|
| T−30 days | Circulate draft agenda + prior minutes | Chair |
| T−14 days | Publish member motions (7-day rule per roadmap) | Board |
| T−7 days | Treasurer pack ready ([`TREASURER.md`](TREASURER.md) checklist) | Treasurer |
| T−7 days | Final agenda + attachments to members | Secretary |
| AGM day | Meeting + minutes | Chair / secretary |
| T+14 days | File minutes; execute grant run if approved | Board |

## Standard agenda

1. Opening — quorum, chair, secretary, vote counters
2. Minutes of previous AGM — approve / amend
3. Annual report — director (platform, community, incidents)
4. Financial statement — treasurer presentation
5. Audit / accounts — approve fiscal year
6. Grant formula & distribution — motion + vote (if surplus)
7. Board election — chair, treasurer, trustees
8. Director appointment & compensation policy (§10 cap reminder)
9. Membership fee for next year (default €40 — confirm)
10. Motions from members
11. Other business
12. Closing

## Grant distribution motion (template)

> **Motion:** That the board-approved engagement-unit formula be applied to calendar year **[YEAR]** surplus, and that the treasurer instruct the platform administrator to execute `POST /api/admin/grants/run/[YEAR]` after this meeting, publishing the transparency report within 30 days.

Record: votes for / against / abstain; exact wording in minutes.

## Board election motion (template)

> **Motion:** That **[names]** be elected to the board for the term **[dates]**, with **[name]** as chair and **[name]** as treasurer.

## Minutes template

```markdown
# Tahti ry — AGM minutes [DATE]

Place: [location / video link]
Present: [names, member numbers if applicable]
Quorum: [yes/no — per bylaws]

Chair: [name]   Secretary: [name]   Vote counters: [names]

## 1. Opening
...

## 4. Financial statement
Treasurer presented ledger summary for [YEAR]. [Approved unanimously / details of vote].

## 6. Grant distribution
Motion: [exact text]. Result: [passed/failed] ([votes]).

## 7. Board
Elected: [list].

Signed: ___________________  Chair
         ___________________  Secretary
```

Store signed PDF in association records (not in Git).

## After AGM

| Task | Owner | Deadline |
|------|-------|----------|
| Run grant calculation (if motion passed) | Treasurer + infra operator | 7 days |
| Update [`CREDENTIALS.md`](CREDENTIALS.md) vault with new board | Chair | 14 days |
| PRH / statutory filings if required | Treasurer | per law |
| Publish transparency rollup | Treasurer | 30 days |

## Related

- [`TREASURER.md`](TREASURER.md)
- [`docs/governance-and-legal.md`](../docs/governance-and-legal.md)
- Roadmap Phase 9 handover — [`docs/project-roadmap.md`](../docs/project-roadmap.md)
