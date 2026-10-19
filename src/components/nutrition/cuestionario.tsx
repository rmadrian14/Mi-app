import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, UtensilsCrossed } from "lucide-react";
import type { PersonalProfile } from "@/hooks/use-training";
import { fmt, btnPrimary, btnSecondary, Aviso, Card } from "./common";
import {
  ActividadCampos,
  DatosCorporalesCampos,
  ExplicacionObjetivos,
  ObjetivoCampos,
  RestriccionesCampos,
  calcularDesdeDatos,
  validarActividad,
  validarDatosCorporales,
  type DatosCuestionario,
} from "./objetivos-campos";
import type { ResultadoObjetivos, Sexo } from "@/lib/nutrition";

const PASOS = ["Tus datos", "Tu actividad", "Tu objetivo", "Resultado"];

export function Cuestionario({
  personal,
  diasEntrenoInicial,
  onFinish,
}: {
  personal: PersonalProfile | null;
  diasEntrenoInicial: number;
  onFinish: (datos: DatosCuestionario, resultado: ResultadoObjetivos) => Promise<void>;
}) {
  const [paso, setPaso] = useState(0);
  const [d, setD] = useState<DatosCuestionario>({
    sexo: (personal?.sexo as Sexo | null) ?? "",
    edad: personal?.edad != null ? String(personal.edad) : "",
    peso: personal?.peso_kg != null ? String(personal.peso_kg) : "",
    altura: personal?.altura_cm != null ? String(personal.altura_cm) : "",
    nivel: "ligero",
    diasEntreno: diasEntrenoInicial,
    comidasPorDia: 4,
    objetivo: "recomposicion",
    ritmo: "moderado",
    restricciones: [],
    excluidos: "",
    kcalMantenimiento: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const set = (patch: Partial<DatosCuestionario>) => setD((prev) => ({ ...prev, ...patch }));

  const resultado = useMemo(() => (paso === 3 ? calcularDesdeDatos(d) : null), [paso, d]);

  function siguiente() {
    const e = paso === 0 ? validarDatosCorporales(d) : paso === 1 ? validarActividad(d) : null;
    if (e) {
      setError(e);
      return;
    }
    setError(null);
    setPaso((p) => p + 1);
  }

  async function finalizar() {
    if (!resultado) return;
    setGuardando(true);
    setError(null);
    try {
      await onFinish(d, resultado);
    } catch (err) {
      setError((err as Error).message || "No se ha podido guardar.");
      setGuardando(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-lg">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" /> Volver a inicio
        </Link>
        <header className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 ring-1 ring-emerald-500/30">
            <UtensilsCrossed className="h-7 w-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Alimentación</h1>
          <p className="mt-1 text-sm text-slate-400">
            Unas preguntas para calcular tus calorías y macros. Luego podrás editarlos.
          </p>
        </header>

        <div className="mb-4 flex gap-1.5">
          {PASOS.map((p, i) => (
            <div key={p} className="flex-1">
              <div className={"h-1 rounded-full " + (i <= paso ? "bg-emerald-500" : "bg-slate-800")} />
              <p className={"mt-1 text-[10px] " + (i === paso ? "font-semibold text-slate-200" : "text-slate-600")}>
                {p}
              </p>
            </div>
          ))}
        </div>

        <Card>
          {paso === 0 && <DatosCorporalesCampos d={d} set={set} />}
          {paso === 1 && <ActividadCampos d={d} set={set} />}
          {paso === 2 && (
            <div className="space-y-4">
              <ObjetivoCampos d={d} set={set} />
              <RestriccionesCampos d={d} set={set} />
            </div>
          )}
          {paso === 3 && resultado && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Calorías", fmt(resultado.kcal), "kcal"],
                  ["Proteína", fmt(resultado.proteina_g), "g"],
                  ["Grasa", fmt(resultado.grasa_g), "g"],
                  ["Hidratos", fmt(resultado.hidratos_g), "g"],
                ].map(([etiqueta, valor, unidad]) => (
                  <div key={etiqueta} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{etiqueta}</p>
                    <p className="mt-1 text-xl font-bold text-white">{valor}</p>
                    <p className="text-[10px] text-slate-600">{unidad}/día</p>
                  </div>
                ))}
              </div>
              <ExplicacionObjetivos r={resultado} d={d} />
            </div>
          )}
          {error && (
            <div className="mt-4">
              <Aviso tono="rojo">{error}</Aviso>
            </div>
          )}
        </Card>

        <div className="mt-4 flex justify-between gap-2">
          {paso > 0 ? (
            <button type="button" onClick={() => setPaso((p) => p - 1)} className={btnSecondary} disabled={guardando}>
              Atrás
            </button>
          ) : (
            <span />
          )}
          {paso < 3 ? (
            <button type="button" onClick={siguiente} className={btnPrimary}>
              Siguiente
            </button>
          ) : (
            <button type="button" onClick={finalizar} className={btnPrimary} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar y empezar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
