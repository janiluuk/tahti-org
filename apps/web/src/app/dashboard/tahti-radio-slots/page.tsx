// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { RadioSlotCalendar } from './_radio-slot-calendar'
import { listRadioSlotBookings } from './actions'

export default async function TahtiRadioSlotsPage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login?next=/dashboard/tahti-radio-slots')

  const now = new Date()
  const from = now.toISOString()
  const to = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString()
  const { bookings } = await listRadioSlotBookings(from, to)

  return (
    <div>
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Book a Tahti Radio slot</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Reserve up to 2 hours to play a live set on Tahti Radio. Hourly slots, first come first
            served — click an open hour to start.
          </p>
        </div>
      </div>
      <RadioSlotCalendar initialBookings={bookings} />
    </div>
  )
}
