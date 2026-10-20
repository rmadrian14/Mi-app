import { ExternalLink, Newspaper, Radar } from "lucide-react";

type StaticArticle = {
  title: string;
  link: string;
  description: string;
};

const STATIC_ARTICLES: StaticArticle[] = [
  {
    title: "Regularización de cuotas de autónomos 2026",
    link: "https://www.escura.com/es/regularizacion-de-cuotas-de-autonomos-2026/",
    description:
      "Cómo la Seguridad Social ajustará las cuotas según los rendimientos netos reales del ejercicio y qué pasos seguir si te toca pagar o devolver diferencias.",
  },
  {
    title: "¿Qué es el RETA? Derechos y obligaciones de los autónomos",
    link: "https://www.elautonomo.es/es/reta",
    description:
      "Guía completa sobre el Régimen Especial de Trabajadores Autónomos: alta, cotización, prestaciones y obligaciones fiscales que debes conocer.",
  },
  {
    title: "Cuotas de autónomos en 2026: bases de cotización y tramos",
    link: "https://www.contasimple.com/blog/cuotas-autonomos-2026/",
    description:
      "Tabla actualizada con los 15 tramos de cotización por rendimiento neto, importes mensuales y cómo elegir la base que mejor se adapta a tu actividad.",
  },
  {
    title: "Ley Antifraude 2026: cómo adaptar tu facturación sin complicarte la vida",
    link: "https://www.caixaruralgalega.gal/es/empresas/ley-antifraude-2026-como-adaptar-tu-facturacion-sin-complicarte-vida",
    description:
      "Pasos prácticos para cumplir con la nueva normativa antifraude: software de facturación certificado, registros inalterables y obligaciones técnicas.",
  },
  {
    title: "Ley 11/2021 Antifraude: Guía para adaptarte a la nueva normativa y prevenir el fraude fiscal",
    link: "https://getrenn.com/es/blog/ley-antifraude",
    description:
      "Análisis detallado de la Ley 11/2021: limitaciones a pagos en efectivo, requisitos de los sistemas informáticos y sanciones por incumplimiento.",
  },
  {
    title: "¿Qué es el Ingreso Mínimo Vital?",
    link: "https://www.inclusion.gob.es/web/inclusion/ingreso-minimo-vital/que-es",
    description:
      "Información oficial del Ministerio sobre la prestación no contributiva diseñada para garantizar unos ingresos mínimos a personas en situación de vulnerabilidad.",
  },
  {
    title: "Requisitos para el Ingreso Mínimo Vital [2026] - IMV",
    link: "https://taxdown.es/ingreso-minimo-vital/requisitos",
    description:
      "Quién puede solicitar el IMV en 2026: umbrales de renta, patrimonio máximo, unidades de convivencia y documentación necesaria para tramitar la ayuda.",
  },
];

export function RadarAutonomoView() {
  const openArticle = (link: string) => {
    window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <Radar className="h-6 w-6 text-emerald-400" /> Radar Autónomo
        </h1>
        <p className="text-sm text-slate-400">
          Recursos clave seleccionados para autónomos: fiscalidad, cotización y ayudas.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {STATIC_ARTICLES.map((it) => (
          <article
            key={it.link}
            onClick={() => openArticle(it.link)}
            className="flex cursor-pointer flex-col rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-emerald-500/40"
          >
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-emerald-400">
              <Newspaper className="h-3.5 w-3.5" />
              Recurso destacado
            </div>
            <h2 className="mb-2 text-base font-semibold leading-snug text-white">
              {it.title}
            </h2>
            <p className="mb-4 line-clamp-3 text-sm text-slate-400">
              {it.description}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openArticle(it.link);
              }}
              className="mt-auto inline-flex cursor-pointer items-center gap-1.5 self-start rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              Leer artículo completo <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
