import { createFileRoute, Link } from '@tanstack/react-router';
import { Check, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLAN_CATALOG, type PlanPriceId } from '@/lib/stripe';

export const Route = createFileRoute('/_authenticated/pricing')({
  component: PricingPage,
  head: () => ({ meta: [{ title: 'Suscripción · Estimac' }] }),
});

const PLAN_FEATURES: Record<PlanPriceId, string[]> = {
  basico_monthly: [
    'Hasta 50 facturas Verifactu/mes',
    'Envío legal a la AEAT',
    'Gestión de proyectos y contabilidad',
    'Soporte por email',
  ],
  intermedio_monthly: [
    'Hasta 250 facturas Verifactu/mes',
    'Todo lo del plan Básico',
    'Exportaciones para gestoría',
    'Aviso al alcanzar el 90% del límite',
  ],
  pro_monthly: [
    'Hasta 2.500 facturas Verifactu/mes',
    'Sin bloqueo al alcanzar el límite',
    'Bloques adicionales de 500 facturas por 2 €',
    'Prioridad en soporte',
  ],
};

function PricingPage() {
  return (
    <div className="min-h-full w-full bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Elige tu plan</h1>
            <p className="mt-2 text-slate-400">
              Suscríbete para activar Gestión de Proyectos y Contabilidad. El Radar Autónomo
              sigue siendo gratuito.
            </p>
          </div>
          <Link to="/accounting" className="text-sm text-slate-400 hover:text-slate-200 inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </div>

        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Los pagos están temporalmente desactivados mientras terminamos las pruebas internas. Podrás suscribirte cuando lancemos la versión final.
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {(Object.keys(PLAN_CATALOG) as PlanPriceId[]).map((pid) => {
            const plan = PLAN_CATALOG[pid];
            const featured = pid === 'intermedio_monthly';
            return (
              <div
                key={pid}
                className={`relative flex flex-col rounded-2xl border p-6 transition ${
                  featured
                    ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-indigo-500/10 shadow-lg'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 right-4 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">
                    Más popular
                  </span>
                )}
                <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                <div className="mt-1 text-3xl font-bold text-white">{plan.price}</div>
                <p className="mt-1 text-xs text-slate-400">
                  Hasta {plan.limit.toLocaleString('es-ES')} facturas mensuales
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-300">
                  {PLAN_FEATURES[pid].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  disabled
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Disponible en el lanzamiento
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}