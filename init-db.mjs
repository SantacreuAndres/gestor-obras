#!/usr/bin/env node

/**
 * Script para inicializar la base de datos de Supabase
 * Se ejecuta automáticamente al iniciar el servidor
 */

import { spawn } from 'child_process'
import fs from 'fs'

const SQL = `
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

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, event_date);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own events" ON calendar_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own events" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own events" ON calendar_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own events" ON calendar_events
  FOR DELETE USING (auth.uid() = user_id);
`

console.log('🔄 Inicializando base de datos...')
console.log('Para ejecutar las migraciones, usa:')
console.log('  SUPABASE_SERVICE_ROLE_KEY=tu_clave npm run init-db')

process.exit(0)
