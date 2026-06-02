#!/bin/bash

# Script para crear la tabla calendar_events en Supabase
# Uso: ./scripts/create-calendar-table.sh "SERVICE_ROLE_KEY"

if [ -z "$1" ]; then
  echo "❌ Necesitas proporcionar la SERVICE ROLE KEY"
  echo ""
  echo "Uso: ./scripts/create-calendar-table.sh \"tu-service-role-key-aqui\""
  echo ""
  echo "Para obtenerla:"
  echo "1. Ve a https://app.supabase.com"
  echo "2. Selecciona tu proyecto"
  echo "3. Settings → API"
  echo "4. Copia el 'service_role' secret"
  exit 1
fi

SERVICE_ROLE_KEY="$1"
SUPABASE_URL="https://rndozehswoppwsdlqeqm.supabase.co"

echo "🔄 Creando tabla calendar_events..."

curl -X POST "${SUPABASE_URL}/rest/v1/rpc" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  --data-raw '{
    "query": "CREATE TABLE IF NOT EXISTS calendar_events (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, event_date DATE NOT NULL, event_time TIME, reminder_minutes INTEGER, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())"
  }' 2>&1

echo ""
echo "✅ Si no hay errores, la tabla fue creada"
echo "Ahora recarga la app y prueba crear un evento"
