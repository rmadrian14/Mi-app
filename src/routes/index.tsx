import { createFileRoute, Link } from "@tanstack/react-router";
import negocioIcon from "@/assets/icons/negocio.webp";
import entrenamientoIcon from "@/assets/icons/entrenamiento.webp";
import planificacionIcon from "@/assets/icons/planificacion.webp";
import alimentacionIcon from "@/assets/icons/alimentacion.webp";

export const Route = createFileRoute("/")({
  component: Index,
});

const MODULES = [
  {
    to: "/accounting",
    title: "Negocio",
    description: "Facturación, contabilidad y gestión de tu actividad profesional.",
    image: negocioIcon,
  },
  {
    to: "/training",
    title: "Entrenamiento",
    description: "Planifica y sigue tus rutinas de entrenamiento.",
    image: entrenamientoIcon,
  },
  {
    to: "/planning",
    title: "Planificación",
    description: "Organiza tu agenda y tus tareas del día a día.",
    image: planificacionIcon,
  },
  {
    to: "/nutrition",
    title: "Alimentación",
    description: "Controla tus comidas y tus objetivos nutricionales.",
    image: alimentacionIcon,
  },
] as const;

function Index() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-3xl">
        <header className="mb-10 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">¿Qué quieres abrir?</h1>
          <p className="mt-2 text-sm text-slate-400">Elige un módulo para empezar.</p>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MODULES.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="group flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:border-emerald-500/40 hover:bg-slate-900/80"
            >
              <span className="block h-20 w-20 overflow-hidden">
                <img src={m.image} alt="" width={80} height={80} className="h-full w-full object-cover" />
              </span>
              <h2 className="text-lg font-semibold text-white">{m.title}</h2>
              <p className="text-sm text-slate-400">{m.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
