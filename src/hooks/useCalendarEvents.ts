import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CalendarEvent } from '../db/schema'
import { calendarApi } from '../db/api'
import { calendarStorage } from '../lib/calendarStorage'
import { triggerBackgroundSync } from '../lib/googleSync'

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [usingLocalStorage, setUsingLocalStorage] = useState(false)

  useEffect(() => {
    const loadEvents = async () => {
      try {
        // Intentar cargar desde Supabase
        const data = await calendarApi.list()
        setEvents(data)
        setUsingLocalStorage(false)

        // Suscribirse a cambios en realtime
        subscribeToChanges()

        // Disparar sync con Google una vez al abrir el calendario (no bloquea)
        void triggerBackgroundSync()
      } catch (err) {
        // Si falla Supabase, usar localStorage
        console.warn('Using local storage for calendar:', err)
        setUsingLocalStorage(true)
        setEvents(calendarStorage.getAll())
      } finally {
        setLoading(false)
      }
    }

    loadEvents()
  }, [])

  const subscribeToChanges = () => {
    const subscription = supabase
      .channel('calendar_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setEvents((prev) => [...prev, payload.new as CalendarEvent])
          } else if (payload.eventType === 'UPDATE') {
            setEvents((prev) =>
              prev.map((e) =>
                e.id === (payload.new as CalendarEvent).id
                  ? (payload.new as CalendarEvent)
                  : e,
              ),
            )
          } else if (payload.eventType === 'DELETE') {
            setEvents((prev) =>
              prev.filter((e) => e.id !== (payload.old as CalendarEvent).id),
            )
          }
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  return { events, loading, usingLocalStorage }
}
