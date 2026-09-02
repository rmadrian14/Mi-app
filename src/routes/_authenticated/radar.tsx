import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/routes/index";

export const Route = createFileRoute("/_authenticated/radar")({
  component: RadarPage,
  head: () => ({ meta: [{ title: "Radar Autónomo · Estimac" }] }),
});

function RadarPage() {
  return <Dashboard tab="radar" />;
}