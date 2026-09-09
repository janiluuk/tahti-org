# Email delivery (auth + newsletters)

Tahti sends **transactional** mail (verify, password reset) from the API and
**newsletter** broadcasts from the worker (`newsletter-dispatch` job). Both use
Nodemailer with `SMTP_*` environment variables.

## Environment variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `SMTP_HOST` | api, worker-light | SMTP server hostname |
| `SMTP_PORT` | api, worker-light | Usually `587` (TLS) or `465` |
| `SMTP_USER` | api, worker-light | SMTP username (if required) |
| `SMTP_PASSWORD_FILE` | api, worker-light | Swarm secret mount |
| `SMTP_FROM` | api, worker-light | Default From header |
| `EMAIL_BOUNCE_WEBHOOK_SECRET` | api | Bounce webhook auth ([M13](#bounces)) |

Local dev uses Mailhog (`infra/docker-compose.stack.yml`). Production Swarm typically uses Postmark or SES (below).

## Lab stack on vimage (Mailgun EU direct)

The Docker stack on **vimage** (`192.168.2.100`, `deploy_prod.sh`) must **not** run its own MTA. `@tahti.live` outbound sends direct via **Mailgun EU** (`smtp.eu.mailgun.org:587`, verified domain `tahti.live`).

1. Copy `infra/stack.env.vimage.example` → `infra/stack.env` on vimage (`chmod 600`), set `SMTP_PASS` to the Mailgun **SMTP password** for `postmaster@tahti.live` (not the HTTP API key), quote `SMTP_FROM`.
2. Redeploy or recreate api/worker: `docker compose -f infra/docker-compose.stack.yml --env-file infra/stack.env up -d --force-recreate api worker`

| Variable | Value |
|----------|--------|
| `SMTP_HOST` | `smtp.eu.mailgun.org` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `postmaster@tahti.live` |
| `SMTP_FROM` | `"Tahti <noreply@tahti.live>"` |
| `APP_URL` | `https://app.tahti.live` (links in beta invite / verify mail) |

Beta applications always notify **`support@tahti.live`** (hardcoded). Mailhog remains the compose default when `stack.env` is absent (capture only).

### vimage6 relay split (Roundcube `webmail.tahti.live`)

docker-mailserver on **vimage6** (`~/infra/mail`, `vimage6-mailserver`) relays per-sender domain via `config/postfix-relaymap.cf` + `config/postfix-sasl-password.cf`:

| Sender | Relay |
|--------|-------|
| `@sparkki.fi`, `@giggi.fi` | Brevo `smtp-relay.brevo.com:587` (default `relayhost`) |
| `@tahti.live` | Mailgun EU `smtp.eu.mailgun.org:587` as `postmaster@tahti.live` |

After editing either file, rebuild the maps and restart:

```bash
ssh jani@vimage6.local 'cd ~/infra/mail && docker exec vimage6-mailserver postmap /tmp/docker-mailserver/postfix-sasl-password.cf && docker exec vimage6-mailserver postmap /tmp/docker-mailserver/postfix-relaymap.cf && docker restart vimage6-mailserver'
```

Roundcube (`webmail.tahti.live`) submits via the local mailserver, so no Roundcube config change is needed — the relay switch applies to all `@tahti.live` sends.

### Contact-inbox metrics (hello@ / support@)

Both addresses are aliases to `jani@tahti.live`, so Grafana and the Tahti
admin dashboard count them via `HEADER To` searches instead of a plain
unread counter:

- `ops/monitoring/vimage6/mail-metrics.sh` (cron every 5 min on vimage6)
  writes `mail_inbox_unseen/total{mailbox="hello@tahti.live"|"support@tahti.live"}`
- `ops/monitoring/vimage6/mail-exporter.py` serves the file on `:9275`
  (`monitoring-mail-exporter` container) for the `tahti_mail_metrics` job
- Grafana “Contact inbox (tahti.live)” row in `tahti-infrastructure`
- Tahti app: `GET /api/admin/stats/mail` (board-only, fail-open zeros) →
  “Unread mail” KPI on `/admin/dashboard`

Redeploy everything with `./ops/monitoring/vimage6/deploy.sh`.

### DKIM / SPF for @tahti.live via Mailgun

`@tahti.live` deliverability is now Mailgun's DNS: SPF include + DKIM (`mailo._domainkey`) + DMARC from the Mailgun dashboard. The vimage6 OpenDKIM `mail._domainkey.tahti.live` entry below is legacy (harmless pre-relay signature, only relevant if you switch back to direct vimage6 delivery).

### DKIM on vimage6 (sparkki.fi / giggi.fi direct)

docker-mailserver signs all `@tahti.live` senders (including `noreply@tahti.live`) via `*@tahti.live` in OpenDKIM `SigningTable`, selector **`mail`**, DNS record `mail._domainkey.tahti.live`.

Generate or refresh keys:

```bash
docker exec vimage6-mailserver setup config dkim domain tahti.live
```

If mail logs show `no signing table match` after adding a domain, sync persisted config into the running filter (or restart the container):

```bash
docker exec vimage6-mailserver bash -c '
  cp -a /tmp/docker-mailserver/opendkim/* /etc/opendkim/
  chown -R opendkim:opendkim /etc/opendkim
  chmod -R 0700 /etc/opendkim/keys/
  supervisorctl restart opendkim
'
```

Confirm in `/var/log/mail/mail.log`: `DKIM-Signature field added (s=mail, d=tahti.live)`.

## Postmark (recommended for Swarm launch)

1. Create a Postmark **Server** for transactional + broadcast (or split servers).
2. Verify domain `tahti.live` (DKIM + Return-Path).
3. Set Swarm secret: `echo -n "$TOKEN" | docker secret create smtp_password -`
4. In `stack.env` / stack deploy env:
   ```bash
   SMTP_HOST=smtp.postmarkapp.com
   SMTP_PORT=587
   SMTP_USER=<server-token>
   SMTP_FROM=Tahti <noreply@tahti.live>
   ```
5. Configure **bounce webhook** → `https://api.tahti.live/api/webhooks/email/bounce`
   - Custom header: `X-Tahti-Webhook-Secret: <EMAIL_BOUNCE_WEBHOOK_SECRET>`
   - Enable bounce + spam complaint notifications

## Amazon SES (optional, higher volume)

SES works via **SMTP interface** (no code change) or SNS bounces (already supported).

### SMTP mode

1. Verify domain in SES; move out of sandbox for production sends.
2. Create SMTP credentials in SES console.
3. Deploy:
   ```bash
   SMTP_HOST=email-smtp.eu-north-1.amazonaws.com
   SMTP_PORT=587
   SMTP_USER=AKIA…
   # smtp_password secret = SES SMTP password
   ```

### SNS bounce → Tahti webhook

1. Create SNS topic for bounces/complaints on the SES configuration set.
2. Subscribe HTTPS endpoint: `https://api.tahti.live/api/webhooks/email/bounce`
3. Set `EMAIL_BOUNCE_WEBHOOK_SECRET`; confirm subscription (API auto-confirms SNS).

Hard bounces and complaints **auto-unsubscribe** the address across all artists.

## Bounces

Endpoint: `POST /api/webhooks/email/bounce`

| Payload | Source |
|---------|--------|
| Postmark `RecordType: Bounce` / `SpamComplaint` | Postmark webhook |
| SNS `Notification` with `notificationType: Bounce` | AWS SES |
| `{ "email": "…", "type": "hard" }` | Manual / test |

Soft bounces are logged but do not unsubscribe.

## Newsletter limits

Per artist tier (see `/help/tier-limits`): weekly send caps enforced in
`POST /api/me/newsletter/send/:draftId`. Worker sends in batches of 50 with
`List-Unsubscribe` headers.

## Inbound `@tahti.live` on vimage6

Public contact addresses on the marketing site (`hello@tahti.live`) are **not** handled by the Tahti app — they land on **docker-mailserver** on **vimage6** (`192.168.2.105`, compose project `vimage6`, deploy tree `~/infra/mail` on that host). Stack source of truth: `sparkki/infra/mail` in the monorepo workspace.

| DNS | Value |
|-----|--------|
| `tahti.live` MX | `10` → A record `91.154.165.175` (home gateway; must reach vimage6 `:25`) |
| `mail.tahti.live` | Used for **SMTP submission** (`:587`, TLS cert); often proxied — prefer hostname over LAN IP for relay from vimage |
| SPF | `v=spf1 mx a:mail.tahti.live ~all` |
| DKIM | selector `mail`, domain `tahti.live` (OpenDKIM on vimage6) |

### Mailboxes and aliases

Manage on vimage6 (SSH via `vimage` → `jani@192.168.2.105`):

```bash
docker exec vimage6-mailserver setup email list
docker exec vimage6-mailserver setup alias list
```

| Address | Role |
|---------|------|
| `jani@tahti.live` | Primary mailbox (IMAP) |
| `hello@tahti.live` | Alias → `jani@tahti.live` (public contact) |
| `support@tahti.live` | Alias → `jani@tahti.live` |
| `hi@tahti.live` | Alias → `jani@tahti.live` |
| `noreply@tahti.live` | SMTP auth user for lab stack relay from vimage |

Add or refresh a public alias:

```bash
docker exec vimage6-mailserver setup alias add hello@tahti.live jani@tahti.live
```

Persisted lines live in `~/infra/mail/config/postfix-virtual.cf` on vimage6 (also mirrored in [`ops/mail/tahti-aliases.example`](mail/tahti-aliases.example)).

Beta application mail from the lab API uses **`support@tahti.live`** (hardcoded); ensure that alias exists.


## Related

- [`RUNBOOK.md`](RUNBOOK.md) — monitoring section
- [`secrets-management.md`](secrets-management.md) — `smtp_password` secret
- [`infra/stack.env.example`](../infra/stack.env.example) — `EMAIL_BOUNCE_WEBHOOK_SECRET`
