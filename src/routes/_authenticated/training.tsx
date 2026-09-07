import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  usePersonalProfile,
  useRoutine,
  useTodayEntry,
  useTrainingProgress,
  createExtraSession,
  todayISODate,
  toLocalISODate,
  type PersonalProfile,
  type PersonalProfileInput,
  type RoutineDayWithDetails,
  type RoutineExerciseItem,
  type ExerciseRow,
  type SessionSetDraft,
  type DayStatus,
  type CalendarDayInfo,
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
  const [view, setView] = useState<"hoy" | "rutina" | "calendario">("hoy");
  const progress = useTrainingProgress();

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
  return (
    <HoyView
      onOpenRutina={() => setView("rutina")}
      onOpenCalendario={() => setView("calendario")}
      progress={progress}
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

function HoyView({
  onOpenRutina,
  onOpenCalendario,
  progress,
}: {
  onOpenRutina: () => void;
  onOpenCalendario: () => void;
  progress: ReturnType<typeof useTrainingProgress>;
}) {
  const { user } = useAuth();
  const routine = useRoutine();
  const today = routine.days.find((d) => d.dia_semana === todayDiaSemana()) ?? null;
  const entry = useTodayEntry(today?.id ?? null);
  const [draftSets, setDraftSets] = useState<Record<string, SessionSetDraft[]>>({});
  const [completing, setCompleting] = useState(false);
  const [showExtra, setShowExtra] = useState(false);

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
      } else {
        await entry.saveSet(exerciseId, row);
      }
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

  async function handleComplete() {
    setCompleting(true);
    try {
      await entry.markCompleted();
      toast.success("Entrenamiento de hoy marcado como completado.");
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
                    onChange={(sets) => setDraftSets((prev) => ({ ...prev, [ex.exercise_id]: sets }))}
                    onSaveRow={(row) => handleSaveRow(ex.exercise_id, row)}
                    onRemoveRow={(row) => handleRemoveRow(ex.exercise_id, row)}
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
              <button
                onClick={handleComplete}
                disabled={completing}
                className="mt-4 w-full rounded-lg bg-gradient-to-r from-emerald-500 to-indigo-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-60"
              >
                {completing
                  ? "Guardando…"
                  : entry.completado
                    ? "Entrenamiento completado ✓"
                    : "Marcar entrenamiento como completado"}
              </button>
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
                  onSubmit={async (fecha, sets) => {
                    await createExtraSession(user.id, fecha, sets);
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

function ExerciseSetsCard({
  exercise,
  sets,
  onChange,
  onSaveRow,
  onRemoveRow,
}: {
  exercise: RoutineExerciseItem;
  sets: SessionSetDraft[];
  onChange: (sets: SessionSetDraft[]) => void;
  onSaveRow: (row: SessionSetDraft) => void;
  onRemoveRow: (row: SessionSetDraft) => void;
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
      <div className="mb-1 text-sm font-semibold text-white">{exercise.nombre}</div>
      <div className="mb-3 text-xs text-slate-500">
        Objetivo: {exercise.series_objetivo} series · {exercise.reps_objetivo}
        {exercise.peso_objetivo_kg != null && ` · ${exercise.peso_objetivo_kg} kg`}
      </div>
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
  onSubmit: (fecha: string, setsByExercise: Record<string, SessionSetDraft[]>) => Promise<void>;
  onCancel: () => void;
}) {
  const [fecha, setFecha] = useState(todayISODate());
  const [selected, setSelected] = useState<{ exerciseId: string; nombre: string; sets: SessionSetDraft[] }[]>([]);
  const [pickId, setPickId] = useState(exercises[0]?.id ?? "");
  const [creatingNew, setCreatingNew] = useState(exercises.length === 0);
  const [newNombre, setNewNombre] = useState("");
  const [newGrupo, setNewGrupo] = useState("");
  const [newTipo, setNewTipo] = useState<"fuerza" | "movilidad" | "cardio">("fuerza");
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
      await onSubmit(fecha, setsByExercise);
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

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

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
                return (
                  <div
                    key={iso}
                    className={
                      "relative flex h-11 items-center justify-center rounded-lg border text-sm font-semibold " +
                      dayCellClass(info?.status) +
                      (isToday ? " ring-1 ring-inset ring-emerald-400" : "")
                    }
                  >
                    {dayNum}
                    {info?.extra && (
                      <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    )}
                  </div>
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

function AddExerciseForm({
  exercises,
  onCreateExercise,
  onAdd,
  onCancel,
}: {
  exercises: ExerciseRow[];
  onCreateExercise: (input: { nombre: string; grupo_muscular: string; tipo: "fuerza" | "movilidad" | "cardio"; notas?: string | null }) => Promise<ExerciseRow>;
  onAdd: (exerciseId: string, opts: { series_objetivo: string; reps_objetivo: string; peso_objetivo_kg?: number | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"existente" | "nuevo">(exercises.length ? "existente" : "nuevo");
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [grupoMuscular, setGrupoMuscular] = useState("");
  const [tipo, setTipo] = useState<"fuerza" | "movilidad" | "cardio">("fuerza");
  const [series, setSeries] = useState("3-4");
  const [reps, setReps] = useState("10-12");
  const [peso, setPeso] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        )
      ) : (
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
