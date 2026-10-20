import { createFileRoute } from "@tanstack/react-router";
import { RadarAutonomoView } from "@/components/radar-autonomo";

export const Route = createFileRoute("/_authenticated/radar")({
  component: RadarPage,
  head: () => ({ meta: [{ title: "Radar Autónomo · Veract" }] }),
});

function RadarPage() {
  return (
    <div className="min-h-full w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <RadarAutonomoView />
      </div>
    </div>
  );
}
