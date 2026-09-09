import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Dumbbell,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Footprints,
  Waves,
  Flame,
  Trophy,
  CalendarDays,
  LineChart as LineChartIcon,
  Star,
  TrendingUp,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  usePersonalProfile,
  useRoutine,
  useTodayEntry,
  useTrainingProgress,
  useExerciseProgress,
  useMuscleVolume,
  useDeloadCheck,
  useProgressionSuggestions,
  useExerciseDiscomfort,
  createExtraSession,
  todayISODate,
  toLocalISODate,
  normalizeMuscleGroup,
  muscleVolumeZone,
  MUSCLE_LANDMARKS,
  MUSCLE_ORDER,
  type PersonalProfile,
  type PersonalProfileInput,
  type RoutineDayWithDetails,
  type RoutineExerciseItem,
  type ExerciseRow,
  type SessionSetDraft,
  type DayStatus,
  type CalendarDayInfo,
  type SessionSummaryRow,
  type WeeklyLoadPoint,
  type ProgressPoint,
  type DeloadSignal,
  type ProgressionSuggestion,
  type DiscomfortEntry,
  type DiscomfortWatch,
  DISCOMFORT_ZONAS,
  discomfortSemaforo,
} from "@/hooks/use-training";

export const Route = createFileRoute("/_authenticated/training")({
  component: TrainingPage,
  head: () => ({ meta: [{ title: "Entrenamiento · Veract" }] }),
});

const DIAS_LABEL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function todayDiaSemana() {
  const jsDay = new Date().getDay(); // 0=domingo ... 6=sábado
  return (jsDay + 6) % 7; // 0=lunes ... 6=domingo
}

function TrainingPage() {
  const { profile, loading, createProfileAndSeedRoutine } = usePersonalProfile();
  const [view, setView] = useState<"hoy" | "rutina" | "calendario" | "progreso" | "resumen">("hoy");
  const progress = useTrainingProgress();
  const deload = useDeloadCheck();
  const discomfort = useExerciseDiscomfort();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Cargando…
      </div>
    );
  }

  if (!profile) {
    return <QuestionnaireForm onSubmit={createProfileAndSeedRoutine} />;
  }

  if (view === "rutina") {
    return <MiRutinaView onBack={() => setView("hoy")} />;
  }
  if (view === "calendario") {
    return <CalendarioView onBack={() => setView("hoy")} progress={progress} />;
  }
  if (view === "progreso") {
    return <ProgresoView onBack={() => setView("hoy")} progress={progress} deload={deload} />;
  }
  if (view === "resumen") {
    return (
      <ResumenSemanalView
        onBack={() => setView("hoy")}
        progress={progress}
        deload={deload}
        discomfort={discomfort}
      />
    );
  }
  return (
    <HoyView
      onOpenRutina={() => setView("rutina")}
      onOpenCalendario={() => setView("calendario")}
      onOpenProgreso={() => setView("progreso")}
      onOpenResumen={() => setView("resumen")}
      progress={progress}
      deload={deload}
      discomfort={discomfort}
    />
  );
}

/* ------------------------------ Cuestionario inicial ------------------------------ */

function QuestionnaireForm({
  onSubmit,
}: {
  onSubmit: (input: PersonalProfileInput) => Promise<PersonalProfile>;
}) {
  const [edad, setEdad] = useState("");
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [limitaciones, setLimitaciones] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        edad: edad ? parseInt(edad, 10) : null,
        peso_kg: peso ? parseFloat(peso) : null,
        altura_cm: altura ? parseFloat(altura) : null,
        objetivo: objetivo.trim() || null,
        limitaciones: limitaciones.trim() || null,
      });
    } catch (err) {
      setError((err as Error).message || "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-lg">
        <header className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 ring-1 ring-emerald-500/30">
            <Dumbbell className="h-7 w-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Antes de empezar</h1>
          <p className="mt-2 text-sm text-slate-400">
            Cuéntanos un poco sobre ti para preparar tu rutina inicial.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Edad">
              <input
                type="number"
                min={0}
                value={edad}
                onChange={(e) => setEdad(e.target.value)}
                placeholder="21"
                className={inputCls}
              />
            </Field>
            <Field label="Peso (kg)">
              <input
                type="number"
                min={0}
                step="0.1"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="89"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Altura (cm)">
            <input
              type="number"
              min={0}
              step="0.1"
              value={altura}
              onChange={(e) => setAltura(e.target.value)}
              placeholder="183"
              className={inputCls}
            />
          </Field>
          <Field label="Objetivo">
            <textarea
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              rows={2}
              placeholder='Ej. "Recomposición corporal"'
              className={inputCls}
            />
          </Field>
          <Field label="Limitaciones">
            <textarea
              value={limitaciones}
              onChange={(e) => setLimitaciones(e.target.value)}
              rows={2}
              placeholder='Ej. "Dolor de rodilla, evitar flexión profunda"'
              className={inputCls}
            />
          </Field>

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-indigo-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Preparando tu rutina…" : "Guardar y generar mi rutina"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

/* ------------------------------ Esfuerzo percibido (RPE/RIR) y duración ------------------------------ */

// Escala 0-10 basada en reps en reserva (RIR), adaptada de Zourdos et al.
// (2016): por encima de RPE 5 el ancla es literal en RIR (10=0RIR ... 7=3RIR),
// 5-6 se agrupan como 4-6 RIR (más allá de eso ya no es fiable distinguir el
// número exacto), y por debajo de 5 se usan descriptores de esfuerzo, no RIR.
const RPE_DESCRIPTIONS: Record<number, string> = {
  0: "Sin esfuerzo (calentamiento)",
  1: "Muy, muy ligero",
  2: "Muy ligero",
  3: "Ligero",
  4: "Moderado, cómodo",
  5: "Algo duro — 4-6 reps más",
  6: "Algo duro — 4-6 reps más",
  7: "Duro — unas 3 reps más",
  8: "Muy duro — 2 reps más",
  9: "Casi al límite — 1 rep más",
  10: "Al fallo — 0 reps más",
};

// Campos compartidos entre "Marcar como completado" (Hoy) y "Entrenamiento
// extra": esfuerzo percibido (RPE 0-10) + duración (minutos), con la carga
// de sesión (esfuerzo × duración) calculada en vivo. Ambos opcionales.
function EsfuerzoDuracionFields({
  esfuerzo,
  onEsfuerzoChange,
  duracion,
  onDuracionChange,
}: {
  esfuerzo: number | null;
  onEsfuerzoChange: (v: number | null) => void;
  duracion: string;
  onDuracionChange: (v: string) => void;
}) {
  const duracionNum = duracion.trim() ? parseInt(duracion, 10) : null;
  const carga = esfuerzo != null && duracionNum ? esfuerzo * duracionNum : null;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Esfuerzo percibido (0-10)
          </label>
          {esfuerzo != null && (
            <button
              type="button"
              onClick={() => onEsfuerzoChange(null)}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              Quitar
            </button>
          )}
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={esfuerzo ?? 5}
          onChange={(e) => onEsfuerzoChange(parseInt(e.target.value, 10))}
          className="w-full accent-emerald-500"
        />
        <p className="text-xs text-slate-400">
          {esfuerzo == null ? "Desliza para valorar (opcional)" : `${esfuerzo} · ${RPE_DESCRIPTIONS[esfuerzo]}`}
        </p>
      </div>
      <Field label="Duración (minutos)">
        <input
          type="number"
          min={1}
          placeholder="Ej. 52"
          value={duracion}
          onChange={(e) => onDuracionChange(e.target.value)}
          className={inputCls}
        />
      </Field>
      {carga != null && (
        <p className="text-xs text-slate-400">
          Carga de sesión: {esfuerzo} × {duracionNum} min ={" "}
          <span className="font-semibold text-emerald-400">{carga}</span>
        </p>
      )}
    </div>
  );
}

/* ------------------------------ Hoy ------------------------------ */

function parseLeadingNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

// Combina las series ya guardadas en BD con filas vacías de relleno hasta
// cubrir el objetivo de series_objetivo (para que se vean tantos huecos como
// series planeadas, aunque todavía no se hayan rellenado).
function buildInitialSets(
  day: RoutineDayWithDetails,
  existing: Record<string, SessionSetDraft[]>,
): Record<string, SessionSetDraft[]> {
  const initial: Record<string, SessionSetDraft[]> = {};
  for (const ex of day.ejercicios) {
    const saved = (existing[ex.exercise_id] ?? []).map((r) => ({ ...r }));
    const target = parseLeadingNumber(ex.series_objetivo) ?? 3;
    const minRows = Math.max(1, Math.round(target));
    while (saved.length < minRows) {
      const nextNum = saved.length ? Math.max(...saved.map((r) => r.numero_serie)) + 1 : 1;
      saved.push({ id: null, numero_serie: nextNum, reps_realizadas: null, peso_realizado_kg: null });
    }
    initial[ex.exercise_id] = saved.sort((a, b) => a.numero_serie - b.numero_serie);
  }
  return initial;
}

function DeloadBanner({
  signals,
  onOpenProgreso,
}: {
  signals: DeloadSignal[];
  onOpenProgreso: () => void;
}) {
  const active = signals.filter((s) => s.active);
  return (
    <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-lg leading-none">⚠️</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-300">Posible necesidad de descarga</p>
          <p className="mt-1 text-xs text-amber-200/80">
            Se han detectado {active.length} de {signals.length} señales de fatiga acumulada:
          </p>
          <ul className="mt-2 space-y-1">
            {active.map((s) => (
              <li key={s.id} className="text-xs text-amber-100/90">
                • {s.detail}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-semibold text-white">
            Recomendación: esta semana, reduce el número de series aproximadamente a la mitad y no superes el 70%
            de tu peso habitual.
          </p>
          <button
            type="button"
            onClick={onOpenProgreso}
            className="mt-2 text-[11px] font-semibold text-amber-300 underline decoration-dotted hover:text-amber-200"
          >
            Ver detalle en Progreso
          </button>
        </div>
      </div>
    </div>
  );
}

function HoyView({
  onOpenRutina,
  onOpenCalendario,
  onOpenProgreso,
  onOpenResumen,
  progress,
  deload,
  discomfort,
}: {
  onOpenRutina: () => void;
  onOpenCalendario: () => void;
  onOpenProgreso: () => void;
  onOpenResumen: () => void;
  progress: ReturnType<typeof useTrainingProgress>;
  deload: ReturnType<typeof useDeloadCheck>;
  discomfort: ReturnType<typeof useExerciseDiscomfort>;
}) {
  const { user } = useAuth();
  const routine = useRoutine();
  const today = routine.days.find((d) => d.dia_semana === todayDiaSemana()) ?? null;
  const entry = useTodayEntry(today?.id ?? null);
  const progression = useProgressionSuggestions();
  const [draftSets, setDraftSets] = useState<Record<string, SessionSetDraft[]>>({});
  const [completing, setCompleting] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [wrapUpEsfuerzo, setWrapUpEsfuerzo] = useState<number | null>(null);
  const [wrapUpDuracion, setWrapUpDuracion] = useState("");

  useEffect(() => {
    if (!today || entry.loading) return;
    setDraftSets(buildInitialSets(today, entry.setsByExercise));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today?.id, entry.loading]);

  // Cada serie se guarda al salir del campo (no se espera al botón de
  // "completado"): si la fila tiene datos se guarda/actualiza, si se ha
  // dejado vacía y antes tenía datos guardados, se borra.
  async function handleSaveRow(exerciseId: string, row: SessionSetDraft) {
    try {
      if (row.reps_realizadas == null && row.peso_realizado_kg == null) {
        await entry.removeSet(exerciseId, row);
        return;
      }
      const saved = await entry.saveSet(exerciseId, row);
      // Propaga el id real devuelto por saveSet de vuelta a draftSets: si no
      // se hace, la fila se queda con id null para siempre y cada blur
      // posterior (p.ej. el del otro campo de la misma serie) vuelve a
      // insertar en vez de actualizar, duplicando la serie en session_sets.
      setDraftSets((prev) => {
        const rows = prev[exerciseId] ?? [];
        const idx = rows.findIndex((r) => r.numero_serie === row.numero_serie);
        if (idx < 0) return prev;
        return { ...prev, [exerciseId]: rows.map((r, i) => (i === idx ? { ...r, id: saved.id } : r)) };
      });
    } catch (err) {
      toast.error((err as Error).message || "No se pudo guardar la serie.");
    }
  }

  async function handleRemoveRow(exerciseId: string, row: SessionSetDraft) {
    try {
      await entry.removeSet(exerciseId, row);
    } catch (err) {
      toast.error((err as Error).message || "No se pudo quitar la serie.");
    }
  }

  // La sesión de hoy puede no existir todavía (no se ha guardado ninguna
  // serie): se crea aquí si hace falta, igual que hace saveSet internamente.
  async function handleSaveDiscomfort(
    exerciseId: string,
    patch: { zona_cuerpo: string; intensidad: number; nota: string | null },
  ) {
    try {
      const sid = await entry.ensureSession();
      await discomfort.save(sid, exerciseId, patch);
    } catch (err) {
      toast.error((err as Error).message || "No se pudo guardar la molestia.");
    }
  }

  async function handleRemoveDiscomfort(exerciseId: string) {
    if (!entry.sessionId) return;
    try {
      await discomfort.remove(entry.sessionId, exerciseId);
    } catch (err) {
      toast.error((err as Error).message || "No se pudo quitar la molestia.");
    }
  }

  function openWrapUp() {
    setWrapUpEsfuerzo(entry.esfuerzoPercibido);
    setWrapUpDuracion(entry.duracionMin != null ? String(entry.duracionMin) : "");
    setShowWrapUp(true);
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      const duracion_min = wrapUpDuracion.trim() ? parseInt(wrapUpDuracion, 10) : null;
      await entry.markCompleted({ esfuerzo_percibido: wrapUpEsfuerzo, duracion_min });
      toast.success("Entrenamiento de hoy marcado como completado.");
      setShowWrapUp(false);
    } catch (err) {
      toast.error((err as Error).message || "No se pudo marcar como completado.");
    } finally {
      setCompleting(false);
    }
  }

  const loading = routine.loading || entry.loading;
  const fechaLabel = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen w-full bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 ring-1 ring-emerald-500/30">
              <Dumbbell className="h-5 w-5 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {loading ? "Hoy" : today?.es_dia_entreno ? `Hoy: ${today.nombre_dia}` : "Hoy: Descanso"}
            </h1>
            <p className="mt-1 text-sm capitalize text-slate-400">{fechaLabel}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex gap-2">
              <button
                onClick={onOpenResumen}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 transition hover:border-emerald-500 hover:text-white"
                aria-label="Ver resumen semanal"
                title="Resumen semanal"
              >
                <ClipboardList className="h-4 w-4" />
              </button>
              <button
                onClick={onOpenProgreso}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 transition hover:border-emerald-500 hover:text-white"
                aria-label="Ver progreso y récords"
                title="Progreso"
              >
                <LineChartIcon className="h-4 w-4" />
              </button>
              <button
                onClick={onOpenCalendario}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 transition hover:border-emerald-500 hover:text-white"
                aria-label="Ver calendario"
                title="Calendario"
              >
                <CalendarDays className="h-4 w-4" />
              </button>
              <button
                onClick={onOpenRutina}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-emerald-500 hover:text-white"
              >
                Mi Rutina
              </button>
            </div>
            {!progress.loading && (
              <button
                onClick={onOpenCalendario}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300"
              >
                <Flame className="h-3.5 w-3.5" /> {progress.currentStreak} {progress.currentStreak === 1 ? "día" : "días"}
              </button>
            )}
          </div>
        </header>

        {!deload.loading && deload.shouldDeload && (
          <DeloadBanner signals={deload.signals} onOpenProgreso={onOpenProgreso} />
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : (
          <>
            {today?.es_dia_entreno ? (
              <div className="space-y-3">
                {today.ejercicios.map((ex) => (
                  <ExerciseSetsCard
                    key={ex.id}
                    exercise={ex}
                    sets={draftSets[ex.exercise_id] ?? []}
                    suggestion={
                      progression.loading ? null : progression.suggest(ex.exercise_id, ex.reps_objetivo)
                    }
                    discomfortEntry={
                      entry.sessionId ? discomfort.getEntry(entry.sessionId, ex.exercise_id) : null
                    }
                    discomfortWatch={
                      discomfort.watchList.find((w) => w.exerciseId === ex.exercise_id) ?? null
                    }
                    onChange={(sets) => setDraftSets((prev) => ({ ...prev, [ex.exercise_id]: sets }))}
                    onSaveRow={(row) => handleSaveRow(ex.exercise_id, row)}
                    onRemoveRow={(row) => handleRemoveRow(ex.exercise_id, row)}
                    onSaveDiscomfort={(patch) => handleSaveDiscomfort(ex.exercise_id, patch)}
                    onRemoveDiscomfort={() => handleRemoveDiscomfort(ex.exercise_id)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-300">
                Hoy toca descanso. Aprovecha para la movilidad y la caminata de abajo.
              </div>
            )}

            {today && <HabitChecklist day={today} entry={entry} />}

            {today?.es_dia_entreno && (
              <>
                {showWrapUp ? (
                  <div className="mt-4 space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                    <p className="text-sm font-semibold text-white">¿Cómo ha ido el entrenamiento?</p>
                    <EsfuerzoDuracionFields
                      esfuerzo={wrapUpEsfuerzo}
                      onEsfuerzoChange={setWrapUpEsfuerzo}
                      duracion={wrapUpDuracion}
                      onDuracionChange={setWrapUpDuracion}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowWrapUp(false)}
                        className="rounded-lg border border-slate-800 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleComplete}
                        disabled={completing}
                        className="rounded-lg bg-gradient-to-r from-emerald-500 to-indigo-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-60"
                      >
                        {completing ? "Guardando…" : "Guardar y marcar completado"}
                      </button>
                    </div>
                  </div>
                ) : entry.completado ? (
                  <button
                    onClick={openWrapUp}
                    className="mt-4 flex w-full items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200 transition hover:border-emerald-500/50"
                  >
                    <span>
                      Entrenamiento completado ✓
                      {entry.esfuerzoPercibido != null && ` · RPE ${entry.esfuerzoPercibido}`}
                      {entry.duracionMin != null && ` · ${entry.duracionMin} min`}
                      {entry.esfuerzoPercibido != null && entry.duracionMin != null &&
                        ` · carga ${entry.esfuerzoPercibido * entry.duracionMin}`}
                    </span>
                    <Pencil className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ) : (
                  <button
                    onClick={openWrapUp}
                    className="mt-4 w-full rounded-lg bg-gradient-to-r from-emerald-500 to-indigo-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90"
                  >
                    Marcar entrenamiento como completado
                  </button>
                )}
              </>
            )}

            {!showExtra ? (
              <button
                onClick={() => setShowExtra(true)}
                className="mt-3 w-full rounded-lg border border-slate-800 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-emerald-500 hover:text-white"
              >
                + Añadir entrenamiento no planificado
              </button>
            ) : (
              user && (
                <ExtraWorkoutForm
                  exercises={routine.exercises}
                  onCreateExercise={routine.createExercise}
                  onSubmit={async (fecha, sets, esfuerzoDuracion) => {
                    await createExtraSession(user.id, fecha, sets, esfuerzoDuracion);
                    toast.success("Entrenamiento extra guardado.");
                    setShowExtra(false);
                    if (fecha === todayISODate()) entry.refresh();
                  }}
                  onCancel={() => setShowExtra(false)}
                />
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

function setDotClass(s: SessionSetDraft, targetReps: number | null, targetPeso: number | null) {
  if (s.reps_realizadas == null && s.peso_realizado_kg == null) {
    return { dot: "bg-slate-700", title: "Sin registrar" };
  }
  const repsOk = targetReps == null || (s.reps_realizadas != null && s.reps_realizadas >= targetReps);
  const pesoOk = targetPeso == null || (s.peso_realizado_kg != null && s.peso_realizado_kg >= targetPeso);
  if (repsOk && pesoOk) return { dot: "bg-emerald-500", title: "Objetivo cumplido o superado" };
  return { dot: "bg-amber-500", title: "Por debajo del objetivo" };
}

function ProgressionSuggestionBadge({ suggestion }: { suggestion: ProgressionSuggestion | null }) {
  if (!suggestion) return null;

  const sube = suggestion.kind === "sube_fallo_reps" || suggestion.kind === "sube_fallo_e1rm" || suggestion.kind === "sube_rango";

  let title: string;
  let body: string;
  switch (suggestion.kind) {
    case "sube_fallo_e1rm":
      title = `Prueba con ${suggestion.suggestedWeightKg} kg (antes ${suggestion.currentWeightKg} kg)`;
      body = `e1RM +${Math.round(suggestion.changePct * 100)}% desde el ${formatShortDate(suggestion.previousFecha)}, con el mismo esfuerzo percibido o mayor.`;
      break;
    case "sube_fallo_reps":
      title = `Prueba con ${suggestion.suggestedWeightKg} kg (antes ${suggestion.currentWeightKg} kg)`;
      body = `La última vez llegaste a ${suggestion.lastReps} reps al fallo — el peso se ha quedado ligero para trabajar cerca del fallo real.`;
      break;
    case "sube_rango":
      title = `Prueba con ${suggestion.suggestedWeightKg} kg y vuelve a ${suggestion.repMax} reps`;
      body = `Llegaste a ${suggestion.repMax} reps en todas las series con ${suggestion.currentWeightKg} kg.`;
      break;
    case "mantener_fallo":
      title = `Mantén ${suggestion.currentWeightKg} kg`;
      body = `El rendimiento no ha subido todavía lo suficiente desde la última vez (${formatShortDate(suggestion.previousFecha)}).`;
      break;
    case "mantener_rango":
      title = `Mantén ${suggestion.currentWeightKg} kg, intenta llegar a ${suggestion.repMax} reps en todas las series`;
      body = `Última vez: ${suggestion.lastReps.join(", ")}.`;
      break;
  }

  return (
    <div
      className={
        "mb-3 flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[11.5px] " +
        (sube ? "border-indigo-500/30 bg-indigo-500/10" : "border-slate-800 bg-slate-950/60")
      }
    >
      {sube && <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />}
      <div className="min-w-0">
        <p className={"font-semibold " + (sube ? "text-indigo-300" : "text-slate-400")}>Sugerencia: {title}</p>
        <p className={sube ? "text-indigo-200/70" : "text-slate-500"}>{body}</p>
      </div>
    </div>
  );
}

function DiscomfortWidget({
  entry,
  onSave,
  onRemove,
}: {
  entry: DiscomfortEntry | null;
  onSave: (patch: { zona_cuerpo: string; intensidad: number; nota: string | null }) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(!!entry);
  const [zona, setZona] = useState<string>(entry?.zona_cuerpo ?? DISCOMFORT_ZONAS[0]);
  const [intensidad, setIntensidad] = useState(entry?.intensidad ?? 0);
  const [nota, setNota] = useState(entry?.nota ?? "");

  useEffect(() => {
    setOpen(!!entry);
    setZona(entry?.zona_cuerpo ?? DISCOMFORT_ZONAS[0]);
    setIntensidad(entry?.intensidad ?? 0);
    setNota(entry?.nota ?? "");
  }, [entry?.id]);

  function commit(nextIntensidad: number, nextZona: string, nextNota: string) {
    if (nextIntensidad <= 0) {
      onRemove();
      return;
    }
    onSave({ zona_cuerpo: nextZona, intensidad: nextIntensidad, nota: nextNota.trim() || null });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-3 text-[11px] font-medium text-slate-500 underline decoration-dotted hover:text-slate-300"
      >
        + Registrar molestia
      </button>
    );
  }

  const semaforo = discomfortSemaforo(intensidad);
  const sliderCls =
    semaforo === "rojo" ? "accent-rose-500" : semaforo === "amarillo" ? "accent-amber-400" : "accent-emerald-500";
  const textCls =
    semaforo === "rojo" ? "text-rose-400" : semaforo === "amarillo" ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Molestia (opcional)
        </label>
        {entry && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setIntensidad(0);
              onRemove();
            }}
            className="text-[10px] text-slate-500 hover:text-slate-300"
          >
            Quitar
          </button>
        )}
      </div>

      <select
        value={zona}
        onChange={(e) => {
          setZona(e.target.value);
          if (intensidad > 0) commit(intensidad, e.target.value, nota);
        }}
        className={inputCls}
      >
        {DISCOMFORT_ZONAS.map((z) => (
          <option key={z} value={z}>
            {z.charAt(0).toUpperCase() + z.slice(1)}
          </option>
        ))}
      </select>

      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={intensidad}
        onChange={(e) => setIntensidad(parseInt(e.target.value, 10))}
        onMouseUp={() => commit(intensidad, zona, nota)}
        onTouchEnd={() => commit(intensidad, zona, nota)}
        onBlur={() => commit(intensidad, zona, nota)}
        className={"w-full " + sliderCls}
      />
      <p className={"text-xs font-semibold " + textCls}>
        {intensidad} · {semaforo}
      </p>

      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        onBlur={() => {
          if (intensidad > 0) commit(intensidad, zona, nota);
        }}
        placeholder="Nota (opcional)"
        className={inputCls}
      />
    </div>
  );
}

function ExerciseSetsCard({
  exercise,
  sets,
  suggestion,
  discomfortEntry,
  discomfortWatch,
  onChange,
  onSaveRow,
  onRemoveRow,
  onSaveDiscomfort,
  onRemoveDiscomfort,
}: {
  exercise: RoutineExerciseItem;
  sets: SessionSetDraft[];
  suggestion: ProgressionSuggestion | null;
  discomfortEntry: DiscomfortEntry | null;
  discomfortWatch: DiscomfortWatch | null;
  onChange: (sets: SessionSetDraft[]) => void;
  onSaveRow: (row: SessionSetDraft) => void;
  onRemoveRow: (row: SessionSetDraft) => void;
  onSaveDiscomfort: (patch: { zona_cuerpo: string; intensidad: number; nota: string | null }) => void;
  onRemoveDiscomfort: () => void;
}) {
  const targetReps = parseLeadingNumber(exercise.reps_objetivo);
  const targetPeso = exercise.peso_objetivo_kg;

  function updateRow(i: number, patch: Partial<SessionSetDraft>) {
    onChange(sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addRow() {
    const nextNum = sets.length ? Math.max(...sets.map((s) => s.numero_serie)) + 1 : 1;
    onChange([...sets, { id: null, numero_serie: nextNum, reps_realizadas: null, peso_realizado_kg: null }]);
  }
  function removeRow(i: number) {
    const row = sets[i];
    onChange(sets.filter((_, idx) => idx !== i));
    onRemoveRow(row);
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-white">{exercise.nombre}</span>
        {discomfortWatch && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300"
            title={`${discomfortWatch.zona}: amarillo o rojo en ${discomfortWatch.count} de las últimas 3 sesiones`}
          >
            <AlertTriangle className="h-3 w-3" /> A vigilar ({discomfortWatch.zona})
          </span>
        )}
      </div>
      <div className="mb-3 text-xs text-slate-500">
        Objetivo: {exercise.series_objetivo} series · {exercise.reps_objetivo}
        {exercise.peso_objetivo_kg != null && ` · ${exercise.peso_objetivo_kg} kg`}
      </div>

      <ProgressionSuggestionBadge suggestion={suggestion} />
      <DiscomfortWidget entry={discomfortEntry} onSave={onSaveDiscomfort} onRemove={onRemoveDiscomfort} />
      <div className="space-y-1.5">
        {sets.map((s, i) => {
          const status = setDotClass(s, targetReps, targetPeso);
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-slate-500">{s.numero_serie}</span>
              <input
                type="number"
                placeholder="Reps"
                value={s.reps_realizadas ?? ""}
                onChange={(e) => updateRow(i, { reps_realizadas: e.target.value ? parseInt(e.target.value, 10) : null })}
                onBlur={() => onSaveRow(sets[i])}
                className={inputCls + " flex-1"}
              />
              <input
                type="number"
                step="0.5"
                placeholder="Kg"
                value={s.peso_realizado_kg ?? ""}
                onChange={(e) => updateRow(i, { peso_realizado_kg: e.target.value ? parseFloat(e.target.value) : null })}
                onBlur={() => onSaveRow(sets[i])}
                className={inputCls + " flex-1"}
              />
              <span className={"h-2.5 w-2.5 shrink-0 rounded-full " + status.dot} title={status.title} />
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="shrink-0 text-slate-600 transition hover:text-rose-400"
                aria-label="Quitar serie"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
      >
        <Plus className="h-3.5 w-3.5" /> Añadir serie
      </button>
    </div>
  );
}

function HabitChecklist({
  day,
  entry,
}: {
  day: RoutineDayWithDetails;
  entry: ReturnType<typeof useTodayEntry>;
}) {
  if (day.habitos.length === 0) return null;
  return (
    <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <p className="mb-3 text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">Hábitos de hoy</p>
      <div className="space-y-2">
        {day.habitos.map((h) => {
          const log = entry.habits[h.tipo];
          const checked = log?.completado ?? false;
          return (
            <label
              key={h.tipo}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  entry.toggleHabit(h.tipo, e.target.checked).catch(() => {
                    toast.error("No se pudo guardar el hábito.");
                  });
                }}
                className="h-4 w-4 accent-emerald-500"
              />
              <span className="flex items-center gap-2 text-sm text-slate-200">
                {h.tipo === "movilidad" ? (
                  <Waves className="h-4 w-4 text-indigo-400" />
                ) : (
                  <Footprints className="h-4 w-4 text-emerald-400" />
                )}
                {h.tipo === "movilidad" ? "Movilidad" : "Caminata nocturna"}
              </span>
              {h.duracion_min_objetivo != null && (
                <span className="ml-auto text-xs text-slate-500">{h.duracion_min_objetivo} min</span>
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------ Entrenamiento extra ------------------------------ */

function ExtraSetsEditor({
  sets,
  onChange,
}: {
  sets: SessionSetDraft[];
  onChange: (sets: SessionSetDraft[]) => void;
}) {
  function updateRow(i: number, patch: Partial<SessionSetDraft>) {
    onChange(sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addRow() {
    onChange([...sets, { numero_serie: sets.length + 1, reps_realizadas: null, peso_realizado_kg: null }]);
  }
  function removeRow(i: number) {
    onChange(sets.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, numero_serie: idx + 1 })));
  }
  return (
    <div className="space-y-1.5">
      {sets.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-center text-xs font-semibold text-slate-500">{s.numero_serie}</span>
          <input
            type="number"
            placeholder="Reps"
            value={s.reps_realizadas ?? ""}
            onChange={(e) => updateRow(i, { reps_realizadas: e.target.value ? parseInt(e.target.value, 10) : null })}
            className={inputCls + " flex-1"}
          />
          <input
            type="number"
            step="0.5"
            placeholder="Kg"
            value={s.peso_realizado_kg ?? ""}
            onChange={(e) => updateRow(i, { peso_realizado_kg: e.target.value ? parseFloat(e.target.value) : null })}
            className={inputCls + " flex-1"}
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="shrink-0 text-slate-600 transition hover:text-rose-400"
            aria-label="Quitar serie"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
      >
        <Plus className="h-3.5 w-3.5" /> Añadir serie
      </button>
    </div>
  );
}

function ExtraWorkoutForm({
  exercises,
  onCreateExercise,
  onSubmit,
  onCancel,
}: {
  exercises: ExerciseRow[];
  onCreateExercise: (input: { nombre: string; grupo_muscular: string; tipo: "fuerza" | "movilidad" | "cardio" }) => Promise<ExerciseRow>;
  onSubmit: (
    fecha: string,
    setsByExercise: Record<string, SessionSetDraft[]>,
    esfuerzoDuracion: { esfuerzo_percibido: number | null; duracion_min: number | null },
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [fecha, setFecha] = useState(todayISODate());
  const [selected, setSelected] = useState<{ exerciseId: string; nombre: string; sets: SessionSetDraft[] }[]>([]);
  const [pickId, setPickId] = useState(exercises[0]?.id ?? "");
  const [creatingNew, setCreatingNew] = useState(exercises.length === 0);
  const [newNombre, setNewNombre] = useState("");
  const [newGrupo, setNewGrupo] = useState("");
  const [newTipo, setNewTipo] = useState<"fuerza" | "movilidad" | "cardio">("fuerza");
  const [esfuerzo, setEsfuerzo] = useState<number | null>(null);
  const [duracion, setDuracion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addExistingBlock() {
    const ex = exercises.find((e) => e.id === pickId);
    if (!ex || selected.some((s) => s.exerciseId === ex.id)) return;
    setSelected((prev) => [
      ...prev,
      { exerciseId: ex.id, nombre: ex.nombre, sets: [{ numero_serie: 1, reps_realizadas: null, peso_realizado_kg: null }] },
    ]);
  }

  async function addNewExercise() {
    if (!newNombre.trim() || !newGrupo.trim()) {
      setError("Introduce nombre y grupo muscular del ejercicio nuevo.");
      return;
    }
    try {
      const created = await onCreateExercise({ nombre: newNombre.trim(), grupo_muscular: newGrupo.trim(), tipo: newTipo });
      setSelected((prev) => [
        ...prev,
        { exerciseId: created.id, nombre: created.nombre, sets: [{ numero_serie: 1, reps_realizadas: null, peso_realizado_kg: null }] },
      ]);
      setNewNombre("");
      setNewGrupo("");
      setCreatingNew(false);
      setError(null);
    } catch (err) {
      setError((err as Error).message || "No se pudo crear el ejercicio.");
    }
  }

  function updateBlockSets(exerciseId: string, sets: SessionSetDraft[]) {
    setSelected((prev) => prev.map((b) => (b.exerciseId === exerciseId ? { ...b, sets } : b)));
  }
  function removeBlock(exerciseId: string) {
    setSelected((prev) => prev.filter((b) => b.exerciseId !== exerciseId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.length === 0) {
      setError("Añade al menos un ejercicio.");
      return;
    }
    setSaving(true);
    try {
      const setsByExercise: Record<string, SessionSetDraft[]> = {};
      for (const b of selected) setsByExercise[b.exerciseId] = b.sets;
      const duracion_min = duracion.trim() ? parseInt(duracion, 10) : null;
      await onSubmit(fecha, setsByExercise, { esfuerzo_percibido: esfuerzo, duracion_min });
    } catch (err) {
      setError((err as Error).message || "No se pudo guardar el entrenamiento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
          Entrenamiento no planificado
        </p>
        <button type="button" onClick={onCancel} className="text-slate-500 hover:text-white" aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>

      <Field label="Fecha">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className={inputCls + " [color-scheme:dark]"}
        />
      </Field>

      {selected.length > 0 && (
        <div className="space-y-2">
          {selected.map((b) => (
            <div key={b.exerciseId} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{b.nombre}</span>
                <button
                  type="button"
                  onClick={() => removeBlock(b.exerciseId)}
                  className="text-slate-600 hover:text-rose-400"
                  aria-label="Quitar ejercicio"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <ExtraSetsEditor sets={b.sets} onChange={(sets) => updateBlockSets(b.exerciseId, sets)} />
            </div>
          ))}
        </div>
      )}

      {!creatingNew ? (
        <div className="flex flex-wrap gap-2">
          {exercises.length > 0 && (
            <>
              <select value={pickId} onChange={(e) => setPickId(e.target.value)} className={inputCls + " flex-1"}>
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.nombre} — {ex.grupo_muscular}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addExistingBlock}
                className="rounded-lg border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-500 hover:text-white"
              >
                Añadir
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setCreatingNew(true)}
            className="rounded-lg border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-500 hover:text-white"
          >
            + Ejercicio nuevo
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              placeholder="Nombre del ejercicio"
              className={inputCls}
            />
            <input
              value={newGrupo}
              onChange={(e) => setNewGrupo(e.target.value)}
              placeholder="Grupo muscular"
              className={inputCls}
            />
            <select value={newTipo} onChange={(e) => setNewTipo(e.target.value as typeof newTipo)} className={inputCls}>
              <option value="fuerza">Fuerza</option>
              <option value="movilidad">Movilidad</option>
              <option value="cardio">Cardio</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            {exercises.length > 0 && (
              <button
                type="button"
                onClick={() => setCreatingNew(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={addNewExercise}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Crear y añadir
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
        <EsfuerzoDuracionFields
          esfuerzo={esfuerzo}
          onEsfuerzoChange={setEsfuerzo}
          duracion={duracion}
          onDuracionChange={setDuracion}
        />
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-indigo-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar entrenamiento"}
      </button>
    </form>
  );
}

/* ------------------------------ Calendario ------------------------------ */

const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];
const MESES_LABEL = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((v) => parseInt(v, 10));
  return `${d} de ${MESES_LABEL[m - 1]} de ${y}`;
}

// Rejilla del mes en semanas de lunes a domingo: null para los huecos antes
// del día 1 y después del último día.
function buildMonthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const leading = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return cells;
}

function dayCellClass(status: DayStatus | undefined): string {
  switch (status) {
    case "cumplido":
      return "border-emerald-500 bg-emerald-500/20 text-emerald-200";
    case "incumplido":
      return "border-rose-500 bg-rose-500/15 text-rose-200";
    case "pendiente":
      return "border-slate-700 bg-slate-900 text-slate-200";
    case "descanso":
      return "border-slate-800 bg-slate-800/60 text-slate-400";
    default:
      // Fuera de rango (antes de crear el perfil o todavía no ha llegado).
      return "border-slate-800/50 bg-transparent text-slate-700";
  }
}

function CalendarioView({
  onBack,
  progress,
}: {
  onBack: () => void;
  progress: ReturnType<typeof useTrainingProgress>;
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const selectedInfo = selectedDate ? progress.statusByDate.get(selectedDate) : undefined;
  const selectedSessions = selectedDate ? progress.sessionsByDate.get(selectedDate) ?? [] : [];

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" /> Volver a Hoy
        </button>

        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">Calendario</h1>
          <p className="mt-1 text-sm text-slate-400">Tu constancia con la rutina, día a día.</p>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-amber-400">
              <Flame className="h-4 w-4" />
              <span className="text-[10.5px] font-bold uppercase tracking-widest">Racha actual</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-white">
              {progress.loading ? "…" : progress.currentStreak}
            </div>
          </div>
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-indigo-300">
              <Trophy className="h-4 w-4" />
              <span className="text-[10.5px] font-bold uppercase tracking-widest">Récord</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-white">
              {progress.loading ? "…" : progress.bestStreak}
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={prevMonth}
              aria-label="Mes anterior"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-800 bg-slate-950 text-slate-300 transition hover:border-emerald-500 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[15px] font-bold capitalize text-white">
              {MESES_LABEL[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              aria-label="Mes siguiente"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-800 bg-slate-950 text-slate-300 transition hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-slate-800 disabled:hover:text-slate-300"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1.5 grid grid-cols-7 gap-1.5">
            {DIAS_CORTOS.map((d) => (
              <div
                key={d}
                className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500"
              >
                {d}
              </div>
            ))}
          </div>

          {progress.loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Cargando…</p>
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {grid.map((iso, i) => {
                if (!iso) return <div key={`e-${i}`} />;
                const info: CalendarDayInfo | undefined = progress.statusByDate.get(iso);
                const dayNum = parseInt(iso.split("-")[2], 10);
                const isToday = iso === todayISODate();
                const isSelected = iso === selectedDate;
                return (
                  <button
                    type="button"
                    key={iso}
                    onClick={() => setSelectedDate((cur) => (cur === iso ? null : iso))}
                    className={
                      "relative flex h-11 items-center justify-center rounded-lg border text-sm font-semibold transition " +
                      dayCellClass(info?.status) +
                      (isToday ? " ring-1 ring-inset ring-emerald-400" : "") +
                      (isSelected ? " outline outline-2 outline-offset-1 outline-white" : "")
                    }
                  >
                    {dayNum}
                    {info?.extra && (
                      <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-4 text-[11.5px] text-slate-400">
            <LegendDot className="border-emerald-500 bg-emerald-500/20" label="Plan cumplido" />
            <LegendDot className="border-rose-500 bg-rose-500/15" label="Plan incumplido" />
            <LegendDot className="border-slate-800 bg-slate-800/60" label="Descanso" />
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" /> Entrenamiento extra ese día
            </span>
          </div>

          {selectedDate && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{formatLongDate(selectedDate)}</span>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                >
                  Cerrar
                </button>
              </div>
              {selectedSessions.length === 0 ? (
                <p className="text-xs text-slate-400">
                  {selectedInfo?.status === "descanso"
                    ? "Día de descanso, sin sesión programada."
                    : "No hay ninguna sesión registrada este día."}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {selectedSessions.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">
                        {s.es_extra ? "Entrenamiento extra" : "Sesión de rutina"}
                        {" · "}
                        <span className={s.completado ? "text-emerald-400" : "text-rose-400"}>
                          {s.completado ? "completada" : "sin completar"}
                        </span>
                      </span>
                      <span className="text-slate-400">
                        {s.esfuerzo_percibido != null && s.duracion_min != null
                          ? `RPE ${s.esfuerzo_percibido} · ${s.duracion_min} min · carga ${s.esfuerzo_percibido * s.duracion_min}`
                          : s.duracion_min != null
                            ? `${s.duracion_min} min`
                            : "Sin esfuerzo/duración"}
                      </span>
                    </div>
                  ))}
                  {selectedInfo?.carga != null && selectedSessions.length > 1 && (
                    <div className="border-t border-slate-800 pt-2 text-right text-xs font-semibold text-emerald-400">
                      Carga total del día: {selectedInfo.carga}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={"h-3 w-3 rounded border " + className} />
      <span>{label}</span>
    </div>
  );
}

/* ------------------------------ Progreso y récords (e1RM) ------------------------------ */

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
}

function ProgressChartDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const point: ProgressPoint = payload;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={point.isPR ? 6 : 4}
      fill={point.isPR ? "#fbbf24" : "#34d399"}
      stroke={point.isPR ? "#f59e0b" : "#0f172a"}
      strokeWidth={point.isPR ? 2 : 1}
      opacity={point.precision === "aprox" ? 0.55 : 1}
    />
  );
}

function ProgressTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const point: ProgressPoint = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 shadow-lg">
      <div className="font-semibold text-white">
        {point.peso} kg × {point.reps} reps
      </div>
      <div className="mt-0.5 text-slate-400">
        e1RM ≈ {point.e1rm?.toFixed(1)} kg
        {point.precision === "aprox" && " (aprox.)"}
      </div>
      {point.isPR && <div className="mt-0.5 font-semibold text-amber-400">★ Récord personal</div>}
    </div>
  );
}

function WeeklyLoadTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const point: WeeklyLoadPoint = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 shadow-lg">
      <div className="font-semibold text-white">Semana del {formatShortDate(point.weekStart)}</div>
      <div className="mt-0.5 text-slate-400">Carga total: {point.carga}</div>
    </div>
  );
}

function mondayISO(d: Date): string {
  const dow = (d.getDay() + 6) % 7; // 0=lunes ... 6=domingo
  const s = new Date(d);
  s.setDate(d.getDate() - dow);
  return toLocalISODate(s);
}
function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
}

const MUSCLE_ZONE_COLOR: Record<string, string> = {
  insuficiente: "#fb7185",
  bajo: "#fcd34d",
  optimo: "#10b981",
  alto: "#f97316",
  excesivo: "#dc2626",
};
const MUSCLE_ZONE_LABEL: Record<string, string> = {
  insuficiente: "Insuficiente",
  bajo: "Por debajo del óptimo",
  optimo: "Óptimo",
  alto: "Por encima del óptimo",
  excesivo: "Excesivo",
};
const MUSCLE_ZONE_ORDER = ["insuficiente", "bajo", "optimo", "alto", "excesivo"] as const;

function MuscleVolumeTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload as { muscle: string; volumen: number; zone: string };
  const lm = MUSCLE_LANDMARKS[p.muscle];
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 shadow-lg">
      <div className="font-semibold text-white">{p.muscle}</div>
      <div className="mt-0.5 text-slate-400">
        {p.volumen.toFixed(1)} series · {MUSCLE_ZONE_LABEL[p.zone]}
      </div>
      {lm && (
        <div className="mt-0.5 text-slate-500">
          MEV {lm.mev} · MAV {lm.mavLow}-{lm.mavHigh} · MRV {lm.mrv}
        </div>
      )}
    </div>
  );
}

function MuscleVolumeSection() {
  const { loading, volumeByWeek } = useMuscleVolume();
  const [weekStart, setWeekStart] = useState(() => mondayISO(new Date()));
  const isCurrentWeek = weekStart === mondayISO(new Date());

  const chartData = useMemo(() => {
    const bucket = volumeByWeek.get(weekStart) ?? {};
    return MUSCLE_ORDER.map((m) => {
      const volumen = bucket[m] ?? 0;
      return { muscle: m, volumen, zone: muscleVolumeZone(m, volumen) };
    });
  }, [volumeByWeek, weekStart]);

  const hasAnyData = chartData.some((d) => d.volumen > 0);

  return (
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <p className="mb-3 text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
        Volumen semanal por grupo muscular
      </p>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDaysISO(w, -7))}
          aria-label="Semana anterior"
          className="grid h-7 w-7 place-items-center rounded-lg border border-slate-800 bg-slate-950 text-slate-300 transition hover:border-emerald-500 hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-semibold text-white">
          Semana del {formatShortDate(weekStart)} al {formatShortDate(addDaysISO(weekStart, 6))}
        </span>
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDaysISO(w, 7))}
          disabled={isCurrentWeek}
          aria-label="Semana siguiente"
          className="grid h-7 w-7 place-items-center rounded-lg border border-slate-800 bg-slate-950 text-slate-300 transition hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <p className="py-4 text-center text-xs text-slate-500">Cargando…</p>
      ) : !hasAnyData ? (
        <p className="py-4 text-center text-xs text-slate-500">
          No hay series registradas con músculo reconocido esta semana.
        </p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(30 41 59)" />
              <XAxis
                dataKey="muscle"
                tick={{ fill: "rgb(148 163 184)", fontSize: 10 }}
                axisLine={{ stroke: "rgb(51 65 85)" }}
                tickLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fill: "rgb(148 163 184)", fontSize: 11 }}
                axisLine={{ stroke: "rgb(51 65 85)" }}
                tickLine={false}
                width={30}
              />
              <RTooltip content={<MuscleVolumeTooltip />} />
              <Bar dataKey="volumen" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={MUSCLE_ZONE_COLOR[entry.zone]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-[10.5px] text-slate-500">
        {MUSCLE_ZONE_ORDER.map((z) => (
          <span key={z} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MUSCLE_ZONE_COLOR[z] }} />
            {MUSCLE_ZONE_LABEL[z]}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-600">
        Volumen fraccional: cada serie suma 1 al músculo principal del ejercicio y 0.5 a cada músculo secundario.
        Los grupos musculares sin tabla de referencia no se incluyen aquí. Los valores de MEV/MAV/MRV son puntos de
        partida generales, no individualizados, y no tienen en cuenta la proximidad al fallo por serie (el esfuerzo
        se registra a nivel de sesión completa, no por serie).
      </p>
    </section>
  );
}

function DeloadChecklist({ deload }: { deload: ReturnType<typeof useDeloadCheck> }) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
          Señales de descarga
        </p>
        {!deload.loading && (
          <span
            className={
              "text-[11px] font-semibold " + (deload.shouldDeload ? "text-amber-400" : "text-slate-500")
            }
          >
            {deload.activeCount} de {deload.signals.length} activas
          </span>
        )}
      </div>

      {deload.loading ? (
        <p className="py-2 text-xs text-slate-500">Cargando…</p>
      ) : (
        <div className="space-y-2">
          {deload.signals.map((s) => (
            <div key={s.id} className="flex items-start gap-2 text-xs">
              <span
                className={
                  "mt-0.5 h-2 w-2 shrink-0 rounded-full " + (s.active ? "bg-amber-400" : "bg-slate-700")
                }
              />
              <div className="min-w-0">
                <span className={s.active ? "font-semibold text-amber-300" : "font-semibold text-slate-400"}>
                  {s.label}
                </span>
                <span className="text-slate-500"> — {s.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!deload.loading && deload.shouldDeload && (
        <p className="mt-3 text-xs font-semibold text-white">
          Recomendación: esta semana, reduce el número de series aproximadamente a la mitad y no superes el 70% de
          tu peso habitual.
        </p>
      )}

      <p className="mt-3 text-[11px] text-slate-600">
        Hace falta un mínimo de historial (2-3 sesiones o semanas, según la señal) para poder evaluar cada una; si
        no hay datos suficientes, se muestra como no activa.
      </p>
    </section>
  );
}

function ProgresoView({
  onBack,
  progress,
  deload,
}: {
  onBack: () => void;
  progress: ReturnType<typeof useTrainingProgress>;
  deload: ReturnType<typeof useDeloadCheck>;
}) {
  const { exercises, loading } = useExerciseProgress();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sortedForSelect = useMemo(
    () => [...exercises].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [exercises],
  );

  useEffect(() => {
    if (loading) return;
    if (selectedId && exercises.some((e) => e.exerciseId === selectedId)) return;
    // Por defecto, el ejercicio con el dato más reciente (lo último que se entrenó).
    const mostRecent = [...exercises].sort((a, b) => {
      const lastA = a.points[a.points.length - 1]?.fecha ?? "";
      const lastB = b.points[b.points.length - 1]?.fecha ?? "";
      return lastB.localeCompare(lastA);
    })[0];
    setSelectedId(mostRecent?.exerciseId ?? null);
  }, [loading, exercises, selectedId]);

  const selected = exercises.find((e) => e.exerciseId === selectedId) ?? null;
  const chartData = selected ? selected.points.filter((p) => p.e1rm != null) : [];

  const recordsSorted = useMemo(
    () =>
      exercises
        .filter((e) => e.currentPR)
        .sort((a, b) => b.currentPR!.fecha.localeCompare(a.currentPR!.fecha)),
    [exercises],
  );

  return (
    <div className="min-h-screen w-full bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" /> Volver a Hoy
        </button>

        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">Progreso y récords</h1>
          <p className="mt-1 text-sm text-slate-400">
            Evolución de tu fuerza estimada (e1RM) por ejercicio.
          </p>
        </header>

        <DeloadChecklist deload={deload} />

        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : exercises.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-300">
            Todavía no tienes series con reps y peso registrados. En cuanto anotes alguna en "Hoy", aparecerá aquí.
          </div>
        ) : (
          <>
            <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Ejercicio
                </label>
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className={inputCls}
                >
                  {sortedForSelect.map((e) => (
                    <option key={e.exerciseId} value={e.exerciseId}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {chartData.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  Ninguna serie de este ejercicio es estimable todavía (hace falta reps y peso, y 15 reps o menos).
                </p>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(30 41 59)" />
                      <XAxis
                        dataKey="fecha"
                        tickFormatter={formatShortDate}
                        tick={{ fill: "rgb(148 163 184)", fontSize: 11 }}
                        axisLine={{ stroke: "rgb(51 65 85)" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "rgb(148 163 184)", fontSize: 11 }}
                        axisLine={{ stroke: "rgb(51 65 85)" }}
                        tickLine={false}
                        width={36}
                      />
                      <RTooltip content={<ProgressTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="e1rm"
                        stroke="rgb(52 211 153)"
                        strokeWidth={2}
                        dot={<ProgressChartDot />}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Serie
                </span>
                <span className="flex items-center gap-1.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Récord personal
                </span>
                <span className="opacity-55">○ atenuado = estimación aprox. (11-15 reps)</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">
                Las series de más de 15 repeticiones no se incluyen: por encima de ese rango ninguna fórmula es fiable.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="mb-3 text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
                Tus récords actuales
              </p>
              {recordsSorted.length === 0 ? (
                <p className="text-xs text-slate-500">Todavía no hay ningún récord calculado.</p>
              ) : (
                <div className="space-y-2">
                  {recordsSorted.map((e) => (
                    <button
                      key={e.exerciseId}
                      onClick={() => setSelectedId(e.exerciseId)}
                      className="flex w-full items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-left transition hover:border-emerald-500/40"
                    >
                      <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{e.nombre}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {e.currentPR!.peso} kg × {e.currentPR!.reps} reps · {formatShortDate(e.currentPR!.fecha)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-emerald-400">{e.currentPR!.e1rm.toFixed(1)} kg</div>
                        <div className="text-[10px] text-slate-600">e1RM</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="mb-3 text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
            Carga de entrenamiento
          </p>
          {progress.loading ? (
            <p className="py-4 text-center text-xs text-slate-500">Cargando…</p>
          ) : progress.weeklyLoad.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">
              Todavía no hay suficientes sesiones con esfuerzo y duración registrados para calcular la carga semanal.
            </p>
          ) : (
            <>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progress.weeklyLoad} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(30 41 59)" />
                    <XAxis
                      dataKey="weekStart"
                      tickFormatter={formatShortDate}
                      tick={{ fill: "rgb(148 163 184)", fontSize: 11 }}
                      axisLine={{ stroke: "rgb(51 65 85)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "rgb(148 163 184)", fontSize: 11 }}
                      axisLine={{ stroke: "rgb(51 65 85)" }}
                      tickLine={false}
                      width={36}
                    />
                    <RTooltip content={<WeeklyLoadTooltip />} />
                    <Bar dataKey="carga" fill="rgb(99 102 241)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] text-slate-600">
                Carga = esfuerzo percibido (0-10) × duración (min), sumada por semana (lunes a domingo). Solo cuenta
                sesiones completadas con ambos datos registrados.
              </p>
            </>
          )}
        </section>

        <MuscleVolumeSection />
      </div>
    </div>
  );
}

/* ------------------------------ Resumen semanal ------------------------------ */

function ResumenSemanalView({
  onBack,
  progress,
  deload,
  discomfort,
}: {
  onBack: () => void;
  progress: ReturnType<typeof useTrainingProgress>;
  deload: ReturnType<typeof useDeloadCheck>;
  discomfort: ReturnType<typeof useExerciseDiscomfort>;
}) {
  const muscleVolume = useMuscleVolume();
  const exerciseProgress = useExerciseProgress();

  const thisWeekStart = mondayISO(new Date());
  const weekEnd = addDaysISO(thisWeekStart, 6);
  const loading =
    progress.loading || muscleVolume.loading || exerciseProgress.loading || deload.loading || discomfort.loading;

  const cargaSemana = progress.weeklyLoad.find((w) => w.weekStart === thisWeekStart)?.carga ?? null;

  const volumeBucket = muscleVolume.volumeByWeek.get(thisWeekStart) ?? {};
  const fueraDeRango = MUSCLE_ORDER.map((m) => {
    const volumen = volumeBucket[m] ?? 0;
    return { muscle: m, volumen, zone: muscleVolumeZone(m, volumen), landmark: MUSCLE_LANDMARKS[m] };
  }).filter((v) => v.zone === "insuficiente" || v.zone === "excesivo");

  const prsSemana = exerciseProgress.exercises
    .flatMap((e) => e.points.filter((p) => p.isPR && p.fecha >= thisWeekStart).map((p) => ({ nombre: e.nombre, ...p })))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="min-h-screen w-full bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" /> Volver a Hoy
        </button>

        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">Resumen semanal</h1>
          <p className="mt-1 text-sm text-slate-400">
            Semana del {formatShortDate(thisWeekStart)} al {formatShortDate(weekEnd)}
          </p>
        </header>

        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-amber-400">
                  <Flame className="h-4 w-4" />
                  <span className="text-[10.5px] font-bold uppercase tracking-widest">Racha actual</span>
                </div>
                <div className="mt-1 text-2xl font-bold text-white">{progress.currentStreak}</div>
              </div>
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-indigo-300">
                  <Trophy className="h-4 w-4" />
                  <span className="text-[10.5px] font-bold uppercase tracking-widest">Récord</span>
                </div>
                <div className="mt-1 text-2xl font-bold text-white">{progress.bestStreak}</div>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
                Carga total de la semana
              </p>
              <p className="mt-1 text-xl font-bold text-white">{cargaSemana ?? "—"}</p>
              <p className="mt-1 text-[11px] text-slate-600">
                Esfuerzo percibido × duración, sumado en las sesiones completadas de esta semana.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
                Volumen fuera de rango
              </p>
              {fueraDeRango.length === 0 ? (
                <p className="text-xs text-slate-500">Todo el volumen dentro de rango esta semana.</p>
              ) : (
                <div className="space-y-1.5">
                  {fueraDeRango.map((v) => (
                    <p key={v.muscle} className="text-xs">
                      <span className={v.zone === "excesivo" ? "text-rose-400" : "text-amber-400"}>●</span>{" "}
                      <span className="font-semibold text-slate-200">{v.muscle}</span>
                      <span className="text-slate-500">
                        : {v.volumen.toFixed(1)} series —{" "}
                        {v.zone === "excesivo"
                          ? `por encima del MRV (${v.landmark.mrv})`
                          : `por debajo del MEV (${v.landmark.mev})`}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
                Récords nuevos esta semana
              </p>
              {prsSemana.length === 0 ? (
                <p className="text-xs text-slate-500">Sin récords nuevos esta semana todavía.</p>
              ) : (
                <div className="space-y-1.5">
                  {prsSemana.map((p, i) => (
                    <p key={i} className="text-xs">
                      <Star className="mr-1 inline h-3 w-3 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-slate-200">{p.nombre}</span>
                      <span className="text-slate-500">
                        {" "}
                        — {p.e1rm?.toFixed(1)} kg (e1RM) · {formatShortDate(p.fecha)}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </section>

            {deload.shouldDeload && (
              <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-amber-300">
                  Posible necesidad de descarga
                </p>
                <p className="mt-1 text-xs text-amber-200/80">
                  {deload.activeCount} de {deload.signals.length} señales activas.
                </p>
                <p className="mt-2 text-[11px] text-amber-100/70">Ver detalle completo en Progreso.</p>
              </section>
            )}

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
                Molestias a vigilar
              </p>
              {discomfort.watchList.length === 0 ? (
                <p className="text-xs text-slate-500">Sin molestias recurrentes detectadas.</p>
              ) : (
                <div className="space-y-1.5">
                  {discomfort.watchList.map((w, i) => (
                    <p key={i} className="text-xs">
                      <AlertTriangle className="mr-1 inline h-3 w-3 text-amber-400" />
                      <span className="font-semibold text-slate-200">{w.nombre}</span>
                      <span className="text-slate-500">
                        {" "}
                        — {w.zona}: amarillo o rojo en {w.count} de las últimas 3 sesiones (más reciente:{" "}
                        {formatShortDate(w.lastFecha)}, intensidad {w.lastIntensidad})
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Mi Rutina ------------------------------ */

function MiRutinaView({ onBack }: { onBack: () => void }) {
  const routine = useRoutine();
  const [selectedDow, setSelectedDow] = useState<number | null>(null);
  const day = routine.days.find((d) => d.dia_semana === selectedDow) ?? null;

  return (
    <div className="min-h-screen w-full bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={day ? () => setSelectedDow(null) : onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" />
          {day ? "Volver a Mi Rutina" : "Volver a inicio"}
        </button>

        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">Mi Rutina</h1>
          <p className="mt-1 text-sm text-slate-400">
            {day ? `${DIAS_LABEL[day.dia_semana]} · ${day.nombre_dia}` : "Tu semana completa, día a día."}
          </p>
        </header>

        {routine.loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : day ? (
          <DayEditor day={day} routine={routine} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {routine.days.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDow(d.dia_semana)}
                className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left transition hover:border-emerald-500/40 hover:bg-slate-900/80"
              >
                <span className="text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
                  {DIAS_LABEL[d.dia_semana]}
                </span>
                <span className="text-lg font-semibold text-white">{d.nombre_dia}</span>
                <span
                  className={
                    "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                    (d.es_dia_entreno
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "bg-slate-800 text-slate-400")
                  }
                >
                  {d.es_dia_entreno ? `${d.ejercicios.length} ejercicios` : "Descanso"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Editor de día ------------------------------ */

function DayEditor({
  day,
  routine,
}: {
  day: RoutineDayWithDetails;
  routine: ReturnType<typeof useRoutine>;
}) {
  const [addingExercise, setAddingExercise] = useState(false);
  const movilidad = day.habitos.find((h) => h.tipo === "movilidad");
  const caminata = day.habitos.find((h) => h.tipo === "caminata");

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
            Ejercicios
          </p>
          {!addingExercise && (
            <button
              onClick={() => setAddingExercise(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-emerald-500 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Añadir ejercicio
            </button>
          )}
        </div>

        {day.ejercicios.length === 0 && !addingExercise && (
          <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 py-8 text-center text-xs text-slate-500">
            {day.es_dia_entreno ? "Sin ejercicios todavía." : "Día de descanso — sin ejercicios de fuerza."}
          </p>
        )}

        <div className="space-y-2">
          {day.ejercicios.map((ex) => (
            <RoutineExerciseRow
              key={ex.id}
              exercise={ex}
              onUpdate={(patch) => routine.updateRoutineExercise(ex.id, patch)}
              onRemove={() => routine.removeExerciseFromDay(ex.id)}
            />
          ))}
        </div>

        {addingExercise && (
          <AddExerciseForm
            exercises={routine.exercises}
            onCreateExercise={routine.createExercise}
            onUpdateExercise={routine.updateExercise}
            onAdd={async (exerciseId, opts) => {
              await routine.addExerciseToDay(day.id, exerciseId, opts);
              setAddingExercise(false);
            }}
            onCancel={() => setAddingExercise(false)}
          />
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <p className="mb-3 text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
          Hábitos del día
        </p>
        {!movilidad && !caminata ? (
          <p className="text-xs text-slate-500">Sin hábitos asociados a este día.</p>
        ) : (
          <div className="space-y-2">
            {movilidad && (
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-200">
                <Waves className="h-4 w-4 shrink-0 text-indigo-400" />
                Movilidad
                {movilidad.duracion_min_objetivo != null && (
                  <span className="ml-auto text-xs text-slate-500">{movilidad.duracion_min_objetivo} min</span>
                )}
              </div>
            )}
            {caminata && (
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-200">
                <Footprints className="h-4 w-4 shrink-0 text-emerald-400" />
                Caminata nocturna
                {caminata.duracion_min_objetivo != null && (
                  <span className="ml-auto text-xs text-slate-500">{caminata.duracion_min_objetivo} min</span>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function RoutineExerciseRow({
  exercise,
  onUpdate,
  onRemove,
}: {
  exercise: RoutineExerciseItem;
  onUpdate: (patch: { series_objetivo: string; reps_objetivo: string; peso_objetivo_kg: number | null }) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [series, setSeries] = useState(exercise.series_objetivo);
  const [reps, setReps] = useState(exercise.reps_objetivo);
  const [peso, setPeso] = useState(exercise.peso_objetivo_kg?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onUpdate({
        series_objetivo: series.trim() || exercise.series_objetivo,
        reps_objetivo: reps.trim() || exercise.reps_objetivo,
        peso_objetivo_kg: peso.trim() ? parseFloat(peso) : null,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-slate-950 p-3">
        <div className="mb-2 text-sm font-semibold text-white">{exercise.nombre}</div>
        <div className="grid grid-cols-3 gap-2">
          <input value={series} onChange={(e) => setSeries(e.target.value)} placeholder="Series" className={inputCls} />
          <input value={reps} onChange={(e) => setReps(e.target.value)} placeholder="Reps" className={inputCls} />
          <input
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            placeholder="Peso (kg)"
            type="number"
            step="0.5"
            className={inputCls}
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" /> Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white">{exercise.nombre}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {exercise.grupo_muscular} · {exercise.series_objetivo} series · {exercise.reps_objetivo}
          {exercise.peso_objetivo_kg != null && ` · ${exercise.peso_objetivo_kg} kg`}
        </div>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white"
        aria-label="Editar"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={onRemove}
        className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-rose-400"
        aria-label="Quitar"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function SecondaryMusclesPicker({
  value,
  onChange,
  exclude,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  exclude?: string | null;
}) {
  const options = MUSCLE_ORDER.filter((m) => m !== exclude);
  function toggle(m: string) {
    onChange(value.includes(m) ? value.filter((v) => v !== m) : [...value, m]);
  }
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Músculos secundarios (opcional, cuentan 0.5 series en el volumen)
      </label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => toggle(m)}
            className={
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition " +
              (value.includes(m)
                ? "border-indigo-500 bg-indigo-500/15 text-indigo-300"
                : "border-slate-800 text-slate-400 hover:text-white")
            }
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

function EditExerciseMuscles({
  exercise,
  onSave,
}: {
  exercise: ExerciseRow;
  onSave: (patch: { grupo_muscular: string; musculos_secundarios: string[] }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [grupo, setGrupo] = useState(exercise.grupo_muscular);
  const [secundarios, setSecundarios] = useState<string[]>(exercise.musculos_secundarios);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setGrupo(exercise.grupo_muscular);
    setSecundarios(exercise.musculos_secundarios);
    setSaved(false);
    setOpen(false);
  }, [exercise.id]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-medium text-slate-500 underline decoration-dotted hover:text-slate-300"
      >
        Editar músculos de este ejercicio
      </button>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ grupo_muscular: grupo.trim(), musculos_secundarios: secundarios });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const principalNorm = normalizeMuscleGroup(grupo);

  return (
    <div className="space-y-2.5 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <Field label="Músculo principal">
        <input
          value={grupo}
          onChange={(e) => {
            setGrupo(e.target.value);
            setSaved(false);
          }}
          className={inputCls}
        />
      </Field>
      <SecondaryMusclesPicker
        value={secundarios}
        onChange={(v) => {
          setSecundarios(v);
          setSaved(false);
        }}
        exclude={principalNorm}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        {saved && <span className="text-[11px] text-emerald-400">Guardado.</span>}
      </div>
    </div>
  );
}

function AddExerciseForm({
  exercises,
  onCreateExercise,
  onUpdateExercise,
  onAdd,
  onCancel,
}: {
  exercises: ExerciseRow[];
  onCreateExercise: (input: {
    nombre: string;
    grupo_muscular: string;
    tipo: "fuerza" | "movilidad" | "cardio";
    notas?: string | null;
    musculos_secundarios?: string[];
  }) => Promise<ExerciseRow>;
  onUpdateExercise: (id: string, patch: { grupo_muscular: string; musculos_secundarios: string[] }) => Promise<void>;
  onAdd: (exerciseId: string, opts: { series_objetivo: string; reps_objetivo: string; peso_objetivo_kg?: number | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"existente" | "nuevo">(exercises.length ? "existente" : "nuevo");
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [grupoMuscular, setGrupoMuscular] = useState("");
  const [tipo, setTipo] = useState<"fuerza" | "movilidad" | "cardio">("fuerza");
  const [nuevoSecundarios, setNuevoSecundarios] = useState<string[]>([]);
  const [series, setSeries] = useState("3-4");
  const [reps, setReps] = useState("10-12");
  const [peso, setPeso] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedExercise = exercises.find((e) => e.id === exerciseId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let idToUse = exerciseId;
      if (mode === "nuevo") {
        if (!nombre.trim() || !grupoMuscular.trim()) {
          throw new Error("Introduce nombre y grupo muscular del nuevo ejercicio.");
        }
        const created = await onCreateExercise({
          nombre: nombre.trim(),
          grupo_muscular: grupoMuscular.trim(),
          tipo,
          musculos_secundarios: nuevoSecundarios,
        });
        idToUse = created.id;
      }
      if (!idToUse) throw new Error("Selecciona un ejercicio.");
      await onAdd(idToUse, {
        series_objetivo: series.trim() || "3",
        reps_objetivo: reps.trim() || "10",
        peso_objetivo_kg: peso.trim() ? parseFloat(peso) : null,
      });
    } catch (err) {
      setError((err as Error).message || "No se pudo añadir el ejercicio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("existente")}
          className={
            "flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition " +
            (mode === "existente"
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
              : "border-slate-800 text-slate-400 hover:text-white")
          }
        >
          Ejercicio existente
        </button>
        <button
          type="button"
          onClick={() => setMode("nuevo")}
          className={
            "flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition " +
            (mode === "nuevo"
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
              : "border-slate-800 text-slate-400 hover:text-white")
          }
        >
          Ejercicio nuevo
        </button>
      </div>

      {mode === "existente" ? (
        exercises.length === 0 ? (
          <p className="text-xs text-slate-500">
            Todavía no tienes ejercicios en tu biblioteca. Crea uno nuevo.
          </p>
        ) : (
          <div className="space-y-2">
            <select
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              className={inputCls}
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.nombre} — {ex.grupo_muscular}
                </option>
              ))}
            </select>
            {selectedExercise && (
              <EditExerciseMuscles
                key={selectedExercise.id}
                exercise={selectedExercise}
                onSave={(patch) => onUpdateExercise(selectedExercise.id, patch)}
              />
            )}
          </div>
        )
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del ejercicio"
              className={inputCls}
            />
            <input
              value={grupoMuscular}
              onChange={(e) => setGrupoMuscular(e.target.value)}
              placeholder="Grupo muscular"
              className={inputCls}
            />
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={inputCls}>
              <option value="fuerza">Fuerza</option>
              <option value="movilidad">Movilidad</option>
              <option value="cardio">Cardio</option>
            </select>
          </div>
          <SecondaryMusclesPicker
            value={nuevoSecundarios}
            onChange={setNuevoSecundarios}
            exclude={normalizeMuscleGroup(grupoMuscular)}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <input value={series} onChange={(e) => setSeries(e.target.value)} placeholder="Series" className={inputCls} />
        <input value={reps} onChange={(e) => setReps(e.target.value)} placeholder="Reps" className={inputCls} />
        <input
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          placeholder="Peso (kg, opcional)"
          type="number"
          step="0.5"
          className={inputCls}
        />
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white"
        >
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" /> {saving ? "Añadiendo…" : "Añadir"}
        </button>
      </div>
    </form>
  );
}
