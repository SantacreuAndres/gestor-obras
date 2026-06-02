import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function CalendarSetup({ onReady }: { onReady: () => void }) {
  const [isReady, setIsReady] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    checkTableExists()
  }, [])

  const checkTableExists = async () => {
    try {
      // Intentar acceder a la tabla
      const { error } = await supabase
        .from('calendar_events')
        .select('id')
        .limit(1)

      // Si no hay error, la tabla existe
      if (!error) {
        setIsReady(true)
        onReady()
        return
      }

      // Si el error es sobre la tabla no existente
      if (error.message?.includes('relation') || error.code === 'PGRST116') {
        setShowInstructions(true)
        return
      }

      // Otros errores son ok (ej: RLS)
      setIsReady(true)
      onReady()
    } catch (err) {
      console.error('Error checking table:', err)
      setIsReady(true)
      onReady()
    }
  }

  if (isReady && !showInstructions) {
    return null
  }

  if (showInstructions) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            color: '#1a1a1a',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>
            ⚙️ Configuración necesaria
          </h2>

          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            La tabla de calendario no existe en tu base de datos. Necesitas
            ejecutar una query SQL en Supabase.
          </p>

          <div
            style={{
              background: '#f5f5f5',
              padding: '1rem',
              borderRadius: '4px',
              marginBottom: '1.5rem',
              border: '1px solid #ddd',
            }}
          >
            <p style={{ fontSize: '0.9rem', marginTop: 0, marginBottom: '0.5rem' }}>
              <strong>SQL a ejecutar:</strong>
            </p>
            <pre
              style={{
                fontSize: '0.8rem',
                overflowX: 'auto',
                margin: 0,
                color: '#333',
              }}
            >
{`CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  reminder_minutes INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_user_date ON calendar_events(user_id, event_date);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own events" ON calendar_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own events" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events" ON calendar_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events" ON calendar_events
  FOR DELETE USING (auth.uid() = user_id);`}
            </pre>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
              📝 Pasos:
            </h3>
            <ol style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
              <li>Ve a https://app.supabase.com</li>
              <li>Selecciona tu proyecto</li>
              <li>
                Menú izquierdo → <strong>SQL Editor</strong>
              </li>
              <li>
                Botón azul <strong>"New query"</strong>
              </li>
              <li>
                Copia todo el SQL de arriba y pégalo en el editor
              </li>
              <li>
                Click en <strong>"Run"</strong> (botón azul)
              </li>
              <li>Recarga esta página</li>
            </ol>
          </div>

          <button
            onClick={() => {
              checkTableExists()
            }}
            style={{
              background: '#ff5722',
              color: 'white',
              border: 'none',
              padding: '0.875rem 1.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem',
              width: '100%',
            }}
          >
            ✅ Ya ejecuté el SQL, recargar
          </button>
        </div>
      </div>
    )
  }

  return null
}
