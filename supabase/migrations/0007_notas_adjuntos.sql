-- Adds attachments to notes (photos taken with the iPhone camera/gallery and
-- audio recordings made from the app). Stored as JSONB on the note row — no
-- separate table because the count per note is tiny (<5 typical) and querying
-- doesn't require joins.
ALTER TABLE public.notas
  ADD COLUMN IF NOT EXISTS adjuntos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Storage policies for the 'notas' bucket. The bucket itself was created via
-- the Storage API. Path convention: <auth.uid()>/<obra_id>/<random>.<ext>
-- (matches src/lib/storage.ts so RLS can authorize by the first path segment).

CREATE POLICY "notas read own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'notas' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "notas insert own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'notas' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "notas update own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'notas' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "notas delete own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'notas' AND auth.uid()::text = (storage.foldername(name))[1]);
