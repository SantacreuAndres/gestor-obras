import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CalendarEvent } from '../db/schema'
import { calendarApi } from '../db/api'
import { calendarStorage } from '../lib/calendarStorage'
import { triggerBackgroundSync } from '../lib/googleSync'

/**
 * Loads calendar events with:
 *  - Up to 3 retries on transient failures (covers token refresh races and
 *    flaky network on mobile) before falling back to localStorage.
 *  - Realtime refetch instead of mutating state with raw Postgres rows: the
 *    old code pushed snake_case payloads into state, which then broke any
 *    component reading eventDate/eventTime in camelCase.
 *  - Refetch when the tab regains focus (user reabre la app desde el switcher).
 *  - Proper subscription cleanup so listeners don't accumulate per mount.
 */
export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [usingLocalStorage, setUsingLocalStorage] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setError(null)
    let lastErr: Error | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await calendarApi.list()
        setEvents(data)
        setUsingLocalStorage(false)
        return
      } catch (e) {
        lastErr = e as Error
        // Brief backoff (200ms, 600ms) before the next attempt.
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1) * 2))
      }
    }
    // All retries failed — fall back to whatever is cached locally so the user
    // sees *something* instead of an empty calendar. Keep the error around so
    // the UI can surface it.
    console.warn('calendar load failed after retries, using localStorage:', lastErr)
    setUsingLocalStorage(true)
    setEvents(calendarStorage.getAll())
    setError(lastErr?.message ?? 'No pude cargar el calendario')
  }, [])

  useEffect(() => {
    let cancelled = false

    refetch()
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    // Subscribe to realtime changes — but instead of trying to apply the
    // Postgres-shaped payload by hand (which forced us to think about snake_case
    // vs camelCase), just refetch the list. It's a single round-trip per change
    // and avoids an entire class of bugs.
    const channel = supabase
      .channel('calendar_events_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        () => {
          if (!cancelled) void refetch()
        },
      )
      .subscribe()

    // Refetch when the page becomes visible again. iOS Safari suspends timers
    // and websockets while the tab is in the background, so realtime can miss
    // changes that happened during that time.
    function onVisibility() {
      if (document.visibilityState === 'visible' && !cancelled) {
        void refetch()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Fire a Google sync after the first successful load (best-effort).
    void triggerBackgroundSync()

    return () => {
      cancelled = true
      channel.unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refetch])

  return { events, loading, usingLocalStorage, error, refetch }
}
