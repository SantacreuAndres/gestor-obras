-- Adds a per-row "exportado_en" timestamp to viaticos and a new gastos table
-- with the same shape, so both UIs can offer "select + export PDF" and tint the
-- already-exported rows. NULL = never exported; a timestamptz = the last time
-- the row was included in an exported PDF.

ALTER TABLE public.viaticos
  ADD COLUMN IF NOT EXISTS exportado_en TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.gastos (
  id TEXT PRIMARY KEY,
  -- obras.id is TEXT in this project, FK matches.
  obra_id TEXT NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  concepto TEXT NOT NULL,
  monto NUMERIC NOT NULL DEFAULT 0,
  comprobante_path TEXT,
  exportado_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gastos_obra
  ON public.gastos (obra_id);

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

-- Single-user app: this owner can do everything on its own rows. obra_id ties
-- the row to an obra; obras themselves are already gated by their own RLS.
CREATE POLICY "gastos read"
  ON public.gastos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "gastos insert"
  ON public.gastos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "gastos update"
  ON public.gastos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "gastos delete"
  ON public.gastos FOR DELETE
  TO authenticated
  USING (true);

-- Stream INSERT/UPDATE/DELETE on gastos via Supabase Realtime, so the UI's
-- useLive hook keeps the list in sync without a manual refetch.
ALTER PUBLICATION supabase_realtime ADD TABLE public.gastos;
