import type { GoogleEvent } from './google.js'

const TZ = 'America/Argentina/Buenos_Aires'

export interface LocalEvent {
  id: string
  user_id: string | null
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  event_end_time: string | null
  reminder_minutes: number | null
  created_at: string
  updated_at: string
}

export function localToGoogle(e: LocalEvent): Partial<GoogleEvent> {
  const allDay = !e.event_time
  const start = allDay
    ? { date: e.event_date }
    : { dateTime: `${e.event_date}T${e.event_time!.slice(0, 8)}`, timeZone: TZ }
  // Prefer the explicit end_time if set; otherwise default to start + 1h.
  const endHHMMSS = e.event_end_time
    ? e.event_end_time.slice(0, 8)
    : addHour(e.event_time!.slice(0, 8))
  const end = allDay
    ? { date: addDay(e.event_date) }
    : {
        dateTime: `${e.event_date}T${endHHMMSS}`,
        timeZone: TZ,
      }
  const reminders =
    e.reminder_minutes != null
      ? {
          useDefault: false,
          overrides: [
            { method: 'popup' as const, minutes: e.reminder_minutes },
          ],
        }
      : { useDefault: false, overrides: [] }
  return {
    summary: e.title,
    description: e.description ?? undefined,
    start,
    end,
    reminders,
  }
}

export function googleToLocal(
  g: GoogleEvent,
  userId: string,
): Omit<LocalEvent, 'created_at' | 'updated_at'> & {
  updated_at?: string
} {
  const startDateTime = g.start?.dateTime
  const startDate = g.start?.date
  let event_date: string
  let event_time: string | null = null
  if (startDateTime) {
    const d = new Date(startDateTime)
    event_date = d.toISOString().slice(0, 10)
    event_time = startDateTime.slice(11, 19)
  } else if (startDate) {
    event_date = startDate
  } else {
    event_date = new Date().toISOString().slice(0, 10)
  }
  const endDateTime = g.end?.dateTime
  let event_end_time: string | null = null
  if (endDateTime && startDateTime) {
    event_end_time = endDateTime.slice(11, 19)
  }
  const override = g.reminders?.overrides?.[0]
  return {
    id: g.id,
    user_id: userId,
    title: g.summary ?? '(sin título)',
    description: g.description ?? null,
    event_date,
    event_time,
    event_end_time,
    reminder_minutes: override ? override.minutes : null,
    updated_at: g.updated,
  }
}

function addDay(d: string): string {
  const x = new Date(`${d}T00:00:00Z`)
  x.setUTCDate(x.getUTCDate() + 1)
  return x.toISOString().slice(0, 10)
}

function addHour(t: string): string {
  const [h, m, s] = t.split(':').map(Number)
  const total = (h + 1) * 3600 + m * 60 + (s ?? 0)
  const hh = Math.floor((total / 3600) % 24)
    .toString()
    .padStart(2, '0')
  const mm = Math.floor((total / 60) % 60)
    .toString()
    .padStart(2, '0')
  const ss = Math.floor(total % 60)
    .toString()
    .padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}
