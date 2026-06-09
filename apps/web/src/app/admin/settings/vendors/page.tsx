// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// PLAT-059: vendor/DPA tracking page for directors.

import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const CRITICAL_VENDORS = [
  {
    name: 'Fiber ISP',
    service: 'Business fiber (symmetric gigabit, static IP)',
    notes: 'Contract number in board vault',
    portalUrl: null,
    dpaRequired: false,
  },
  {
    name: 'UpCloud',
    service: 'VPS / object storage DR (Helsinki region)',
    notes: 'DR bucket; DPA required before production data',
    portalUrl: 'https://hub.upcloud.com',
    dpaRequired: true,
  },
  {
    name: 'Stripe',
    service: 'Payments — Platform + Connect',
    notes: 'acct_… in board vault; DPA in Stripe Dashboard',
    portalUrl: 'https://dashboard.stripe.com',
    dpaRequired: true,
  },
  {
    name: 'Domain registrar',
    service: 'tahti.live DNS',
    notes: 'Low TTL during migrations',
    portalUrl: null,
    dpaRequired: false,
  },
] as const

const INTEGRATION_VENDORS = [
  {
    name: 'Mixcloud',
    service: 'OAuth / archive uploads',
    envVars: 'MIXCLOUD_CLIENT_ID, MIXCLOUD_CLIENT_SECRET',
    portalUrl: 'https://www.mixcloud.com/developers/',
    dpaRequired: true,
    dpaNote: 'Review terms for artist data subprocessor obligations',
  },
  {
    name: 'Revelator',
    service: 'DSP distribution (ISRC registration, royalty pull-back)',
    envVars: 'REVELATOR_API_KEY',
    portalUrl: 'https://revelator.com',
    dpaRequired: true,
    dpaNote: 'Review terms for artist data subprocessor obligations',
  },
  {
    name: 'Postmark / email provider',
    service: 'SMTP, newsletter dispatch, bounce webhook',
    envVars: 'SMTP_HOST, SMTP_USER, SMTP_PASS',
    portalUrl: null,
    dpaRequired: true,
    dpaNote: 'DPA accepted in provider dashboard',
  },
  {
    name: 'AWS SES',
    service: 'Optional high-volume newsletter broadcast transport',
    envVars: '(not yet configured)',
    portalUrl: 'https://console.aws.amazon.com/ses/',
    dpaRequired: true,
    dpaNote: 'Only relevant once SMTP limits are hit; configure in ops/EMAIL.md',
  },
  {
    name: 'hCaptcha',
    service: 'Bot protection on signup and login',
    envVars: 'HCAPTCHA_SECRET (api), NEXT_PUBLIC_HCAPTCHA_SITE_KEY (web)',
    portalUrl: 'https://www.hcaptcha.com/',
    dpaRequired: false,
    dpaNote: null,
  },
  {
    name: 'AcoustID',
    service: 'Track fingerprint / metadata lookup (ACRCloud fallback)',
    envVars: 'ACOUSTID_API_KEY',
    portalUrl: 'https://acoustid.org/',
    dpaRequired: false,
    dpaNote: null,
  },
] as const

const INFRA_VENDORS = [
  {
    name: 'GitHub',
    service: 'Source control + CI/CD (Actions)',
    notes: 'Org: tahti-ry; deploy keys + REGISTRY_PASSWORD in Swarm secrets',
    portalUrl: 'https://github.com/tahti-ry',
  },
  {
    name: 'Self-hosted registry',
    service: 'Docker image registry (registry.tahti.live)',
    notes: 'On Swarm manager node; ops SSH access',
    portalUrl: null,
  },
  {
    name: 'Grafana / Prometheus',
    service: 'Internal monitoring (grafana.tahti.live)',
    notes: 'Restricted to ops IPs; see monitoring/vimage6/README.md',
    portalUrl: null,
  },
] as const

const DPA_CHECKLIST = [
  { item: 'Stripe DPA accepted (Settings → Legal in Stripe Dashboard)', done: false },
  { item: 'UpCloud DPA accepted (before production DR data stored offsite)', done: false },
  { item: 'Email provider DPA accepted', done: false },
  { item: 'Mixcloud terms reviewed for artist data subprocessor obligations', done: false },
  { item: 'Revelator terms reviewed for artist data subprocessor obligations', done: false },
] as const

export default async function AdminVendorsPage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login')

  return (
    <>
      <h1 className="admin-section-title">Vendors &amp; DPA tracking</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '2rem' }}>
        Association-owned accounts. Credentials in the board vault — never in this file. See{' '}
        <Link href="/admin/governance" className="db-link">
          Governance
        </Link>{' '}
        for the full GDPR processing register and <code>ops/VENDORS.md</code> for contact details.
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 className="admin-subsection-title">GDPR / DPA checklist</h2>
        <div className="admin-card" style={{ padding: '1rem' }}>
          {DPA_CHECKLIST.map((c) => (
            <div
              key={c.item}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: c.done ? 'var(--green)' : 'var(--coral)',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {c.done ? '✓' : '✗'}
              </span>
              <span style={{ fontSize: '0.875rem' }}>{c.item}</span>
            </div>
          ))}
          <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.75rem' }}>
            Tick these off in <code>ops/VENDORS.md</code> and update this page after each DPA is
            accepted.
          </p>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 className="admin-subsection-title">Critical path (SEV-1)</h2>
        <div className="admin-panel-grid">
          {CRITICAL_VENDORS.map((v) => (
            <div key={v.name} className="admin-card" style={{ padding: '1rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{v.name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                {v.service}
              </div>
              <div style={{ fontSize: '0.8125rem', marginBottom: '0.5rem' }}>{v.notes}</div>
              <div
                style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}
              >
                {v.dpaRequired && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: 'rgba(255,120,50,0.15)',
                      color: 'var(--coral)',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    DPA required
                  </span>
                )}
                {v.portalUrl && (
                  <a
                    href={v.portalUrl}
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.8125rem', color: 'var(--accent)' }}
                  >
                    Portal ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 className="admin-subsection-title">Platform integrations</h2>
        <div className="admin-panel-grid">
          {INTEGRATION_VENDORS.map((v) => (
            <div key={v.name} className="admin-card" style={{ padding: '1rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{v.name}</div>
              <div
                style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '0.375rem' }}
              >
                {v.service}
              </div>
              <code
                style={{
                  fontSize: '0.75rem',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '2px 5px',
                  borderRadius: 4,
                  display: 'block',
                  marginBottom: '0.5rem',
                  wordBreak: 'break-all',
                }}
              >
                {v.envVars}
              </code>
              <div
                style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}
              >
                {v.dpaRequired && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: 'rgba(255,120,50,0.15)',
                      color: 'var(--coral)',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    DPA required
                  </span>
                )}
                {v.portalUrl && (
                  <a
                    href={v.portalUrl}
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.8125rem', color: 'var(--accent)' }}
                  >
                    Portal ↗
                  </a>
                )}
              </div>
              {v.dpaNote && (
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.375rem' }}>
                  {v.dpaNote}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="admin-subsection-title">Infrastructure &amp; tooling</h2>
        <div className="admin-panel-grid">
          {INFRA_VENDORS.map((v) => (
            <div key={v.name} className="admin-card" style={{ padding: '1rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{v.name}</div>
              <div
                style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '0.375rem' }}
              >
                {v.service}
              </div>
              <div style={{ fontSize: '0.8125rem' }}>{v.notes}</div>
              {v.portalUrl && (
                <a
                  href={v.portalUrl}
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--accent)',
                    display: 'block',
                    marginTop: '0.375rem',
                  }}
                >
                  Portal ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
