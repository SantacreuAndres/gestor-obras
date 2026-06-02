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

        // Si no hay eventos, crear uno de ejemplo
        if (data.length === 0) {
          await createExampleEvent()
        }

        // Suscribirse a cambios en realtime
        subscribeToChanges()

        // Disparar sync con Google una vez al abrir el calendario (no bloquea)
        void triggerBackgroundSync()
      } catch (err) {
        // Si falla Supabase, usar localStorage
        console.warn('Using local storage for calendar:', err)
        setUsingLocalStorage(true)

        const localEvents = calendarStorage.getAll()
        setEvents(localEvents)

        if (localEvents.length === 0) {
          await createExampleEventLocally()
        }
      } finally {
        setLoading(false)
      }
    }

    loadEvents()
  }, [])

  const createExampleEvent = async () => {
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
      console.warn('Could not create example event in Supabase:', err)
      calendarStorage.add(exampleEvent)
      setEvents([exampleEvent])
    }
  }

  const createExampleEventLocally = () => {
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

    calendarStorage.add(exampleEvent)
    setEvents([exampleEvent])
  }

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
