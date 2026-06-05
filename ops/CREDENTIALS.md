# Tahti credential inventory (template)

**Who has access to what.** Store live data in the board password manager — not in Git.
Copy this table to your vault and review quarterly + at AGM.

Last reviewed: _YYYY-MM-DD_ | Custodian: _board chair / director_

## Access matrix

| System | Access level | Named holders | MFA | Recovery |
|--------|--------------|---------------|:---:|----------|
| Swarm manager SSH | root deploy | | ☐ | |
| GitHub org `tahti-ry` | admin / maintain | | ☐ | break-glass account |
| `registry.tahti.live` | push images | CI + 1 operator | ☐ | |
| Stripe dashboard | admin | treasurer + director | ☐ | |
| UpCloud hub | admin | infra operator | ☐ | |
| Domain / DNS | admin | director | ☐ | |
| MinIO console | admin | infra operator | ☐ | |
| Grafana (vimage6) | admin | infra operator | ☐ | |
| Postmark / SMTP | admin | director | ☐ | |
| Mixcloud developer app | owner | director | ☐ | |
| Board password manager | org vault | board | ☐ | emergency kit |

## Docker Swarm secrets

See [`secrets-management.md`](secrets-management.md) for the full list. Record **who
created** and **last rotated** date in the vault, not secret values.

## Offboarding

When an operator leaves:

1. Remove SSH key from manager `authorized_keys`
2. Revoke GitHub org membership
3. Rotate shared secrets they could read (session, docs, SMTP if exposed)
4. Update this inventory within 7 days

## Related

- [`VENDORS.md`](VENDORS.md) — vendor account IDs
- [`ONBOARDING-OPERATOR.md`](ONBOARDING-OPERATOR.md) — training sign-off
