import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Check, ChevronsUpDown, Plus, Settings2 } from "lucide-react";
import { useActiveWorkspace } from "@/hooks/use-workspace";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { workspace, workspaces, setActive, loading } = useActiveWorkspace();
  const [open, setOpen] = useState(false);

  if (loading && !workspace) {
    return (
      <div className={"mx-2 mb-3 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-2 text-xs text-slate-500 " + (collapsed ? "hidden" : "")}>
        Cargando NIF…
      </div>
    );
  }

  return (
    <div className="mx-2 mb-3">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          className={
            "flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-800/80"
          }
          title={workspace?.name ?? "Sin NIF"}
        >
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-to-br from-indigo-500/30 to-emerald-500/20 text-emerald-300">
            <Building2 className="h-4 w-4" />
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-white">
                  {workspace?.name ?? "Sin NIF"}
                </div>
                <div className="truncate text-[10px] text-slate-500">
                  {workspace?.nif || "Sin NIF asignado"}
                  {workspace?.role ? ` · ${workspace.role}` : ""}
                </div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 bg-slate-950 text-slate-100">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500">
            Cambiar NIF activo
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-800" />
          {workspaces.length === 0 && (
            <div className="px-2 py-3 text-xs text-slate-500">No hay NIFs disponibles.</div>
          )}
          {workspaces.map((w) => {
            const active = w.id === workspace?.id;
            return (
              <DropdownMenuItem
                key={w.id}
                onSelect={() => setActive(w.id)}
                className="flex items-start gap-2 focus:bg-slate-800"
              >
                <div className="mt-0.5 h-4 w-4 shrink-0">
                  {active && <Check className="h-4 w-4 text-emerald-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-white">{w.name}</div>
                  <div className="truncate text-[10px] text-slate-500">
                    {w.nif || "Sin NIF"} · {w.role}
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator className="bg-slate-800" />
          <DropdownMenuItem asChild className="focus:bg-slate-800">
            <Link to="/workspaces" className="flex items-center gap-2 text-xs text-slate-200">
              <Plus className="h-3.5 w-3.5 text-emerald-400" />
              Añadir o gestionar NIFs
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="focus:bg-slate-800">
            <Link to="/workspaces" className="flex items-center gap-2 text-xs text-slate-200">
              <Settings2 className="h-3.5 w-3.5 text-slate-400" />
              Ajustes del NIF activo
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}