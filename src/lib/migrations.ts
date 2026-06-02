import { supabase } from './supabase'

/**
 * Ejecuta migraciones necesarias en Supabase
 * Crea tablas si no existen
 */
export async function runMigrations() {
  try {
    // Verificar si la tabla calendar_events existe
    const { error: checkError } = await supabase
      .from('calendar_events')
      .select('id')
      .limit(1)

    // Si la tabla existe, no hacer nada
    if (!checkError || !checkError.message.includes('relation')) {
      return true
    }

    // La tabla no existe, intentar crear las políticas y tabla
    console.log('📋 Creando tabla calendar_events...')

    // Intentar crear una función helper en Supabase que ejecute el SQL
    // Esta es una solución workaround
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS calendar_events (
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

      CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date
        ON calendar_events(user_id, event_date);

      ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

      CREATE POLICY IF NOT EXISTS "Users can view their own events"
        ON calendar_events FOR SELECT USING (auth.uid() = user_id);

      CREATE POLICY IF NOT EXISTS "Users can insert their own events"
        ON calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);

      CREATE POLICY IF NOT EXISTS "Users can update their own events"
        ON calendar_events FOR UPDATE USING (auth.uid() = user_id);

      CREATE POLICY IF NOT EXISTS "Users can delete their own events"
        ON calendar_events FOR DELETE USING (auth.uid() = user_id);
    `

    // Intentar con RPC si la función existe
    const { error: rpcError } = await supabase.rpc('exec_sql', {
      sql: createTableSQL,
    })

    if (rpcError && rpcError.code === 'PGRST202') {
      // La función no existe, mostrar instrucciones
      console.warn(
        '⚠️  La tabla calendar_events no existe y no se puede crear automáticamente.'
      )
      console.warn('Por favor, ejecuta el siguiente SQL en Supabase Console:')
      console.warn(createTableSQL)
      return false
    }

    if (rpcError) {
      throw rpcError
    }

    console.log('✅ Tabla calendar_events creada exitosamente')
    return true
  } catch (err) {
    console.error('Error en migraciones:', err)
    return false
  }
}
