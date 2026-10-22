import { Link } from "@tanstack/react-router";
import { CalendarDays, Check, Dumbbell, Footprints, Scale, Utensils, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useHoy } from "@/hooks/use-hoy";
import { COLOR_UI } from "@/components/calendar/estilos";
import { CasillaTarea } from "@/components/calendar/chips";
import { horaDeAgenda, type EstadoEntreno, type ResumenHoy } from "@/lib/hoy";

const tarjeta = "group block rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-emerald-500/40 hover:bg-slate-900/80";
const miles = (n: number) => Math.round(n).toLocaleString("es-ES");

const ESTADO: Record<EstadoEntreno, { texto: string; clase: string }> = {
  hecho: { texto: "Hecho", clase: "bg-emerald-500/15 text-emerald-300" },
  extra_hecho: { texto: "Extra hecho", clase: "bg-emerald-500/15 text-emerald-300" },
  pendiente: { texto: "Pendiente", clase: "bg-amber-500/15 text-amber-300" },
  descanso: { texto: "Descanso", clase: "bg-slate-800 text-slate-300" },
  sin_rutina: { texto: "Sin rutina", clase: "bg-slate-800 text-slate-400" },
};

function Cabecera({ icono, titulo, derecha }: { icono: React.ReactNode; titulo: string; derecha?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {icono}
        {titulo}
      </span>
      {derecha}
    </div>
  );
}

function Barra({ valor, objetivo, alto = "h-2" }: { valor: number; objetivo: number; alto?: string }) {
  const pct = objetivo > 0 ? Math.min(100, (valor / objetivo) * 100) : 0;
  const pasado = objetivo > 0 && valor > objetivo * 1.05;
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-slate-800", alto)} role="progressbar" aria-valuemin={0} aria-valuemax={Math.round(objetivo)} aria-valuenow={Math.round(valor)}>
      <div className={cn("h-full rounded-full transition-all", pasado ? "bg-rose-500" : "bg-gradient-to-r from-emerald-400 to-indigo-400")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function HoyPanelVista({ resumen, fallos = [] }: { resumen: ResumenHoy; fallos?: string[] }) {
  const { entreno, comida, agenda, fecha } = resumen;
  const estado = ESTADO[entreno.estado];
  const filas = [
    ...agenda.eventos.map((o) => ({ o, tarea: false })),
    ...agenda.tareas.map((o) => ({ o, tarea: true })),
  ];
  const visibles = filas.slice(0, 5);
  return (
    <section aria-label="Hoy" className="mb-10">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">{resumen.saludo}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">{resumen.titulo}</h2>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Entrenamiento */}
        <Link to="/training" className={tarjeta}>
          <Cabecera icono={<Dumbbell className="h-4 w-4" />} titulo="Entrenamiento" derecha={<span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", estado.clase)}>{estado.texto}</span>} />
          {fallos.includes("entreno") ? (
            <p className="text-sm text-slate-500">No se ha podido leer tu rutina.</p>
          ) : (
            <>
              <p className="text-lg font-semibold text-white">{entreno.titulo}</p>
              <p className="mt-0.5 text-sm text-slate-400">{entreno.detalle}</p>
              {entreno.habitos.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {entreno.habitos.map((h) => (
                    <li key={h.tipo} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", h.hecho ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-slate-700 text-slate-300")}>
                      {h.tipo === "movilidad" ? <Waves className="h-3.5 w-3.5" /> : <Footprints className="h-3.5 w-3.5" />}
                      {h.tipo === "movilidad" ? "Movilidad" : "Caminata"}
                      {h.hecho && <Check className="h-3 w-3" strokeWidth={3} />}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Link>

        {/* Alimentación */}
        <Link to="/nutrition" className={tarjeta}>
          <Cabecera icono={<Utensils className="h-4 w-4" />} titulo="Alimentación" />
          {fallos.includes("comidas") || fallos.includes("perfil") ? (
            <p className="text-sm text-slate-500">No se han podido leer tus comidas.</p>
          ) : (
            <>
              {comida.conPerfil ? (
                <>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-lg font-semibold text-white">
                      {miles(comida.kcal.consumido)} <span className="text-sm font-normal text-slate-400">/ {miles(comida.kcal.objetivo)} kcal</span>
                    </span>
                    <span className="text-xs text-slate-500">{comida.porcentaje} %</span>
                  </div>
                  <Barra valor={comida.kcal.consumido} objetivo={comida.kcal.objetivo} />
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>Proteína</span>
                    <span>
                      {miles(comida.proteina.consumido)} / {miles(comida.proteina.objetivo)} g
                    </span>
                  </div>
                  <div className="mt-1">
                    <Barra valor={comida.proteina.consumido} objetivo={comida.proteina.objetivo} alto="h-1.5" />
                  </div>
                </>
              ) : null}
              <p className={cn("text-sm text-slate-300", comida.conPerfil && "mt-3")}>{comida.mensaje}</p>
              {comida.avisoPeso && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">
                  <Scale className="h-3.5 w-3.5" />
                  {comida.avisoPeso}
                </p>
              )}
            </>
          )}
        </Link>

        {/* Agenda */}
        <Link to="/organization" className={cn(tarjeta, "md:col-span-2")}>
          <Cabecera
            icono={<CalendarDays className="h-4 w-4" />}
            titulo="Agenda de hoy"
            derecha={agenda.atrasadas > 0 ? <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">{agenda.atrasadas === 1 ? "1 tarea atrasada" : `${agenda.atrasadas} tareas atrasadas`}</span> : null}
          />
          {fallos.includes("agenda") ? (
            <p className="text-sm text-slate-500">No se ha podido leer tu agenda.</p>
          ) : (
            <>
              {agenda.siguiente && (
                <p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                  <span className="font-semibold">Siguiente · {horaDeAgenda(agenda.siguiente, fecha)}</span> — {agenda.siguiente.titulo}
                </p>
              )}
              {visibles.length === 0 ? (
                <p className="text-sm text-slate-400">Nada en tu agenda para hoy.</p>
              ) : (
                <ul className="space-y-1.5">
                  {visibles.map(({ o, tarea }) => (
                    <li key={o.clave} className="flex items-center gap-3 text-sm">
                      <span className="flex w-4 shrink-0 justify-center">{tarea ? <CasillaTarea hecho={o.hecho} color={o.color} /> : <span className={cn("h-2.5 w-2.5 rounded-full", COLOR_UI[o.color].punto)} />}</span>
                      <span className="w-20 shrink-0 text-xs text-slate-500">{horaDeAgenda(o, fecha)}</span>
                      <span className={cn("truncate text-slate-200", tarea && o.hecho && "text-slate-500 line-through")}>{o.titulo}</span>
                    </li>
                  ))}
                </ul>
              )}
              {filas.length > visibles.length && <p className="mt-2 text-xs text-slate-500">y {filas.length - visibles.length} más…</p>}
            </>
          )}
        </Link>
      </div>
    </section>
  );
}

function Esqueleto() {
  return (
    <section aria-label="Hoy" className="mb-10 animate-pulse" aria-busy>
      <div className="mb-4 h-4 w-24 rounded bg-slate-800" />
      <div className="mb-4 h-7 w-56 rounded bg-slate-800" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="h-32 rounded-2xl bg-slate-900" />
        <div className="h-32 rounded-2xl bg-slate-900" />
        <div className="h-28 rounded-2xl bg-slate-900 md:col-span-2" />
      </div>
    </section>
  );
}

// El panel de la portada: solo con sesión iniciada.
export function HoyPanel() {
  const { user } = useAuth();
  const { resumen, fallos, cargando } = useHoy();
  if (!user) return null;
  if (cargando || !resumen) return <Esqueleto />;
  return <HoyPanelVista resumen={resumen} fallos={fallos} />;
}
