
-- Limpieza de los restos del sistema de pagos (Stripe), que ya se eliminó de la
-- aplicación. ¡BORRA TABLAS! Antes de ejecutarlo:
--   1. Haz una copia con `npm run backup`.
--   2. Revisa la lista de abajo.
--
-- Qué se borra:
--   - tabla public.subscriptions        (0 filas)  suscripciones de Stripe
--   - tabla public.pro_overage_blocks   (0 filas)  cobros extra de Stripe
--   - tabla public.user_subscriptions   (1 fila: tu plan "basic", límite 10; ya
--                                        nada lo usa ni lo consulta)
--   - función public.has_active_subscription(uuid, text)  (no la usa ninguna política)
--   - función public.provision_user_subscription_for_new_user() y su disparador
--     on_auth_user_created_provision_subscription  (creaba esa fila por cada usuario nuevo)
--
-- Qué se cambia antes de borrar: invoices.usuario_id apuntaba a user_subscriptions;
-- pasa a apuntar a auth.users (mismo comportamiento: se borran sus facturas si se
-- borra el usuario). `invoices` está vacía, así que no hay datos que migrar.
--
-- Si algo no es como se espera (filas en subscriptions o pro_overage_blocks, o
-- facturas de un usuario inexistente) el script se detiene y NO cambia nada.
-- Se puede ejecutar más de una vez.

BEGIN;

-- 0. Comprobaciones previas
DO $$
BEGIN
  -- Anidado a propósito: Postgres no garantiza que "A AND B" se corte en A, y
  -- consultar una tabla que ya no existe daría error al repetir el script.
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.subscriptions) THEN
      RAISE EXCEPTION 'subscriptions tiene filas: no se borra nada.';
    END IF;
  END IF;
  IF to_regclass('public.pro_overage_blocks') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.pro_overage_blocks) THEN
      RAISE EXCEPTION 'pro_overage_blocks tiene filas: no se borra nada.';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = i.usuario_id)
  ) THEN
    RAISE EXCEPTION 'Hay facturas cuyo usuario no existe en auth.users: no se borra nada.';
  END IF;
END $$;

-- 1. invoices.usuario_id pasa a apuntar a auth.users: primero la clave nueva...
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass AND conname = 'invoices_usuario_id_auth_users_fkey'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_usuario_id_auth_users_fkey
      FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ...y después se quita la antigua (la que apunta a user_subscriptions).
DO $$
DECLARE
  c record;
BEGIN
  IF to_regclass('public.user_subscriptions') IS NOT NULL THEN
    FOR c IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.invoices'::regclass
        AND contype = 'f'
        AND confrelid = 'public.user_subscriptions'::regclass
    LOOP
      EXECUTE format('ALTER TABLE public.invoices DROP CONSTRAINT %I', c.conname);
    END LOOP;
  END IF;
END $$;

-- 2. Disparador y funciones (el disparador primero: si no, los usuarios nuevos
-- fallarían al intentar insertar en una tabla que ya no existe).
DROP TRIGGER IF EXISTS on_auth_user_created_provision_subscription ON auth.users;
DROP FUNCTION IF EXISTS public.provision_user_subscription_for_new_user();
DROP FUNCTION IF EXISTS public.has_active_subscription(uuid, text);

-- 3. Tablas. Sin CASCADE a propósito: si algo más dependiera de ellas, esto falla
-- y deshace todo en lugar de borrarlo en silencio.
DROP TABLE IF EXISTS public.pro_overage_blocks;
DROP TABLE IF EXISTS public.subscriptions;
DROP TABLE IF EXISTS public.user_subscriptions;

COMMIT;

NOTIFY pgrst, 'reload schema';
