# Estado del Proyecto — Gestor de Obras

**Última actualización:** 2026-06-21
**Repo:** https://github.com/SantacreuAndres/gestor-obras
**Branch:** main · **Último commit:** `e28d308`
**Deploy (Vercel):** https://gestor-obras-alpha.vercel.app

> Este archivo es el traspaso para continuar en una conversación nueva.
> Hay además memorias persistentes en
> `~/.claude/projects/-Users-andressantacreu-Downloads-gestor-obras/memory/`.

---

## Stack

- **Frontend:** React 19 + Vite + TypeScript, PWA (vite-plugin-pwa), HashRouter
- **Backend:** Supabase (Postgres + Realtime + Storage + Auth)
- **Deploy:** Vercel (+ funciones serverless en `api/` para el sync con Google)
- **Fechas:** dayjs · **Iconos:** lucide-react

---

## Accesos / credenciales (valores reales en `.env.local`, NO commitear)

- **Login de la app:** email `santacreu.andres@gmail.com` + contraseña (guardada en
  el llavero del usuario). Solo ese email puede entrar (whitelist en `src/lib/auth.tsx`).
- **Supabase project ref:** `rndozehswoppwsdlqeqm`
- **`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`** → en `.env.local` y en Vercel env.
- **`SUPABASE_SERVICE_ROLE_KEY`** (`sb_secret_…`) → en `.env.local`. Sirve para
  DATOS vía PostgREST (`https://rndozehswoppwsdlqeqm.supabase.co/rest/v1/...`).
- **`SUPABASE_ACCESS_TOKEN`** (PAT, `sbp_…`) → en `.env.local`. Sirve para **DDL**
  vía Management API (ver memoria `supabase-pat-location`). Después de un
  `CREATE TABLE` hay que hacer `NOTIFY pgrst, 'reload schema';` o la REST tarda.
- **Google OAuth** (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_BASE_URL`) →
  en Vercel env. OAuth consent en modo "Testing", el email del owner es test user.

### Quirks de schema (¡importante!)
- `obras.id` es **TEXT** (no UUID). FKs que lo referencian deben ser TEXT.
- `calendar_events.id` es UUID.
- `google_event_mapping` se creó de una versión vieja de la migración 0005:
  **NO tiene** `last_synced_local_updated_at` (el código usa `updated_at` como
  marcador) y `local_id` tiene FK con `ON DELETE CASCADE` (por eso los borrados
  desde la app van por `/api/google/delete-event` antes de borrar local).

---

## Funcionalidades implementadas

### Calendario ↔ Google ↔ Apple (sync bidireccional)
- Endpoints en `api/google/`: `auth`, `callback`, `status`, `disconnect`, `sync`,
  `delete-event`. Tablas `google_sync_state` y `google_event_mapping`.
- Conectar desde **Config → Conectar Google Calendar**. En el iPhone, para verlo
  en Apple Calendar: Ajustes → Calendario → Cuentas → Añadir cuenta → Google.
- Anti-duplicación: se ignoran eventos recurrentes en el pull, mapping con
  rollback de huérfanos, lock por usuario (`syncing_at`, migración 0006).
- **Pendiente opcional (#25):** convertir tareas repetidas en un único evento
  recurrente (RRULE) en vez de N eventos sueltos. Hoy "A3 Solsona" son 61 eventos
  (lun+jue, 9–13h, hasta 31/12/2026), creados y sincronizados OK.

### Notas con adjuntos (`src/pages/obra/Notas.tsx`)
- Fotos (cámara/galería) + audios grabados en la app (MediaRecorder). Bucket
  `notas` (privado). Tocar la foto la amplía (`src/components/PhotoViewer.tsx`).
- Botón Compartir → share sheet de iOS (WhatsApp, Claude, Mail…). Claude
  transcribe el audio del lado de él (no se usó Whisper).

### Planner semanal (`src/pages/Planner.tsx`, tabla `planner_tareas`)
- Vista vertical por día. Semáforo (🔴 pendiente → 🟠 progreso → 🟢 hecha): tap
  cicla, long-press abre menú. Hora inicio + **hora fin opcional** (si falta = 1h).
- Botón calendario por tarea: la vincula a `calendar_events` (y se sincroniza a
  Google/Apple). Swipe horizontal cambia de semana (con animación). Botón "Hoy"
  solo cuando no estás en la semana actual.

### Diseño (en `src/index.css`)
- **Color por sección** (fondo aurora saturado), seteado por `data-section` en
  `<html>` desde `Layout.tsx`: Obras=naranja, Planner=violeta, Calendario=verde,
  Contactos=celeste, Config=negro (sección oscura, variables de texto invertidas).
- Burbujas "liquid glass" (cards/kpi/tabbar translúcidos con backdrop-filter).
- Tipografía: system font (SF Pro en iOS). Zoom bloqueado en mobile.

---

## ⚠️ PROBLEMA ABIERTO (sin resolver) — franja blanca abajo del dock en iOS standalone

Síntoma: instalada como PWA (ícono en escritorio), aparece una **franja blanca
de ~70px debajo del tabbar**, en la zona del home indicator.

Diagnóstico (alta probabilidad): es el **`background_color` del manifest**
(`vite.config.ts` → `theme_color`/`background_color` = `#f5f5f5`). iOS lo muestra
en el área que el viewport del web no alcanza, y al ser blanco contrasta. Se
"hornea" al instalar el ícono.

Lo que se probó y NO alcanzó (en device real; el simulador NO reproduce el bug):
- `position: fixed; bottom: 0` en el tabbar.
- `bottom: -safe-bottom` extendiéndolo.
- Skirt `html::after` de respaldo.
- Tabbar como hijo flex con `100dvh` (el `100dvh` se queda ~130px corto en su iOS).
- `body { position: fixed; inset: 0 }` + `height:100%` (estado actual).
- Gradiente movido a `<html>` (en vez de color plano) como red de seguridad.

**Próximo paso sugerido (NO ejecutado):** cambiar `theme_color`/`background_color`
del manifest a un tono que matchee, y hacer que **todos los gradientes converjan
al MISMO color en el borde inferior** (ej. un neutro), así el manifest y el fondo
coinciden y la franja desaparece sea cual sea la altura real del viewport.
**Requiere re-instalar el ícono** (el manifest se captura al instalar).
Importante: NO confiar en el preview/simulador para validar esto — solo el device.

---

## Cómo deployar
```bash
npx vite build            # verificar que compila
git add -A && git commit -m "..."
git push origin main
vercel --prod --yes       # alias gestor-obras-alpha.vercel.app
```
Tras cambios, en el iPhone: cerrar la app del multitasking y reabrir desde el ícono.

## Migraciones (en `supabase/migrations/`)
0001–0004 calendar_events · 0005 google sync · 0006 lock · 0007 notas adjuntos ·
0008 planner_tareas · 0009 hora_fin. Aplicar DDL con el PAT (Management API).

## "Basura" en la DB que se puede limpiar (datos de prueba del owner)
Eventos/tareas de test: "Soda", "Casa Test", "Gallo 560", "Asado en lo de mate",
"Psicólogo", "Repasar proyectos a3", etc. Confirmar con el usuario antes de borrar.
