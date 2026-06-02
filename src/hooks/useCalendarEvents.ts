import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CalendarEvent } from '../db/schema'
import { calendarApi } from '../db/api'

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const data = await calendarApi.list()
        setEvents(data)

        // Si no hay eventos, crear uno de ejemplo
        if (data.length === 0) {
          const today = new Date()
          const exampleEvent: CalendarEvent = {
            id: crypto.randomUUID(),
            userId: '',
            title: '📅 Mi primer evento',
            description: 'Este es un evento de ejemplo. Puedes editarlo o borrarlo.',
            eventDate: today.toISOString().split('T')[0],
            eventTime: '14:00',
            reminderMinutes: 30,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          try {
            await calendarApi.put(exampleEvent)
            setEvents([exampleEvent])
          } catch (err) {
            console.warn('Could not create example event:', err)
          }
        }
      } catch (err) {
        console.error('Error loading calendar events:', err)
      } finally {
        setLoading(false)
      }
    }

    loadEvents()

    // Subscribe to realtime changes
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
  }, [])

  return { events, loading }
}
