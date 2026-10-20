# Veract

Superapp personal con cuatro módulos: **Negocio** (contabilidad, proyectos y facturas),
**Entrenamiento**, **Planificación** (en construcción) y **Alimentación** (menús, macros y
seguimiento de peso).

React + TanStack Start (SSR) + Supabase (Postgres con RLS, Auth y Storage), desplegada como
Worker de Cloudflare.

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173
```

Crea un archivo `.env` en la raíz (no se sube a git) con:

| Variable | Para qué |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública (anon). Se incrusta en el build |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio. **Solo** para `npm run backup` y pruebas locales. Nunca en el código, en el chat ni en el repositorio |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npx tsc --noEmit` | Comprueba los tipos |
| `npm test` | Tests (vitest): cálculos de Alimentación y Entrenamiento, validaciones, paginación… |
| `npm run build` | Compila para producción |
| `npm run deploy` | Compila y despliega en Cloudflare (`wrangler deploy`) |
| `npm run backup` | Copia de todos los datos a `backups/*.json` (ignorada por git) |

La integración continua (`.github/workflows/ci.yml`) ejecuta tipos, tests y build en cada push
y avisa de vulnerabilidades de dependencias. No despliega.

## Base de datos

Las migraciones de `supabase/migrations/` **no se aplican solas**: se pegan en el SQL Editor de
Supabase, en orden de nombre. Cada archivo explica en su cabecera qué hace; los que borran datos
lo dicen y comprueban antes que no haya nada que perder.

- Todas las tablas tienen RLS por usuario (`auth.uid() = user_id`) o por espacio de trabajo.
- `src/integrations/supabase/types.ts` se mantiene **a mano**: al añadir columnas o tablas hay que
  actualizarlo.
- Las lecturas de historial completo deben usar `leerTodo()` (`src/lib/supabase-paging.ts`): la
  API de Supabase corta en silencio a 1.000 filas por consulta.

## Piezas a tener en cuenta

- **Tarea diaria** (`wrangler.jsonc` → `triggers`, `scheduled()` en `src/server.ts`): una consulta
  mínima a Supabase para que el proyecto gratuito no se pause por inactividad. Se registra al
  desplegar y deja su rastro en los registros del Worker (panel de Cloudflare).
- **Alimentación** usa funciones SQL (`crear_menu`, `reemplazar_dia`, `actualizar_gramos`) para que
  cada operación sobre un menú sea una sola transacción.
- Los cálculos puros están separados de los hooks para poder probarlos:
  `src/lib/nutrition*.ts`, `src/lib/weight-trend.ts`, `src/lib/training-calc.ts`.
- El registro de usuarios está abierto en Supabase salvo que se cierre en
  Authentication → Sign In / Providers.
