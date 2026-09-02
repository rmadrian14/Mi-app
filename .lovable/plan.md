## Objetivo

Que cualquier persona (con o sin login) pueda entrar a todas las secciones — sidebar visible siempre, sin redirección a `/auth`. Es un modo "abierto" temporal para probar mientras sigues construyendo.

## Cambios

### 1. `src/routes/_authenticated/route.tsx`
Quitar el guard: eliminar la comprobación `supabase.auth.getUser()` y el `redirect({ to: "/auth" })`. El layout se queda como un simple `<Outlet />` (mantiene `ssr: false` para no romper llamadas que asumen `window`). Con esto `/accounting`, `/projects`, `/organization`, `/portfolio`, etc. se abren sin sesión.

### 2. `src/routes/__root.tsx` → `AppShell`
Renderizar siempre el `SidebarProvider` + `AppSidebar` + `<Outlet />`, sin la rama `if (!user) return <Outlet />`. Así el sidebar aparece también para visitantes anónimos y pueden navegar a todos los apartados.

### 3. Nada más
- No tocar `useAuth`, `useSubscription`, `use-workspace`, ni los hooks de datos. Es probable que muchas páginas muestren estados vacíos (o errores por RLS) al no haber `user.id` — es esperado en modo abierto y lo resolvemos en un prompt posterior cuando decidas cómo tratar al visitante anónimo.
- No tocar el motor fiscal ni migraciones.
- No cambiar visibilidad de publicación ni políticas RLS.

## Aviso

Con RLS activo en Supabase, las páginas que consultan tablas (`invoices`, `variable_costs`, `projects`…) devolverán 0 filas o error para un usuario no autenticado. La UI cargará y será navegable, pero sin datos. Cuando quieras que también funcionen los datos sin login habría que abrir políticas o crear una sesión demo — dímelo cuando llegue el momento.

## Reversión

Cuando quieras volver a exigir login basta con restaurar el `beforeLoad` de `_authenticated/route.tsx` y la rama `if (!user)` en `__root.tsx`.
