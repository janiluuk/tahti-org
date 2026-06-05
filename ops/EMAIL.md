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

Local dev uses Mailhog (`infra/docker-compose.stack.yml`). Production uses a real provider.

## Postmark (recommended for launch)

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
