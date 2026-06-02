-- One row per user that has connected Google Calendar
CREATE TABLE IF NOT EXISTS public.google_sync_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  sync_token TEXT,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT
);

ALTER TABLE public.google_sync_state ENABLE ROW LEVEL SECURITY;

-- The frontend only needs to know IF the user is connected, not the tokens
CREATE POLICY "users can read own connection status"
  ON public.google_sync_state FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users can delete own connection"
  ON public.google_sync_state FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Maps local calendar_events.id to Google's event id.
-- No FK to calendar_events on purpose: when a local event is deleted, we still need
-- the google_event_id to delete it on Google's side during the next sync.
CREATE TABLE IF NOT EXISTS public.google_event_mapping (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  local_id UUID,
  google_etag TEXT,
  -- updated_at doubles as the "last synced" marker (set to the local row's
  -- updated_at after each push/pull) so push can detect real local changes.
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, google_event_id)
);

CREATE INDEX IF NOT EXISTS idx_google_event_mapping_local
  ON public.google_event_mapping(user_id, local_id);

ALTER TABLE public.google_event_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own mappings"
  ON public.google_event_mapping FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
