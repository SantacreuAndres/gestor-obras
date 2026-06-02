import { useState, useMemo } from 'react'
import dayjs from 'dayjs'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { calendarApi } from '../db/api'
import type { CalendarEvent } from '../db/schema'
import { CalendarSetup } from '../components/CalendarSetup'
import '../styles/calendar.css'

export function CalendarPage() {
  const { events } = useCalendarEvents()
  const [currentDate, setCurrentDate] = useState(dayjs())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventTime: '',
    reminderMinutes: 0,
  })

  const monthStart = currentDate.startOf('month')
  const daysInMonth = monthStart.daysInMonth()
  const firstDayOfWeek = monthStart.day()

  // Agrupar eventos por fecha
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    events.forEach((e) => {
      if (!map[e.eventDate]) map[e.eventDate] = []
      map[e.eventDate].push(e)
    })
    return map
  }, [events])

  const handlePrevMonth = () => setCurrentDate(currentDate.subtract(1, 'month'))
  const handleNextMonth = () => setCurrentDate(currentDate.add(1, 'month'))

  const handleDayClick = (day: number) => {
    const dateStr = currentDate.date(day).format('YYYY-MM-DD')
    setSelectedDate(dateStr)
    setShowForm(true)
    setEditingId(null)
    setFormData({ title: '', description: '', eventTime: '', reminderMinutes: 0 })
  }

  const handleAddEvent = async () => {
    if (!selectedDate || !formData.title.trim()) return

    try {
      const newEvent: CalendarEvent = {
        id: editingId || crypto.randomUUID(),
        userId: '', // Will be set by server
        title: formData.title,
        description: formData.description || undefined,
        eventDate: selectedDate,
        eventTime: formData.eventTime || undefined,
        reminderMinutes: formData.reminderMinutes || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await calendarApi.put(newEvent)

      // Si hay recordatorio y notificaciones están habilitadas, programar recordatorio
      if (formData.reminderMinutes && 'Notification' in window) {
        scheduleNotification(newEvent, formData.reminderMinutes)
      }

      setShowForm(false)
      setSelectedDate(null)
      setFormData({ title: '', description: '', eventTime: '', reminderMinutes: 0 })
    } catch (err) {
      console.error('Error saving event:', err)
      alert('Error al guardar el evento')
    }
  }

  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedDate(event.eventDate)
    setEditingId(event.id)
    setFormData({
      title: event.title,
      description: event.description || '',
      eventTime: event.eventTime || '',
      reminderMinutes: event.reminderMinutes || 0,
    })
    setShowForm(true)
  }

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm('¿Eliminar este evento?')) return
    try {
      await calendarApi.delete(id)
    } catch (err) {
      console.error('Error deleting event:', err)
      alert('Error al eliminar el evento')
    }
  }

  const handleRequestNotification = async () => {
    if (!('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones')
      return
    }

    if (Notification.permission === 'granted') {
      return
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        alert('Permiso de notificaciones denegado')
      }
    }
  }

  const daysArray: (number | null)[] = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthName = currentDate.format('MMMM YYYY')

  return (
    <div className="page">
      <CalendarSetup onReady={() => {}} />

      <div className="calendar-header">
        <h1>📅 Calendario</h1>
        <button onClick={handleRequestNotification} className="btn-secondary">
          Habilitar notificaciones
        </button>
      </div>

      <div className="calendar-container">
        {/* Navegador de meses */}
        <div className="month-nav">
          <button onClick={handlePrevMonth}>&lt;</button>
          <h2>{monthName}</h2>
          <button onClick={handleNextMonth}>&gt;</button>
        </div>

        {/* Calendario */}
        <div className="calendar-grid">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
            <div key={day} className="calendar-day-header">
              {day}
            </div>
          ))}

          {daysArray.map((day, idx) => {
            const dateStr = day && currentDate.date(day).format('YYYY-MM-DD')
            const dayEvents = dateStr ? (eventsByDate[dateStr] || []) : []

            return (
              <div
                key={idx}
                className={`calendar-day ${day ? 'active' : 'empty'}`}
                onClick={() => day && handleDayClick(day)}
              >
                {day && <span className="day-number">{day}</span>}
                <div className="day-events">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className="event-badge"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      {event.title.substring(0, 10)}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="event-more">+{dayEvents.length - 2}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Formulario de evento */}
      {showForm && selectedDate && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>
              {editingId ? 'Editar evento' : 'Nuevo evento'} - {selectedDate}
            </h2>

            <div className="form-group">
              <label>Título *</label>
              <input
                type="text"
                placeholder="Título del evento"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Descripción</label>
              <textarea
                placeholder="Detalles adicionales"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Hora</label>
                <input
                  type="time"
                  value={formData.eventTime}
                  onChange={(e) =>
                    setFormData({ ...formData, eventTime: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Recordatorio</label>
                <select
                  value={formData.reminderMinutes}
                  onChange={(e) =>
                    setFormData({ ...formData, reminderMinutes: parseInt(e.target.value) })
                  }
                >
                  <option value={0}>Sin recordatorio</option>
                  <option value={15}>15 min antes</option>
                  <option value={30}>30 min antes</option>
                  <option value={60}>1 hora antes</option>
                  <option value={1440}>1 día antes</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button
                onClick={handleAddEvent}
                className="btn-primary"
                disabled={!formData.title.trim()}
              >
                {editingId ? 'Actualizar' : 'Crear'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de eventos del día seleccionado */}
      {selectedDate && !showForm && (
        <div className="events-sidebar">
          <div className="sidebar-header">
            <h3>Eventos - {selectedDate}</h3>
            <button
              onClick={() => {
                setFormData({ title: '', description: '', eventTime: '', reminderMinutes: 0 })
                setEditingId(null)
                setShowForm(true)
              }}
              className="btn-primary small"
            >
              + Nuevo
            </button>
          </div>

          <div className="events-list">
            {(eventsByDate[selectedDate] || []).length === 0 ? (
              <p className="text-soft">Sin eventos en esta fecha</p>
            ) : (
              (eventsByDate[selectedDate] || []).map((event) => (
                <div key={event.id} className="event-card">
                  <div className="event-time">
                    {event.eventTime || 'Todo el día'}
                  </div>
                  <div className="event-title">{event.title}</div>
                  {event.description && (
                    <div className="event-description">{event.description}</div>
                  )}
                  {event.reminderMinutes && (
                    <div className="event-reminder">
                      🔔 {event.reminderMinutes} min antes
                    </div>
                  )}
                  <div className="event-actions">
                    <button
                      onClick={() => handleEditEvent(event)}
                      className="btn-secondary small"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="btn-danger small"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Función para programar notificaciones
function scheduleNotification(event: CalendarEvent, reminderMinutes: number) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const [year, month, day] = event.eventDate.split('-').map(Number)
  let eventDateTime = new Date(year, month - 1, day)

  if (event.eventTime) {
    const [hours, minutes] = event.eventTime.split(':').map(Number)
    eventDateTime.setHours(hours, minutes)
  }

  const reminderTime = new Date(eventDateTime.getTime() - reminderMinutes * 60000)
  const now = new Date()
  const timeUntilReminder = reminderTime.getTime() - now.getTime()

  if (timeUntilReminder > 0) {
    setTimeout(() => {
      new Notification(`Recordatorio: ${event.title}`, {
        body: event.description || event.eventDate,
        icon: '📅',
      })
    }, timeUntilReminder)
  }
}
