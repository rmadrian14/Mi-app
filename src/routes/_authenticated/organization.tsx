import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { CalendarioApp, type CapaExterna } from "@/components/calendar/calendario-app";
import { useAlmacenSupabase, useAvisosCalendario, useCapaEntreno, useCapaFiscal, type Rango } from "@/hooks/use-calendar";
import type { ItemExterno } from "@/lib/calendar";

export const Route = createFileRoute("/_authenticated/organization")({
  head: () => ({
    meta: [
      { title: "Organización · Veract" },
      { name: "description", content: "Calendario de eventos y tareas, con repeticiones, avisos y plazos fiscales." },
    ],
  }),
  component: OrganizationPage,
});

const CAPAS: CapaExterna[] = [
  { clave: "fiscal", nombre: "Plazos fiscales", color: "cian", porDefecto: true },
  { clave: "entreno", nombre: "Entrenamiento", color: "esmeralda", porDefecto: false },
];

// Las capas de solo lectura que se pueden mostrar encima de tus eventos.
function useExternos(rango: Rango, visibles: Record<string, boolean>): ItemExterno[] {
  const fiscal = useCapaFiscal(rango, !!visibles.fiscal);
  const entreno = useCapaEntreno(rango, !!visibles.entreno);
  return useMemo(() => [...fiscal, ...entreno], [fiscal, entreno]);
}

function OrganizationPage() {
  useAvisosCalendario();
  return <CalendarioApp useAlmacen={useAlmacenSupabase} useExternos={useExternos} capasExternas={CAPAS} />;
}
