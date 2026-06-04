-- Weekly planner tasks. Decoupled from the calendar by default: a task only
-- becomes a calendar event when the user explicitly links it (calendar_event_id
-- non-null), at which point the Google sync picks it up automatically.

CREATE TABLE IF NOT EXISTS public.planner_tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  fecha DATE NOT NULL,
  hora TIME,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'progreso', 'hecha')),
  -- Link back to calendar_events when the user wires this task to the
  -- calendar. ON DELETE SET NULL so deleting the event doesn't kill the task.
  calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planner_tareas_user_fecha
  ON public.planner_tareas (user_id, fecha);

CREATE INDEX IF NOT EXISTS idx_planner_tareas_obra
  ON public.planner_tareas (obra_id) WHERE obra_id IS NOT NULL;

ALTER TABLE public.planner_tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner read own"
  ON public.planner_tareas FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "planner insert own"
  ON public.planner_tareas FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "planner update own"
  ON public.planner_tareas FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "planner delete own"
  ON public.planner_tareas FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
