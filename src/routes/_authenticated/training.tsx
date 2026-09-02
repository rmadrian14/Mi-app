import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Dumbbell, ChevronLeft, Plus, Trash2, Pencil, X, Check, Footprints, Waves } from "lucide-react";
import {
  usePersonalProfile,
  useRoutine,
  type PersonalProfile,
  type PersonalProfileInput,
  type RoutineDayWithDetails,
  type RoutineExerciseItem,
  type ExerciseRow,
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
  const [view, setView] = useState<"resumen" | "rutina">("resumen");

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

  return view === "rutina" ? (
    <MiRutinaView onBack={() => setView("resumen")} />
  ) : (
    <ResumenView profile={profile} onOpenRutina={() => setView("rutina")} />
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

/* ------------------------------ Resumen ------------------------------ */

function ResumenView({
  profile,
  onOpenRutina,
}: {
  profile: PersonalProfile;
  onOpenRutina: () => void;
}) {
  const { days, loading } = useRoutine();
  const today = days.find((d) => d.dia_semana === todayDiaSemana());

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 ring-1 ring-emerald-500/30">
          <Dumbbell className="h-7 w-7 text-emerald-400" />
        </div>
        <h1 className="text-xl font-semibold text-white">Entrenamiento</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          {loading
            ? "Cargando tu rutina…"
            : today
              ? today.es_dia_entreno
                ? <>Hoy toca: <span className="font-semibold text-emerald-400">{today.nombre_dia}</span></>
                : <>Hoy: <span className="font-semibold text-slate-200">Descanso</span></>
              : "Tu rutina está lista."}
        </p>
        {profile.objetivo && (
          <p className="mt-1 text-xs text-slate-500">Objetivo: {profile.objetivo}</p>
        )}
        <button
          onClick={onOpenRutina}
          className="mt-6 w-full rounded-lg bg-gradient-to-r from-emerald-500 to-indigo-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90"
        >
          Ver Mi Rutina
        </button>
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
