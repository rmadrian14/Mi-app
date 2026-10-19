import { useEffect } from "react";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Todas las pantallas de esta carpeta exigen sesión. Sin ella se va a /auth
// recordando a dónde se quería ir (los datos ya estaban protegidos por RLS;
// esto evita ver pantallas vacías o errores raros al caducar la sesión).
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();

  // Si la sesión se cierra mientras la pantalla está abierta (cierre de sesión
  // en otra pestaña, token revocado), se vuelve al acceso.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") navigate({ to: "/auth", search: {} });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return <Outlet />;
}
