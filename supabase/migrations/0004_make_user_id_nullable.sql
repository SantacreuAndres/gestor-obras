-- Hacer user_id nullable para permitir eventos anónimos
ALTER TABLE calendar_events 
ALTER COLUMN user_id DROP NOT NULL;

-- Permitir inserts sin user_id
CREATE POLICY "Allow anonymous inserts" ON calendar_events
  FOR INSERT WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Permitir selects para todos
CREATE POLICY "Allow all selects" ON calendar_events
  FOR SELECT USING (true);

-- Permitir updates
CREATE POLICY "Allow all updates" ON calendar_events
  FOR UPDATE USING (true);

-- Permitir deletes
CREATE POLICY "Allow all deletes" ON calendar_events
  FOR DELETE USING (true);
