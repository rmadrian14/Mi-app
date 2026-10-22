import { createFileRoute, redirect } from "@tanstack/react-router";

// La planificación (calendario de eventos y tareas) vive en Organización: esta dirección, que sigue
// enlazada desde la portada, lleva allí.
export const Route = createFileRoute("/_authenticated/planning")({
  beforeLoad: () => {
    throw redirect({ to: "/organization" });
  },
});
