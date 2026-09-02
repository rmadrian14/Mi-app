import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Users, Building2, Calculator } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  const { user, loading } = useAuth();
  const router = useRouter();
  async function signOut() {
    await supabase.auth.signOut();
    router.invalidate();
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white text-neutral-900 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-1 text-sm">
          {user && <SidebarTrigger className="mr-1" />}
          <Link
            to="/"
            className="mr-2 flex items-center gap-1.5 font-semibold tracking-tight"
          >
            <Calculator className="h-4 w-4" /> Estimac
          </Link>
          {user && (
            <>
              <Link
                to="/clients"
                className="rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
                activeProps={{ className: "active" }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Clientes
                </span>
              </Link>
              <Link
                to="/company"
                className="rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
                activeProps={{ className: "active" }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Emisor
                </span>
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Iniciar sesión</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}