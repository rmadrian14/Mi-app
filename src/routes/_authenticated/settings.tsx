import { createFileRoute } from "@tanstack/react-router";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes · Veract" },
      { name: "description", content: "Ajustes de la aplicación: tema, apariencia y preferencias." },
      { property: "og:title", content: "Ajustes · Veract" },
      { property: "og:description", content: "Ajustes de la aplicación: tema, apariencia y preferencias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();

  const options: { value: "dark" | "light"; label: string; icon: typeof Sun; desc: string }[] = [
    { value: "dark", label: "Modo oscuro", icon: Moon, desc: "Colores profundos, ideal en entornos con poca luz." },
    { value: "light", label: "Modo claro", icon: Sun, desc: "Colores claros, más contraste con luz ambiental." },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Monitor className="h-5 w-5 text-emerald-400" />
        <h1 className="text-2xl font-bold">Ajustes</h1>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Apariencia
        </h2>
        <p className="mb-4 text-sm text-slate-400">Elige el tema de la interfaz.</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={
                  "flex items-start gap-3 rounded-lg border p-4 text-left transition " +
                  (active
                    ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                    : "border-slate-800 bg-slate-900/40 hover:bg-slate-800/60")
                }
              >
                <div className={"grid h-10 w-10 shrink-0 place-items-center rounded-md " + (active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-300")}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{opt.label}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{opt.desc}</div>
                </div>
                <div className={"mt-1 h-3 w-3 shrink-0 rounded-full " + (active ? "bg-emerald-400" : "border border-slate-600")} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}