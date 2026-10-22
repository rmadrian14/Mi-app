import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NutritionProfile, RegistroPeso } from "@/hooks/use-nutrition";
import type { PersonalProfile } from "@/hooks/use-training";
import { calcularObjetivos, type Sexo } from "@/lib/nutrition";
import { hoyISO, mediaMovil, ordenar, tendencia } from "@/lib/weight-trend";
import { armarDias, estimarGasto, type Confianza } from "@/lib/gasto-adaptativo";
import { useIngestasDiarias } from "@/hooks/use-gasto";
import { Aviso, Card, Field, SectionTitle, btnGhost, btnPrimary, btnSecondary, fmt, inputCls } from "./common";
import { useDialogos } from "./dialogs";

const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
// Un ajuste nunca mueve las calorías más que esto de golpe (kcal/día).
const AJUSTE_MAX = 200;
// Por debajo de este cambio no se propone nada: es ruido.
const AJUSTE_MIN = 50;

const CONFIANZA: Record<Confianza, { texto: string; clase: string }> = {
  ninguna: { texto: "Aún sin datos", clase: "bg-slate-800 text-slate-300" },
  baja: { texto: "Confianza baja", clase: "bg-amber-500/15 text-amber-300" },
  media: { texto: "Confianza media", clase: "bg-emerald-500/10 text-emerald-300" },
  alta: { texto: "Confianza alta", clase: "bg-emerald-500/20 text-emerald-200" },
};

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
  const { ingestas } = useIngestasDiarias();

  const ordenados = useMemo(() => ordenar(registros) as RegistroPeso[], [registros]);
  const serie = useMemo(() => mediaMovil(ordenados, 7), [ordenados]);
  const grafico = serie.slice(-84).map((p) => ({ ...p, etiqueta: fechaCorta(p.fecha) }));
  const t = useMemo(() => tendencia(ordenados), [ordenados]);
  const ultimo = ordenados[ordenados.length - 1];
  const media7 = serie[serie.length - 1]?.media;

  // Lo que dice la ecuación de Mifflin-St Jeor para ti (sin el mantenimiento indicado): de aquí parte la estimación.
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
      kcalMantenimiento: null,
    });
    return { prior: r.tdee, pesoRef };
  }, [personal, profile, ultimo]);

  // Gasto real: la ecuación corregida con tu peso y lo que apuntas en el diario.
  const estimacion = useMemo(() => {
    if (!gasto) return null;
    const dias = armarDias(ordenados.map((r) => ({ fecha: r.fecha, peso_kg: r.peso_kg })), ingestas, hoy);
    return estimarGasto({ prior: gasto.prior, dias, objetivo: profile.kcal_objetivo });
  }, [gasto, ordenados, ingestas, hoy, profile.kcal_objetivo]);

  // Calorías que saldrían con ese gasto y tu objetivo, sin moverse más de AJUSTE_MAX de golpe.
  const propuesta = useMemo(() => {
    if (!gasto || !estimacion || !personal?.sexo || !personal.edad || !personal.altura_cm) return null;
    const r = calcularObjetivos({
      sexo: personal.sexo as Sexo,
      edad: personal.edad,
      pesoKg: estimacion.pesoTendencia ?? gasto.pesoRef,
      alturaCm: personal.altura_cm,
      nivelActividad: profile.nivel_actividad,
      diasEntreno: profile.dias_entreno,
      objetivo: profile.objetivo,
      ritmo: profile.ritmo,
      kcalMantenimiento: estimacion.gasto,
    });
    const paso = Math.max(-AJUSTE_MAX, Math.min(AJUSTE_MAX, r.kcal - profile.kcal_objetivo));
    const kcalNueva = Math.round((profile.kcal_objetivo + paso) / 10) * 10;
    return { ideal: r.kcal, kcalNueva, delta: kcalNueva - profile.kcal_objetivo, avisos: r.advertencias };
  }, [gasto, estimacion, personal, profile]);

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
    if (!estimacion || !propuesta || estimacion.confianza === "ninguna" || Math.abs(propuesta.delta) < AJUSTE_MIN) return;
    const si = await confirmar({
      titulo: `¿Pasar a ${fmt(propuesta.kcalNueva)} kcal?`,
      descripcion: `${propuesta.delta > 0 ? "+" : ""}${fmt(propuesta.delta)} kcal al día; la diferencia se reparte en los hidratos (la proteína y la grasa se quedan igual). Tu mantenimiento pasará a ${fmt(estimacion.gasto)} kcal.`,
      etiquetaOk: "Aplicar",
    });
    if (!si) return;
    try {
      await onAplicar({ kcal_objetivo: propuesta.kcalNueva, kcal_mantenimiento: estimacion.gasto });
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

      {estimacion && gasto && (
        <Card>
          <SectionTitle>Tu gasto real</SectionTitle>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-bold text-white">{fmt(estimacion.gasto)}</span>
            <span className="text-sm text-slate-400">kcal al día para mantener tu peso</span>
            <span className={"rounded-full px-2.5 py-0.5 text-[11px] font-semibold " + CONFIANZA[estimacion.confianza].clase}>
              {CONFIANZA[estimacion.confianza].texto}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Entre {fmt(estimacion.intervalo[0])} y {fmt(estimacion.intervalo[1])} · la fórmula decía {fmt(gasto.prior)} · datos: {estimacion.diasConPeso}{" "}
            {estimacion.diasConPeso === 1 ? "pesada" : "pesadas"} y {estimacion.diasConIngesta} {estimacion.diasConIngesta === 1 ? "día" : "días"} de diario completos
          </p>

          {estimacion.confianza === "ninguna" ? (
            <div className="mt-3">
              <Aviso tono="gris">
                Todavía se usa la estimación por fórmula: hacen falta unas 2-3 semanas de pesadas y de diario para medir tu gasto de verdad. Pésate cada
                mañana en ayunas y apunta todo lo que comes cada día; los días a medias no cuentan.
              </Aviso>
            </div>
          ) : (
            propuesta && (
              <div className="mt-3 space-y-3">
                {estimacion.kgSemana != null && (
                  <p className="text-sm text-slate-300">
                    Con lo que has comido estas dos semanas, tu peso tiende a cambiar unos {estimacion.kgSemana > 0 ? "+" : ""}
                    {fmt(estimacion.kgSemana, 2)} kg por semana.
                  </p>
                )}
                {Math.abs(propuesta.delta) >= AJUSTE_MIN ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <p className="text-sm font-semibold text-emerald-200">
                      Sugerencia: {propuesta.delta > 0 ? "subir" : "bajar"} a {fmt(propuesta.kcalNueva)} kcal ({propuesta.delta > 0 ? "+" : ""}
                      {fmt(propuesta.delta)} kcal/día)
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Con tu gasto medido y tu objetivo, lo ideal serían {fmt(propuesta.ideal)} kcal. Los cambios son de {AJUSTE_MAX} kcal como máximo cada vez;
                      vuelve a mirarlo en una semana.
                    </p>
                    <button type="button" onClick={aplicar} className={btnPrimary + " mt-3"}>
                      Aplicar a mis objetivos
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-emerald-200">Tus {fmt(profile.kcal_objetivo)} kcal encajan con tu gasto real. No hace falta cambiar nada.</p>
                )}
                {propuesta.avisos.map((a) => (
                  <Aviso key={a}>{a}</Aviso>
                ))}
              </div>
            )
          )}
          <p className="mt-3 text-[11px] text-slate-600">
            Se calcula con tus pesadas y con lo que apuntas: lo que comes menos lo que tu peso dice que has guardado (~7.000 kcal por kg). Parte de la fórmula
            y se va ajustando a ti; el peso diario oscila por el agua, así que una pesada rara apenas cuenta. Va en las mismas unidades que tu diario: si
            apuntas algo menos de lo que comes, el gasto sale algo menor y las calorías objetivo siguen siendo las correctas para ti.
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
