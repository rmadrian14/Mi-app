import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/planning")({
  component: PlanningPage,
  head: () => ({ meta: [{ title: "Planificación · Veract" }] }),
});

function PlanningPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 ring-1 ring-emerald-500/30">
          <CalendarClock className="h-7 w-7 text-emerald-400" />
        </div>
        <h1 className="text-xl font-semibold text-white">Planificación</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Este módulo está en construcción.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200"
        >
          ← Volver a inicio
        </Link>
      </div>
    </div>
  );
}
