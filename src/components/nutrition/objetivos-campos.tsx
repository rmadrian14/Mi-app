import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  NIVELES_ACTIVIDAD,
  OBJETIVOS,
  RESTRICCIONES,
  calcularObjetivos,
  type NivelActividad,
  type ObjetivoNutricional,
  type ResultadoObjetivos,
  type Ritmo,
  type Sexo,
} from "@/lib/nutrition";
import { Aviso, ChoiceCard, Field, fmt, inputCls } from "./common";

export type DatosCuestionario = {
  sexo: Sexo | "";
  edad: string;
  peso: string;
  altura: string;
  nivel: NivelActividad;
  diasEntreno: number;
  comidasPorDia: number;
  objetivo: ObjetivoNutricional;
  ritmo: Ritmo;
  restricciones: string[];
  excluidos: string;
  // Calorías de mantenimiento que ya conoce (vacío = estimarlas).
  kcalMantenimiento: string;
};

export function parseMantenimiento(texto: string): number | null {
  const n = parseInt(texto.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function validarActividad(d: DatosCuestionario): string | null {
  if (!d.kcalMantenimiento.trim()) return null;
  const n = parseMantenimiento(d.kcalMantenimiento);
  if (n === null || n < 1000 || n > 6000) return "Las calorías de mantenimiento deben estar entre 1.000 y 6.000 kcal (o déjalo vacío).";
  return null;
}

export function validarDatosCorporales(d: DatosCuestionario): string | null {
  const edad = parseInt(d.edad, 10);
  const peso = parseFloat(d.peso.replace(",", "."));
  const altura = parseFloat(d.altura.replace(",", "."));
  if (!d.sexo) return "Indica tu sexo (la fórmula de gasto en reposo lo necesita).";
  if (!(edad >= 14 && edad <= 100)) return "La edad debe estar entre 14 y 100 años.";
  if (!(peso >= 30 && peso <= 300)) return "El peso debe estar entre 30 y 300 kg.";
  if (!(altura >= 120 && altura <= 230)) return "La altura debe estar entre 120 y 230 cm.";
  return null;
}

export function calcularDesdeDatos(d: DatosCuestionario): ResultadoObjetivos | null {
  if (validarDatosCorporales(d) || validarActividad(d)) return null;
  return calcularObjetivos({
    sexo: d.sexo as Sexo,
    edad: parseInt(d.edad, 10),
    pesoKg: parseFloat(d.peso.replace(",", ".")),
    alturaCm: parseFloat(d.altura.replace(",", ".")),
    nivelActividad: d.nivel,
    diasEntreno: d.diasEntreno,
    objetivo: d.objetivo,
    ritmo: d.ritmo,
    kcalMantenimiento: parseMantenimiento(d.kcalMantenimiento),
  });
}

type SetDatos = (patch: Partial<DatosCuestionario>) => void;

export function DatosCorporalesCampos({ d, set }: { d: DatosCuestionario; set: SetDatos }) {
  return (
    <div className="space-y-4">
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Sexo</span>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <ChoiceCard active={d.sexo === "hombre"} onClick={() => set({ sexo: "hombre" })} title="Hombre" />
          <ChoiceCard active={d.sexo === "mujer"} onClick={() => set({ sexo: "mujer" })} title="Mujer" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Edad">
          <input
            inputMode="numeric"
            value={d.edad}
            onChange={(e) => set({ edad: e.target.value })}
            placeholder="28"
            className={inputCls}
          />
        </Field>
        <Field label="Peso (kg)">
          <input
            inputMode="decimal"
            value={d.peso}
            onChange={(e) => set({ peso: e.target.value })}
            placeholder="75"
            className={inputCls}
          />
        </Field>
        <Field label="Altura (cm)">
          <input
            inputMode="decimal"
            value={d.altura}
            onChange={(e) => set({ altura: e.target.value })}
            placeholder="178"
            className={inputCls}
          />
        </Field>
      </div>
    </div>
  );
}

export function ActividadCampos({ d, set }: { d: DatosCuestionario; set: SetDatos }) {
  return (
    <div className="space-y-4">
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Tu día a día, sin contar el gimnasio
        </span>
        <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {NIVELES_ACTIVIDAD.map((n) => (
            <ChoiceCard
              key={n.id}
              active={d.nivel === n.id}
              onClick={() => set({ nivel: n.id })}
              title={n.label}
              detail={n.detalle}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Días de entreno a la semana">
          <select
            value={d.diasEntreno}
            onChange={(e) => set({ diasEntreno: parseInt(e.target.value, 10) })}
            className={inputCls}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Comidas al día">
          <select
            value={d.comidasPorDia}
            onChange={(e) => set({ comidasPorDia: parseInt(e.target.value, 10) })}
            className={inputCls}
          >
            {[3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="Calorías de mantenimiento (opcional)"
        hint="Si ya sabes cuántas kcal al día comes cuando tu peso se mantiene estable, indícalo: es más fiable que cualquier estimación. Si no, déjalo vacío."
      >
        <input
          inputMode="numeric"
          value={d.kcalMantenimiento}
          onChange={(e) => set({ kcalMantenimiento: e.target.value.replace(/[^\d]/g, "") })}
          placeholder="Ej.: 2700"
          className={inputCls}
        />
      </Field>
    </div>
  );
}

export function ObjetivoCampos({ d, set }: { d: DatosCuestionario; set: SetDatos }) {
  const admiteRitmo = d.objetivo === "perder_grasa" || d.objetivo === "ganar_musculo";
  return (
    <div className="space-y-4">
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Objetivo</span>
        <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OBJETIVOS.map((o) => (
            <ChoiceCard
              key={o.id}
              active={d.objetivo === o.id}
              onClick={() => set({ objetivo: o.id })}
              title={o.label}
              detail={o.detalle}
            />
          ))}
        </div>
      </div>
      {admiteRitmo && (
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Ritmo</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <ChoiceCard
              active={d.ritmo === "suave"}
              onClick={() => set({ ritmo: "suave" })}
              title="Suave"
              detail={d.objetivo === "perder_grasa" ? "≈0,5 % del peso por semana" : "≈ +10 % de calorías"}
            />
            <ChoiceCard
              active={d.ritmo === "moderado"}
              onClick={() => set({ ritmo: "moderado" })}
              title="Moderado"
              detail={d.objetivo === "perder_grasa" ? "≈0,75 % del peso por semana" : "≈ +15 % de calorías"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function RestriccionesCampos({ d, set }: { d: DatosCuestionario; set: SetDatos }) {
  const [abierto, setAbierto] = useState(d.restricciones.length > 0 || !!d.excluidos);
  function toggle(id: string) {
    set({
      restricciones: d.restricciones.includes(id)
        ? d.restricciones.filter((r) => r !== id)
        : [...d.restricciones, id],
    });
  }
  const grupos: { titulo: string; grupo: "dieta" | "alergeno" }[] = [
    { titulo: "Tipo de dieta", grupo: "dieta" },
    { titulo: "Alergias e intolerancias", grupo: "alergeno" },
  ];
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-sm font-semibold text-slate-200">
          Restricciones alimentarias{" "}
          <span className="text-xs font-normal text-slate-500">
            (opcional{d.restricciones.length ? ` · ${d.restricciones.length} marcadas` : ""})
          </span>
        </span>
        <ChevronDown className={"h-4 w-4 text-slate-500 transition " + (abierto ? "rotate-180" : "")} />
      </button>
      {abierto && (
        <div className="space-y-4 border-t border-slate-800 px-3 py-3">
          {grupos.map((g) => (
            <div key={g.grupo}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{g.titulo}</p>
              <div className="flex flex-wrap gap-1.5">
                {RESTRICCIONES.filter((r) => r.grupo === g.grupo).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggle(r.id)}
                    className={
                      "rounded-full border px-2.5 py-1 text-[11.5px] transition " +
                      (d.restricciones.includes(r.id)
                        ? "border-indigo-500 bg-indigo-500/15 text-indigo-200"
                        : "border-slate-800 text-slate-400 hover:text-white")
                    }
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Field label="Alimentos que no quiero" hint="Separados por comas. Ej.: coliflor, atún">
            <input
              value={d.excluidos}
              onChange={(e) => set({ excluidos: e.target.value })}
              className={inputCls}
              placeholder="coliflor, atún"
            />
          </Field>
          <Aviso tono="gris">
            Las marcas de alérgenos de los alimentos incluidos son orientativas. Los alimentos que añadas tú hay que
            etiquetarlos a mano, y esta app no sustituye el consejo de un profesional sanitario.
          </Aviso>
        </div>
      )}
    </div>
  );
}

export function ExplicacionObjetivos({ r, d }: { r: ResultadoObjetivos; d: DatosCuestionario }) {
  const peso = parseFloat(d.peso.replace(",", "."));
  const deficit = d.objetivo === "perder_grasa";
  return (
    <div className="space-y-2 text-xs text-slate-400">
      <p>
        <span className="font-semibold text-slate-200">Gasto en reposo:</span> {fmt(r.tmb)} kcal (ecuación de
        Mifflin-St Jeor, la mejor validada según la revisión de la Academia de Nutrición y Dietética).
      </p>
      <p>
        <span className="font-semibold text-slate-200">Gasto total:</span> {fmt(r.tdee)} kcal ={" "}
        {r.gastoIndicado ? (
          <>el mantenimiento que has indicado (equivale a reposo × {fmt(r.pal, 2)}).</>
        ) : (
          <>
            reposo × {fmt(r.pal, 2)} (nivel de actividad FAO/OMS más tus {d.diasEntreno} días de entreno; las pesas se
            cuentan como ~80 % del gasto del ejercicio aeróbico, que es lo que usa el informe FAO).
          </>
        )}
      </p>
      <p>
        <span className="font-semibold text-slate-200">Calorías objetivo:</span> {fmt(r.kcal)} kcal (
        {r.ajustePct > 0 ? "+" : ""}
        {fmt(r.ajustePct, 1)} % sobre tu gasto).
      </p>
      <p>
        <span className="font-semibold text-slate-200">Proteína:</span> {fmt(r.proteina_g)} g (
        {fmt(r.proteina_g / peso, 1)} g/kg;{" "}
        {deficit
          ? "más alta en déficit para conservar músculo"
          : d.objetivo === "recomposicion"
            ? "en la parte alta del rango 1,4–2,0 g/kg"
            : "dentro del rango 1,4–2,0 g/kg"}
        ).
      </p>
      <p>
        <span className="font-semibold text-slate-200">Grasa:</span> {fmt(r.grasa_g)} g (≈{deficit ? "25" : "30"} % de
        las calorías, nunca menos de 0,6 g/kg) · <span className="font-semibold text-slate-200">Hidratos:</span>{" "}
        {fmt(r.hidratos_g)} g ({fmt(r.hidratos_g / peso, 1)} g/kg; es lo que queda).
      </p>
      <p className="text-[11px] text-slate-500">
        Como orientación, las guías deportivas sitúan los hidratos en 3–5 g/kg con actividad ligera y en 5–7 g/kg con
        ~1 h diaria de ejercicio moderado. Si te parecen demasiados, sube la grasa o baja las calorías en el perfil.
      </p>
      {r.advertencias.map((a) => (
        <Aviso key={a}>{a}</Aviso>
      ))}
      <p className="text-[11px] text-slate-600">
        Son estimaciones de partida (la precisión individual de estas fórmulas es limitada). Lo que las corrige de
        verdad es cómo evoluciona tu peso en 2-3 semanas.
      </p>
    </div>
  );
}
