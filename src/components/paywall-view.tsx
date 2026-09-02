import { Lock, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function PaywallView({ feature }: { feature?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center shadow-xl backdrop-blur">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 ring-1 ring-emerald-500/30">
          <Lock className="h-7 w-7 text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-white">Suscripción necesaria</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Necesitas un plan activo para acceder a
          {feature ? ` ${feature}` : " esta sección"}. Desde 5,99 €/mes.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-6 w-full bg-gradient-to-r from-emerald-500 to-indigo-500 text-white hover:opacity-90"
        >
          <Link to="/pricing">
            <Sparkles className="mr-2 h-4 w-4" />
            Ver planes y suscribirse
          </Link>
        </Button>
        <p className="mt-4 text-xs text-slate-500">
          El Simulador de Tarifas y el Radar Autónomo siguen disponibles gratis.
        </p>
      </div>
    </div>
  );
}