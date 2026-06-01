# Gestor de Obras — Handoff

Estado del proyecto al 2026-05-30. Leer esto primero al retomar el trabajo.

---

## Qué es

App personal para un arquitecto (un solo usuario, ningún rol múltiple) para
gestionar obras de construcción. Accesible desde iPhone y Mac. La entidad
central es la **Obra** — un expediente que contiene notas, deadlines,
documentos, materiales, fotos, plata, viáticos y fojas de medición. Lo único
global son los **Contactos** (gremios / proveedores / comitentes vinculados
N:N con obras).

Spec original: `~/Downloads/gestor-obras-spec.pdf` (7 páginas).

---

## Decisiones tomadas

| Decisión | Elección | Estado |
|---|---|---|
| Storage | **100% local con IndexedDB** | ⚠️ **Hay que cambiar a Supabase** — ver abajo |
| Stack frontend | React + Vite + TypeScript + PWA | ✓ implementado |
| Ubicación del repo | `~/Desktop/gestor-obras` | ✓ |
| Sync entre dispositivos | Export/import JSON manual | ⚠️ **Insuficiente**, ver abajo |

### El cambio pendiente: pasar a nube (Supabase)

La decisión inicial fue "100% local". En la primera prueba el dueño quiso
ver desde el celu una obra creada en la compu y no apareció. Después de
explicar por qué eso no podía funcionar con IndexedDB (ni con archivos en
Drive — el browser sandbox no puede leer archivos arbitrarios del
filesystem, y en iOS el filesystem está bloqueado para apps), **se decidió
migrar a Supabase**. La propia spec lo recomendaba en la sección 2 como
opción principal.

**El usuario va a crear la cuenta de Supabase y pasar las credenciales.**
Ver "Próximos pasos" abajo.

---

## Qué está construido (v1 MVP)

Bundle: ~400 KB (~123 KB gzip), TypeScript strict, build OK, dev server
arranca sin warnings.

### Features implementadas

- **Obras**: CRUD completo, filtros por etapa (anteproyecto / proyecto /
  permiso / ejecución / terminada), dashboard con KPIs de obras activas /
  deadlines próximos / viáticos a cobrar, lista de próximos deadlines
  arriba.
- **Datos** generales de obra: nombre, comitente, dirección, tipo,
  superficie, etapa, estado, fechas, notas. Editables por modal.
- **Notas** (por obra): timeline cronológica con timestamps automáticos,
  posibilidad de anclar (separa "Ancladas" / "Historial").
- **Deadlines** (por obra): título, fecha límite, descripción, estado
  pendiente/cumplido, badges visuales "en N días" / "N días vencido", se
  reflejan en el dashboard de la lista de obras.
- **Materiales** (por obra): nombre, unidad, precio unitario, proveedor
  vinculado a contacto, cantidades estimado / comprado / consumido.
  Derivados calculados: `restante = comprado − consumido` y
  `a pedir = estimado − comprado`. Toggle "Stock" / "Lista de pedido".
  La lista de pedido agrupa por proveedor, suma totales, incluye items
  marcados manualmente.
- **Viáticos** (por obra): fecha, concepto, monto, foto del comprobante
  (capture cámara en iPhone), estado pendiente/recuperado. KPIs de total
  puesto / a cobrar / cobrado.
- **Contactos** (global): nombre, rol, teléfono, email, notas. Búsqueda
  por texto, filtro por rol. Vinculación N:N con obras desde un modal.
- **Configuración**: export completo a JSON (incluye blobs en base64 para
  los adjuntos), import con elección "reemplazar todo" / "merge", borrar
  todo como zona peligrosa, KPIs de obras y adjuntos.

### Pestañas en placeholder (v2)

`Documentos`, `Fotos`, `Plata`, `Foja de medición`. Cada una muestra un
empty state describiendo qué va a contener.

### PWA

Instalable, manifest configurado, service worker (Workbox), meta tags
iOS (`apple-mobile-web-app-capable`, `status-bar-style=black-translucent`,
icon, theme color), respeto de safe-area-insets para notch / Dynamic
Island, tab bar inferior en mobile / sidebar en desktop, dark mode
automático por `prefers-color-scheme`.

### Modelo de datos

Definido completo para v1, v2 y v3 en `src/db/schema.ts` — cuando llegue
v2, las entidades ya existen, sólo hay que armar las pestañas. Cubre:
Obra, Nota, Deadline, Documento, Material, Foto, Contacto, ContactoObra
(tabla pivot N:N), MovimientoPlata, Viatico, FojaPeriodo, FojaItem, y
una tabla BlobFile para adjuntos.

---

## Estructura del repo

```
~/Desktop/gestor-obras/
├── HANDOFF.md              ← este archivo
├── package.json
├── package-lock.json
├── vite.config.ts          ← config con vite-plugin-pwa
├── index.html              ← meta tags iOS / PWA / theme
├── tsconfig.json + tsconfig.app.json + tsconfig.node.json
├── eslint.config.js
├── public/
│   └── favicon.svg         ← logo simple (casita naranja sobre fondo dark)
└── src/
    ├── main.tsx            ← bootstrap + HashRouter
    ├── App.tsx             ← Routes + sub-routes de obra
    ├── index.css           ← variables, dark mode, layout, components
    ├── db/
    │   ├── schema.ts       ← tipos TS de TODAS las entidades
    │   └── db.ts           ← Dexie database + helpers (deleteObraCompleta, saveBlob, getBlobUrl)
    ├── lib/
    │   ├── ids.ts          ← uid, nowIso, todayIso
    │   ├── format.ts       ← fmtMoney, fmtDate, diasHasta, labels
    │   └── backup.ts       ← exportAll, importAll, wipeAll, downloadBackup
    ├── components/
    │   ├── Layout.tsx      ← sidebar + tabbar responsive
    │   ├── Modal.tsx
    │   ├── EmptyState.tsx
    │   ├── BlobImage.tsx   ← img que carga blob desde IndexedDB
    │   └── ObraFormModal.tsx
    └── pages/
        ├── ObrasList.tsx   ← vista global con dashboard + grid
        ├── ObraDetail.tsx  ← shell de obra con tabs (provee ObraCtx)
        ├── Contactos.tsx
        ├── Configuracion.tsx
        └── obra/
            ├── Datos.tsx
            ├── Notas.tsx
            ├── Deadlines.tsx
            ├── Materiales.tsx
            ├── Viaticos.tsx
            ├── Documentos.tsx     ← v2 stub
            ├── Fotos.tsx          ← v2 stub
            ├── Plata.tsx          ← v2 stub
            └── Medicion.tsx       ← v2 stub
```

---

## Qué llevarse de esta compu

**Toda la carpeta `~/Desktop/gestor-obras/`** EXCEPTO:

- `node_modules/` — pesa mucho y se regenera con `npm install`
- `dist/` — output de build, se regenera con `npm run build`
- `.DS_Store` — basura de macOS

Con Finder: arrastrar la carpeta a un USB / Drive / lo que sea, ignorando
esas tres. O desde terminal:

```bash
cd ~/Desktop
tar --exclude='gestor-obras/node_modules' \
    --exclude='gestor-obras/dist' \
    --exclude='gestor-obras/.DS_Store' \
    -czvf gestor-obras.tar.gz gestor-obras/
```

(Genera `gestor-obras.tar.gz` mucho más liviano, listo para mover.)

En la otra compu, descomprimir y correr:

```bash
cd gestor-obras
npm install      # regenera node_modules
npm run dev      # levanta el dev server en http://localhost:5173
```

Requiere Node 18+ (probado con la versión actual instalada).

---

## Próximos pasos (migración a Supabase)

### Decisión tomada: Opción B — MCP oficial de Supabase

Se decidió que la próxima sesión arranque con el **MCP oficial de Supabase
conectado a Claude Code**, en vez del flujo manual de "yo te paso SQL y vos lo
pegás". Esto permite que el asistente:

- Ejecute SQL directamente contra el proyecto (crear tablas, RLS, policies)
- Lea logs y debuggee queries
- Maneje migraciones del schema cuando crezcamos a v2/v3
- Inspeccione la base mientras trabaja

Repo del MCP: https://github.com/supabase-community/supabase-mcp

### Tu parte antes de retomar (10 min) — hacer en este orden

#### 1. Crear cuenta y proyecto en Supabase (3 min)

1. https://supabase.com/dashboard/sign-up (login con Google es más rápido).
2. **New project**:
   - Name: `gestor-obras`
   - Database Password: generar uno fuerte, guardarlo en password manager
   - Region: `South America (São Paulo)`
   - Plan: Free
3. Esperar ~1 min a que provisione.
4. En **Project Settings → API** copiar para tener a mano:
   - **Project URL** (`https://xxxxxxx.supabase.co`)
   - **anon public** key (JWT que empieza con `eyJ...`)
   - **Project Reference ID** (el `xxxxxxx` del medio de la URL, sin el
     `.supabase.co`)

   La `anon` es pública por diseño. **Nunca** compartir la `service_role`
   key ni el password de la DB.

#### 2. Generar Personal Access Token (2 min)

El MCP de Supabase se autentica con un PAT, no con la anon key.

1. En el dashboard de Supabase, click en tu avatar (arriba a la derecha) →
   **Account preferences** → **Access Tokens**.
2. Click **Generate new token**.
3. Name: `claude-code-mcp`. Click **Generate**.
4. **COPIAR el token AHORA** — Supabase sólo te lo muestra una vez. Empieza
   con `sbp_...`. Guardalo en tu password manager.

#### 3. Instalar el MCP de Supabase en Claude Code (5 min)

En la máquina donde vas a retomar, con Claude Code instalado:

```bash
claude mcp add supabase \
  --scope user \
  -- npx -y @supabase/mcp-server-supabase@latest \
     --access-token=sbp_TU_TOKEN_ACA \
     --project-ref=TU_PROJECT_REF_ACA \
     --read-only=false
```

- `--scope user` lo guarda en tu config global (`~/.claude.json`), no en
  el repo. Así no se te sube el token a git por accidente.
- `--project-ref` limita el MCP a ese proyecto específico (recomendado;
  si no lo ponés, el MCP ve todos tus proyectos de Supabase).
- `--read-only=false` permite que ejecute SQL de escritura (lo necesitamos
  para crear las tablas la primera vez). Después de la migración inicial
  vamos a cambiarlo a `--read-only=true` para que no rompa nada por error.

Verificar que quedó configurado:

```bash
claude mcp list
```

Debería listar `supabase` como configurado.

Si no funciona el comando exacto, la doc oficial está en:
https://supabase.com/docs/guides/getting-started/mcp

### Cómo arrancar la próxima sesión

En la nueva máquina, dentro de `~/Desktop/gestor-obras/` (o donde lo hayas
puesto), abrir Claude Code y decirle al asistente:

> "Leé `HANDOFF.md` en la raíz del proyecto. Estoy retomando Gestor de
> Obras. Ya creé el proyecto en Supabase y configuré el MCP de Supabase
> conectado a este Claude Code. Empezamos la migración."

El asistente debería:
1. Leer este HANDOFF.
2. Verificar el MCP de Supabase activo (las tools `mcp__supabase__*` deberían
   estar disponibles).
3. Leer `src/db/schema.ts` para conocer el modelo.
4. Crear las tablas en Supabase usando el MCP (CREATE TABLE + RLS + policies).
5. Refactorizar el código:
   - Reemplazar Dexie por el cliente `@supabase/supabase-js`
   - Mantener UI y modelo de datos idénticos
   - `useLiveQuery` (Dexie) → hook custom con suscripciones realtime de Supabase
   - Auth: login por magic link
   - Storage: bucket `comprobantes` para fotos (reemplaza blobs en
     IndexedDB)
   - Mantener export/import JSON como backup extra
6. Probar el flujo de extremo a extremo: crear obra en compu, ver en celu.

---

## Comandos útiles

```bash
cd ~/Desktop/gestor-obras

npm install        # instalar deps (post-clone o post-pull)
npm run dev        # dev server con HMR en http://localhost:5173
npm run build      # build de producción a dist/
npm run preview    # servir dist/ localmente para probar
npm run lint       # eslint
```

## Cómo probar la app desde el iPhone (mientras siga siendo local)

1. Mac y iPhone en la **misma wifi**.
2. Levantar dev server: `npm run dev`. Va a mostrar varias URLs `Network:`
   con IPs locales (`192.168.x.x:5173`).
3. En Safari del iPhone, abrir la URL Network correcta (probar las que
   muestra; suele ser la `192.168.0.x` o `192.168.1.x` si estás en wifi de
   casa).
4. Para instalar como PWA: en Safari → botón Compartir → **Agregar a
   pantalla de inicio**. Queda como app con ícono propio.

Importante: **en modo local actual, los datos del iPhone son
independientes de los de la Mac**. Por eso vamos a migrar a Supabase.

---

## Dependencias clave

- `react@19` + `react-dom@19`
- `react-router-dom@7` (HashRouter; sub-routes anidadas en App.tsx con
  `<Outlet />` — ver nota de bug abajo)
- `dexie@4` + `dexie-react-hooks` (a reemplazar por Supabase)
- `zustand` (instalado pero no usado todavía — disponible si hace falta
  estado global no derivable de DB)
- `dayjs` (instalado, usado mínimamente)
- `lucide-react` (íconos)
- `vite-plugin-pwa` + `workbox-window`

---

## Notas / bugs resueltos

- **Bug de loop infinito en routing (resuelto)**: la primera versión tenía
  `<Routes>` anidadas dentro de `ObraDetail` con un catch-all `path="*"`
  que generaba un Navigate loop infinito al entrar a una obra. Se
  refactorizó al patrón idiomático de React Router 6: rutas hijas
  declaradas en `App.tsx` bajo el Route padre con `<Outlet />` en
  `ObraDetail`. Si en el futuro agregás más sub-pestañas, agregarlas como
  `<Route>` hijas en `App.tsx`, no como `<Routes>` interno.
- **Safe areas iOS**: el `.main-scroll` tiene `padding-top:
  calc(var(--safe-top) + 4px)` en mobile para que el contenido no quede
  pegado al notch / Dynamic Island. El tabbar inferior tiene
  `padding-bottom: var(--safe-bottom)` por la home indicator.
- **HashRouter (no BrowserRouter)**: elegido para que la app pueda servirse
  desde cualquier path sin configurar rewrites de servidor (también
  funciona si se abre directo desde `file://` en la Mac). Al migrar a un
  host con rewrites (Vercel / Netlify / Cloudflare Pages), se puede
  cambiar a `BrowserRouter` para URLs sin `#`.

---

## Pendientes claros para v2 (después de la migración)

- Pestaña **Documentos** (CRUD con upload a Storage, tipos plano /
  permiso municipal / contrato / certificado / factura, estado recibido
  / pendiente)
- Pestaña **Fotos** (galería de fotos de obra con fecha + descripción,
  upload con cámara)
- Pestaña **Plata** (presupuesto / costos / certificaciones / pagos /
  saldos; las certificaciones se alimentan de la Foja de medición)
- Pestaña **Foja de medición** (períodos + ítems por rubro con cantidad
  contratada / medido en período / acumulado / % de avance; el total del
  período se sincroniza como certificación en Plata)
- **Notificaciones push** (Web Push API en PWA instalada, fallback a
  alertas in-app — requiere VAPID keys, se configura en Supabase)
- **Búsqueda global** (Postgres full-text search)
- **Modo oscuro manual** (hoy es automático por sistema; agregar toggle
  manual en Configuración)
