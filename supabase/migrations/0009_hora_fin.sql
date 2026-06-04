-- Optional end time for planner tasks and calendar events.
-- When NULL on a calendar event, the Google sync still falls back to start + 1h
-- (existing behaviour), so this migration is non-breaking.

ALTER TABLE public.planner_tareas
  ADD COLUMN IF NOT EXISTS hora_fin TIME;

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS event_end_time TIME;
