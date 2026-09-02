import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
  head: () => ({
    meta: [
      { title: "Aceptar invitación · Veract" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "needs-auth" | "ready" | "accepting" | "done" | "error">("checking");
  const [message, setMessage] = useState<string>("");
  const [session, setSession] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const hasSession = !!data.session;
      setSession(hasSession);
      setStatus(hasSession ? "ready" : "needs-auth");
    });
  }, []);

  async function acceptInvite() {
    setStatus("accepting");
    try {
      const { data, error } = await (supabase as any).rpc("accept_workspace_invite", { _token: token });
      if (error) throw error;
      const wsId = data as string;
      try { localStorage.setItem("veract-active-workspace", wsId); } catch {}
      toast.success("Invitación aceptada");
      setStatus("done");
      setTimeout(() => navigate({ to: "/accounting" }), 700);
    } catch (e: any) {
      setMessage(e.message ?? "No se pudo aceptar la invitación.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-md pt-16">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-emerald-400" />
              Invitación a un NIF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === "checking" && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Comprobando invitación…
              </div>
            )}
            {status === "needs-auth" && (
              <>
                <p className="text-sm text-slate-300">
                  Necesitas iniciar sesión con el email invitado para aceptar.
                </p>
                <Button
                  asChild
                  className="w-full bg-emerald-500 hover:bg-emerald-600"
                >
                  <Link to="/auth" search={{ redirect: `/invite/${token}` } as any}>
                    Iniciar sesión
                  </Link>
                </Button>
              </>
            )}
            {status === "ready" && session && (
              <>
                <p className="text-sm text-slate-300">
                  Vas a unirte al NIF con el rol asignado por quien te invitó.
                </p>
                <Button
                  onClick={acceptInvite}
                  className="w-full bg-emerald-500 hover:bg-emerald-600"
                >
                  Aceptar invitación
                </Button>
                <p className="text-[11px] text-slate-500">
                  Si tu sesión no coincide con el email invitado, verás un aviso. Cambia de cuenta y vuelve a este enlace.
                </p>
              </>
            )}
            {status === "accepting" && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Aceptando…
              </div>
            )}
            {status === "done" && (
              <p className="text-sm text-emerald-400">Listo. Redirigiendo…</p>
            )}
            {status === "error" && (
              <>
                <p className="text-sm text-rose-400">{message}</p>
                <Button
                  variant="outline"
                  className="w-full border-slate-700"
                  onClick={() => navigate({ to: "/" })}
                >
                  Volver al inicio
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}