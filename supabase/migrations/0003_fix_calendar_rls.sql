-- Remover las políticas antiguas
DROP POLICY IF EXISTS "Users can view their own events" ON calendar_events;
DROP POLICY IF EXISTS "Users can insert their own events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update their own events" ON calendar_events;
DROP POLICY IF EXISTS "Users can delete their own events" ON calendar_events;

-- Crear políticas más permisivas (permite usuarios anónimos)
CREATE POLICY "Allow all authenticated users to view events" ON calendar_events
  FOR SELECT USING (true);

CREATE POLICY "Allow all authenticated users to insert events" ON calendar_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to update events" ON calendar_events
  FOR UPDATE USING (true);

CREATE POLICY "Allow all authenticated users to delete events" ON calendar_events
  FOR DELETE USING (true);
