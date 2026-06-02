import type { CalendarEvent } from '../db/schema'

const STORAGE_KEY = 'calendar_events_local'

/**
 * Almacenamiento local para eventos de calendario
 * Se usa mientras la tabla en Supabase se crea
 */
export const calendarStorage = {
  getAll: (): CalendarEvent[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  },

  add: (event: CalendarEvent): void => {
    try {
      const events = calendarStorage.getAll()
      events.push(event)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
    } catch (err) {
      console.error('Error saving to local storage:', err)
    }
  },

  update: (event: CalendarEvent): void => {
    try {
      const events = calendarStorage.getAll()
      const index = events.findIndex((e) => e.id === event.id)
      if (index >= 0) {
        events[index] = event
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
      }
    } catch (err) {
      console.error('Error updating local storage:', err)
    }
  },

  delete: (id: string): void => {
    try {
      const events = calendarStorage.getAll()
      const filtered = events.filter((e) => e.id !== id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    } catch (err) {
      console.error('Error deleting from local storage:', err)
    }
  },

  clear: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (err) {
      console.error('Error clearing local storage:', err)
    }
  },
}
