# Vendor & service contacts

**Association-owned accounts.** Keep credentials in the board vault; do not store
passwords in this file. Update after AGM or vendor change.

Last reviewed: _YYYY-MM-DD_ | Maintainer: _name / role_

## Critical path (SEV-1)

| Vendor | Service | Account / ID | Support contact | Portal | Notes |
|--------|---------|--------------|-----------------|--------|-------|
| _Fiber ISP_ | Business fiber | Contract # | Phone / ticket | | Symmetric gigabit, static IP |
| UpCloud | VPS / object DR | | support@upcloud.com | https://hub.upcloud.com | Helsinki region; DR bucket |
| Stripe | Payments | acct_… | https://support.stripe.com | https://dashboard.stripe.com | Platform + Connect |
| _Domain registrar_ | tahti.live DNS | | | | Low TTL during migrations |

## Platform integrations

| Vendor | Service | Account / ID | Support contact | Portal | DPA signed |
|--------|---------|--------------|-----------------|--------|:----------:|
| Mixcloud | OAuth / uploads | App ID | developers@mixcloud.com | https://www.mixcloud.com/developers/ | ☐ |
| Google | Drive import (OAuth + Picker) | Cloud Console project | | https://console.cloud.google.com/ | ☐ |
| Revelator | DSP distribution | | | | ☐ |
| Postmark / _email_ | SMTP / newsletters | Server ID | | | ☐ |
| AWS | SES (optional) | Account ID | | https://console.aws.amazon.com/ses/ | ☐ |
| hCaptcha | Bot protection | Site key | | https://www.hcaptcha.com/ | ☐ |
| AcoustID | Track metadata | API key in Swarm | | https://acoustid.org/ | N/A |

## Infrastructure & tooling

| Vendor | Service | Contact | Notes |
|--------|---------|---------|-------|
| GitHub | Source + Actions | org: _tahti-ry_ | Deploy keys, `REGISTRY_PASSWORD` |
| Self-hosted registry | `registry.tahti.live` | ops SSH | On manager node |
| Grafana / Prometheus | vimage6 monitoring | internal | [`monitoring/vimage6/README.md`](monitoring/vimage6/README.md) |

## Escalation

1. **Infra operator** — first response ([`INCIDENTS.md`](INCIDENTS.md))
2. **Director** — vendor comms approval, contract questions
3. **Board chair** — legal, DPA, or contract dispute

## DPA / GDPR checklist

- [ ] Stripe DPA accepted
- [ ] UpCloud DPA (before production DR data)
- [ ] Email provider DPA
- [ ] Mixcloud / Revelator terms reviewed for artist data subprocessors

See also [`docs/governance-and-legal.md`](../docs/governance-and-legal.md) and roadmap Phase 0.
