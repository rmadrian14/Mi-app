import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NutritionProfile, RegistroPeso } from "@/hooks/use-nutrition";
import type { PersonalProfile } from "@/hooks/use-training";
import { calcularObjetivos, type Sexo } from "@/lib/nutrition";
import { hoyISO, mediaMovil, ordenar, sugerirAjuste, tendencia } from "@/lib/weight-trend";
import { Aviso, Card, Field, SectionTitle, btnGhost, btnPrimary, btnSecondary, fmt, inputCls } from "./common";
import { useDialogos } from "./dialogs";

const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
const KCAL_MIN: Record<Sexo, number> = { mujer: 1200, hombre: 1500 };

export type AplicarAjuste = { kcal_objetivo: number; kcal_mantenimiento: number };

export function PesoView({
  registros,
  error,
  profile,
  personal,
  onRegistrar,
  onEliminar,
  onAplicar,
}: {
  registros: RegistroPeso[];
  error: string | null;
  profile: NutritionProfile;
  personal: PersonalProfile | null;
  onRegistrar: (fecha: string, kg: number) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
  onAplicar: (a: AplicarAjuste) => Promise<void>;
}) {
  const hoy = hoyISO();
  const [fecha, setFecha] = useState(hoy);
  const [peso, setPeso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [verTodo, setVerTodo] = useState(false);
  const { confirmar, dialogos } = useDialogos();

  const ordenados = useMemo(() => ordenar(registros) as RegistroPeso[], [registros]);
  const serie = useMemo(() => mediaMovil(ordenados, 7), [ordenados]);
  const grafico = serie.slice(-84).map((p) => ({ ...p, etiqueta: fechaCorta(p.fecha) }));
  const t = useMemo(() => tendencia(ordenados), [ordenados]);
  const ultimo = ordenados[ordenados.length - 1];
  const media7 = serie[serie.length - 1]?.media;

  // Gasto con el que se calcularon los objetivos (estimado, o el indicado).
  const gasto = useMemo(() => {
    if (!personal?.sexo || !personal.edad || !personal.altura_cm) return null;
    const pesoRef = ultimo?.peso_kg ?? personal.peso_kg;
    if (!pesoRef) return null;
    const r = calcularObjetivos({
      sexo: personal.sexo as Sexo,
      edad: personal.edad,
      pesoKg: pesoRef,
      alturaCm: personal.altura_cm,
      nivelActividad: profile.nivel_actividad,
      diasEntreno: profile.dias_entreno,
      objetivo: profile.objetivo,
      ritmo: profile.ritmo,
      kcalMantenimiento: profile.kcal_mantenimiento,
    });
    return { tdee: r.tdee, tmb: r.tmb, pesoRef, sexo: personal.sexo as Sexo };
  }, [personal, profile, ultimo]);

  const sugerencia = useMemo(() => {
    if (!gasto) return null;
    return sugerirAjuste({
      registros: ordenados,
      kcalObjetivo: profile.kcal_objetivo,
      gastoEstimado: gasto.tdee,
      kcalMinimas: Math.max(gasto.tmb, KCAL_MIN[gasto.sexo]),
      pesoKg: gasto.pesoRef,
    });
  }, [ordenados, gasto, profile.kcal_objetivo]);

  async function guardar() {
    const kg = parseFloat(peso.replace(",", "."));
    if (!(kg >= 20 && kg <= 400)) {
      toast.error("Introduce un peso entre 20 y 400 kg.");
      return;
    }
    if (!fecha || fecha > hoy) {
      toast.error("La fecha no puede ser futura.");
      return;
    }
    setGuardando(true);
    try {
      await onRegistrar(fecha, kg);
      toast.success("Peso registrado.");
      setPeso("");
    } catch (e) {
      toast.error((e as Error).message || "No se ha podido guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(r: RegistroPeso) {
    const si = await confirmar({
      titulo: "¿Borrar este registro?",
      descripcion: `${fechaCorta(r.fecha)} · ${fmt(r.peso_kg, 1)} kg`,
      etiquetaOk: "Borrar",
      destructivo: true,
    });
    if (!si) return;
    try {
      await onEliminar(r.id);
    } catch (e) {
      toast.error((e as Error).message || "No se ha podido borrar.");
    }
  }

  async function aplicar() {
    if (sugerencia?.estado !== "ajustar") return;
    const cambio = sugerencia.deltaKcal;
    const si = await confirmar({
      titulo: `¿Pasar a ${fmt(sugerencia.kcalNueva)} kcal?`,
      descripcion: `${cambio > 0 ? "+" : ""}${fmt(cambio)} kcal al día; la diferencia se reparte en los hidratos (la proteína y la grasa se quedan igual). Tu mantenimiento estimado pasará a ${fmt(sugerencia.mantenimientoReal)} kcal.`,
      etiquetaOk: "Aplicar",
    });
    if (!si) return;
    try {
      await onAplicar({ kcal_objetivo: sugerencia.kcalNueva, kcal_mantenimiento: sugerencia.mantenimientoReal });
      toast.success("Objetivos actualizados. Regenera el menú para que cuadre con las calorías nuevas.");
    } catch (e) {
      toast.error((e as Error).message || "No se ha podido aplicar.");
    }
  }

  if (error) {
    return (
      <Card>
        <Aviso>
          El registro de peso todavía no está preparado (falta aplicar la migración «nutrition_v2» en Supabase).
        </Aviso>
      </Card>
    );
  }

  const historial = verTodo ? [...ordenados].reverse() : [...ordenados].reverse().slice(0, 10);

  return (
    <div className="space-y-4">
      {dialogos}
      <Card>
        <SectionTitle>Registrar peso</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Peso (kg)">
            <input
              inputMode="decimal"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder={ultimo ? String(ultimo.peso_kg) : "75,0"}
              className={inputCls}
              onKeyDown={(e) => e.key === "Enter" && guardar()}
            />
          </Field>
        </div>
        <button type="button" onClick={guardar} disabled={guardando || !peso.trim()} className={btnPrimary + " mt-3 w-full"}>
          {guardando ? "Guardando…" : "Guardar peso"}
        </button>
        <p className="mt-2 text-[11px] text-slate-600">
          Pésate siempre en las mismas condiciones (por ejemplo, por la mañana en ayunas). Una sola medida por día; si
          registras otra el mismo día, sustituye a la anterior.
        </p>
      </Card>

      {ordenados.length > 0 && (
        <Card>
          <SectionTitle>Evolución</SectionTitle>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Último</p>
              <p className="mt-0.5 text-lg font-bold text-white">{fmt(ultimo.peso_kg, 1)}</p>
              <p className="text-[10px] text-slate-600">kg · {fechaCorta(ultimo.fecha)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Media 7 d</p>
              <p className="mt-0.5 text-lg font-bold text-white">{media7 != null ? fmt(media7, 1) : "—"}</p>
              <p className="text-[10px] text-slate-600">kg</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tendencia</p>
              <p className={"mt-0.5 text-lg font-bold " + (t.fiable ? "text-white" : "text-slate-500")}>
                {t.registros >= 2 ? `${t.kgSemana > 0 ? "+" : ""}${fmt(t.kgSemana, 2)}` : "—"}
              </p>
              <p className="text-[10px] text-slate-600">kg/semana{t.fiable ? "" : " (orientativa)"}</p>
            </div>
          </div>
          {grafico.length >= 2 && (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={grafico} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis
                    domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#94a3b8" }}
                    formatter={(v: number, nombre: string) => [`${fmt(v, 1)} kg`, nombre === "peso" ? "Peso" : "Media 7 d"]}
                  />
                  <Line type="monotone" dataKey="peso" stroke="#475569" strokeWidth={1} dot={{ r: 2, fill: "#475569" }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="media" stroke="#10b981" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-1 text-[11px] text-slate-600">Gris: cada pesada. Verde: media de los últimos 7 días.</p>
        </Card>
      )}

      {sugerencia && (
        <Card>
          <SectionTitle>¿Van bien tus calorías?</SectionTitle>
          {sugerencia.estado === "pocos_datos" && <Aviso tono="gris">{sugerencia.mensaje}</Aviso>}
          {sugerencia.estado === "en_linea" && (
            <div className="space-y-2">
              <p className="text-sm text-slate-200">{sugerencia.mensaje}</p>
              <p className="text-xs text-slate-500">
                Ritmo real {fmt(sugerencia.observado, 2)} kg/semana · previsto {fmt(sugerencia.previsto, 2)}. Tu
                mantenimiento real parece de unas {fmt(sugerencia.mantenimientoReal)} kcal (si has seguido el plan).
              </p>
            </div>
          )}
          {sugerencia.estado === "ajustar" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-200">{sugerencia.mensaje}</p>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-sm font-semibold text-emerald-200">
                  Sugerencia: {sugerencia.deltaKcal > 0 ? "subir" : "bajar"} a {fmt(sugerencia.kcalNueva)} kcal (
                  {sugerencia.deltaKcal > 0 ? "+" : ""}
                  {fmt(sugerencia.deltaKcal)} kcal/día)
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Tu mantenimiento real parece de unas {fmt(sugerencia.mantenimientoReal)} kcal si has seguido el
                  plan. El cambio es como máximo de 300 kcal cada vez; vuelve a valorar tras 2-3 semanas.
                </p>
              </div>
              {sugerencia.aviso && <Aviso>{sugerencia.aviso}</Aviso>}
              <div className="flex gap-2">
                <button type="button" onClick={aplicar} className={btnPrimary}>
                  Aplicar a mis objetivos
                </button>
              </div>
            </div>
          )}
          <p className="mt-3 text-[11px] text-slate-600">
            Se compara tu tendencia real con la prevista según tu plan (~7.700 kcal por kg). El peso diario oscila por
            el agua y la digestión, por eso solo se opina con varias semanas de datos y no por cambios pequeños. Si
            no has seguido el plan con regularidad, el cálculo no es fiable.
          </p>
        </Card>
      )}

      {ordenados.length > 0 && (
        <Card>
          <SectionTitle>Historial</SectionTitle>
          <div className="divide-y divide-slate-800/70">
            {historial.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-1.5">
                <span className="w-12 text-sm text-slate-400">{fechaCorta(r.fecha)}</span>
                <span className="flex-1 text-sm font-semibold text-white">{fmt(r.peso_kg, 1)} kg</span>
                <button type="button" onClick={() => quitar(r)} className={btnGhost + " hover:text-rose-400"} aria-label="Borrar registro">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          {ordenados.length > 10 && (
            <button type="button" onClick={() => setVerTodo((v) => !v)} className={btnSecondary + " mt-3 w-full"}>
              {verTodo ? "Ver menos" : `Ver los ${ordenados.length} registros`}
            </button>
          )}
        </Card>
      )}
    </div>
  );
}
