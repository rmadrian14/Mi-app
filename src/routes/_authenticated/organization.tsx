import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/organization")({
  head: () => ({
    meta: [
      { title: "Organización · Veract" },
      { name: "description", content: "Calendario fiscal, tareas y plazos orientativos." },
    ],
  }),
  component: OrganizationPage,
});

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

type Priority = "urgente" | "importante" | "rutinaria";
type Task = { id: string; title: string; task_date: string; priority: Priority; done: boolean };
type Deadline = { id: string; deadline_date: string; title: string };

const pad = (n: number) => n.toString().padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function OrganizationPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [priority, setPriority] = useState<Priority>("rutinaria");

  const tasksQuery = useQuery<Task[]>({
    queryKey: ["user_tasks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_tasks")
        .select("id, title, task_date, priority, done")
        .order("task_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const deadlinesQuery = useQuery<Deadline[]>({
    queryKey: ["fiscal_deadlines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_deadlines")
        .select("id, deadline_date, title")
        .order("deadline_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Deadline[];
    },
  });

  const tasks = tasksQuery.data ?? [];
  const deadlines = deadlinesQuery.data ?? [];

  const addTask = useMutation({
    mutationFn: async (payload: { title: string; task_date: string; priority: Priority }) => {
      if (!user) throw new Error("no user");
      const { error } = await supabase.from("user_tasks").insert({
        user_id: user.id,
        title: payload.title,
        task_date: payload.task_date,
        priority: payload.priority,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_tasks"] }),
  });

  const toggleTask = useMutation({
    mutationFn: async (t: Task) => {
      const { error } = await supabase
        .from("user_tasks")
        .update({ done: !t.done })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_tasks"] }),
  });

  const monthLabel = `${MESES[viewMonth]} ${viewYear}`;
  const today = todayISO();

  const grid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const leading = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`);
    }
    return cells;
  }, [viewYear, viewMonth]);

  const dayTasks = useMemo(
    () =>
      selectedDate
        ? tasks
            .filter((t) => t.task_date === selectedDate)
            .sort((a, b) => Number(a.done) - Number(b.done))
        : [],
    [tasks, selectedDate],
  );
  const dayDeadlines = useMemo(
    () => (selectedDate ? deadlines.filter((d) => d.deadline_date === selectedDate) : []),
    [deadlines, selectedDate],
  );

  const upcomingDeadlines = deadlines
    .filter((f) => f.deadline_date >= today)
    .slice(0, 4);

  useEffect(() => {
    if (selectedDate) setDate(selectedDate);
  }, [selectedDate]);

  function prev() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }
  function next() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }
  function goToday() {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(todayISO());
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || !date) return;
    addTask.mutate(
      { title: t, task_date: date, priority },
      { onSuccess: () => setTitle("") },
    );
  }

  const dayTitle = selectedDate
    ? (() => {
        const [, m, d] = selectedDate.split("-");
        return `${parseInt(d)} de ${MESES[parseInt(m) - 1]}`;
      })()
    : "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 text-slate-100">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Calendario fiscal</h1>
        <p className="mt-1 text-sm text-slate-400">
          Tus tareas y los plazos fiscales orientativos, en un solo sitio.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
        {/* Left column: calendar + day panel */}
        <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                aria-label="Mes anterior"
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-800 bg-slate-950 text-slate-300 transition hover:border-emerald-500 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[150px] text-center text-[15px] font-bold capitalize text-white">
                {monthLabel}
              </span>
              <button
                onClick={next}
                aria-label="Mes siguiente"
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-800 bg-slate-950 text-slate-300 transition hover:border-emerald-500 hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={goToday}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
            >
              Hoy
            </button>
          </div>
          <div className="mb-1.5 grid grid-cols-7 gap-1.5">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <div
                key={d}
                className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {grid.map((iso, i) => {
              if (!iso) return <div key={`e-${i}`} />;
              const dayTasks = tasks.filter((t) => t.task_date === iso);
              const dayDeadlines = deadlines.filter((d) => d.deadline_date === iso);
              const isToday = iso === today;
              const isSelected = iso === selectedDate;
              const dayNum = parseInt(iso.split("-")[2]);
              return (
                <button
                  key={iso}
                  onClick={() => setSelectedDate(selectedDate === iso ? null : iso)}
                  className={cn(
                    "flex min-h-[64px] flex-col gap-1 rounded-lg border p-2 text-left transition",
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/10"
                      : isToday
                        ? "border-emerald-500/60 bg-slate-950 ring-1 ring-inset ring-emerald-500/40"
                        : "border-slate-800 bg-slate-950 hover:border-slate-700",
                  )}
                >
                  <div className={cn("text-xs font-semibold", isToday ? "text-emerald-400" : "text-slate-200")}>{dayNum}</div>
                  <div className="mt-auto flex flex-wrap gap-1">
                    {dayTasks.map((t) => (
                      <span
                        key={t.id}
                        className={
                          "h-1.5 w-1.5 rounded-full " +
                          (t.priority === "urgente"
                            ? "bg-rose-500"
                            : t.priority === "importante"
                              ? "bg-amber-500"
                              : "bg-emerald-500") +
                          (t.done ? " opacity-30" : "")
                        }
                      />
                    ))}
                    {dayDeadlines.map((d) => (
                      <span key={d.id} className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-[11.5px] text-slate-400">
            <LegendItem className="bg-rose-500" label="Urgente" />
            <LegendItem className="bg-amber-500" label="Importante" />
            <LegendItem className="bg-emerald-500" label="Rutinaria" />
            <LegendItem className="bg-sky-500" label="Plazo fiscal orientativo" />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Los puntos atenuados son tareas ya completadas.
          </p>
        </section>

        {/* Day panel appears below the calendar when a day is selected */}
        {selectedDate && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
                  Día seleccionado
                </p>
                <h2 className="mt-1 text-lg font-semibold capitalize text-white">{dayTitle}</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {dayTasks.length === 0 && dayDeadlines.length === 0
                    ? "Sin tareas ni plazos"
                    : `${dayTasks.length} ${dayTasks.length === 1 ? "tarea" : "tareas"}${
                        dayDeadlines.length ? ` · ${dayDeadlines.length} plazo(s)` : ""
                      }`}
                </p>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 transition hover:text-white hover:border-slate-700"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {dayDeadlines.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start gap-2.5 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                      Plazo fiscal orientativo
                    </div>
                    <div className="mt-0.5 text-sm text-slate-100">{d.title}</div>
                  </div>
                </div>
              ))}

              {dayTasks.length === 0 && dayDeadlines.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 py-8 text-center text-xs text-slate-500">
                  No hay tareas en este día. Añade una desde el panel de la derecha.
                </p>
              ) : (
                dayTasks.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 border-l-2",
                      t.priority === "urgente"
                        ? "border-l-rose-500"
                        : t.priority === "importante"
                          ? "border-l-amber-500"
                          : "border-l-emerald-500",
                    )}
                  >
                    <button
                      onClick={() => toggleTask.mutate(t)}
                      className={cn(
                        "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px] transition",
                        t.done
                          ? "border-emerald-500 bg-emerald-500 text-slate-950"
                          : "border-slate-700 hover:border-emerald-500",
                      )}
                      aria-label={t.done ? "Marcar pendiente" : "Marcar hecha"}
                    >
                      {t.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-sm leading-tight",
                          t.done ? "text-slate-500 line-through" : "text-slate-100",
                        )}
                      >
                        {t.title}
                      </div>
                      <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                        {t.priority}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask.mutate(t.id)}
                      className="shrink-0 p-1 text-slate-500 transition hover:text-rose-500"
                      aria-label="Eliminar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="mb-3 text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
              Nueva tarea
            </p>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="task-title" className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Título</label>
                <input
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Revisar facturas pendientes"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="task-date" className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fecha</label>
                <input
                  id="task-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 [color-scheme:dark]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Prioridad</span>
                <div className="flex gap-2">
                  {(["urgente", "importante", "rutinaria"] as Priority[]).map((p) => {
                    const selected = priority === p;
                    const dot =
                      p === "urgente" ? "bg-rose-500" : p === "importante" ? "bg-amber-500" : "bg-emerald-500";
                    const selCls =
                      p === "urgente"
                        ? "border-rose-500 bg-rose-500/10 text-rose-300"
                        : p === "importante"
                          ? "border-amber-500 bg-amber-500/10 text-amber-300"
                          : "border-emerald-500 bg-emerald-500/10 text-emerald-300";
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPriority(p)}
                        className={cn(
                          "flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-semibold capitalize transition",
                          selected
                            ? selCls
                            : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:border-slate-700",
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="submit"
                disabled={addTask.isPending}
                className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-indigo-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-60"
              >
                {addTask.isPending ? "Añadiendo…" : "Añadir tarea"}
              </button>
            </form>
            <p className="mt-3 text-[11px] text-slate-500">
              Doble clic en un día del calendario para ver todas sus tareas.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="mb-3 text-[10.5px] font-bold uppercase tracking-widest text-emerald-400">
              Próximos plazos orientativos
            </p>
            {upcomingDeadlines.length === 0 ? (
              <p className="py-3 text-xs text-slate-500">Sin plazos próximos.</p>
            ) : (
              upcomingDeadlines.map((f) => {
                const [y, m, d] = f.deadline_date.split("-");
                return (
                  <div
                    key={f.id}
                    className="flex items-start gap-2.5 border-b border-slate-800 py-2.5 last:border-b-0"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-100">{f.title}</div>
                      <div className="mt-0.5 text-[10.5px] text-slate-500">
                        {d} de {MESES[parseInt(m) - 1]} {y}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <p className="mt-3 text-[11px] text-slate-500">
              Listado orientativo. Verifica siempre en la AEAT antes de cada presentación.
            </p>
          </section>
        </div>
      </div>

    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={"h-1.5 w-1.5 rounded-full " + className} />
      <span>{label}</span>
    </div>
  );
}