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

## Lab stack on vimage (relay via vimage6)

The Docker stack on **vimage** (`192.168.2.100`, `deploy_prod.sh`) must **not** run its own MTA. Outbound mail submits to **docker-mailserver on vimage6** via **`mail.tahti.live:587`** (use the hostname, not the LAN IP — TLS cert is for `mail.tahti.live`).

1. Ensure `noreply@tahti.live` exists on vimage6 (`docker exec vimage6-mailserver setup email add …`).
2. Copy `infra/stack.env.vimage.example` → `infra/stack.env` on vimage (`chmod 600`), set `SMTP_PASS`, quote `SMTP_FROM`.
3. Redeploy or recreate api/worker: `docker compose -f infra/docker-compose.stack.yml --env-file infra/stack.env up -d --force-recreate api worker`

| Variable | Value |
|----------|--------|
| `SMTP_HOST` | `mail.tahti.live` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `noreply@tahti.live` |
| `SMTP_FROM` | `"Tahti <noreply@tahti.live>"` |
| `APP_URL` | `https://app.tahti.live` (links in beta invite / verify mail) |

Beta applications always notify **`support@tahti.live`** (hardcoded). Mailhog remains the compose default when `stack.env` is absent (capture only).

### DKIM on vimage6 (lab relay)

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

## Related

- [`RUNBOOK.md`](RUNBOOK.md) — monitoring section
- [`secrets-management.md`](secrets-management.md) — `smtp_password` secret
- [`infra/stack.env.example`](../infra/stack.env.example) — `EMAIL_BOUNCE_WEBHOOK_SECRET`
