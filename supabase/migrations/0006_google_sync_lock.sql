-- Server-side lock so only one sync runs at a time per user.
-- Prevents the concurrent-pull race that produced orphan events (local rows
-- without a Google mapping), which were then echoed back to Google as new
-- events on the next push, multiplying on every cycle.
ALTER TABLE public.google_sync_state
  ADD COLUMN IF NOT EXISTS syncing_at TIMESTAMPTZ;
