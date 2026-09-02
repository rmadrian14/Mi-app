import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Home,
  FolderKanban,
  BookOpenCheck,
  Radar,
  LogOut,
  Gauge,
  Briefcase,
  CalendarDays,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import veractLogoVideo from "@/assets/veract-logo-intro-v2.mp4.asset.json";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { useActiveWorkspace } from "@/hooks/use-workspace";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const sections: { label: string; items: { title: string; url: string; icon: typeof FolderKanban }[] }[] = [
  {
    label: "Navegación",
    items: [
      { title: "Gestión de Proyectos", url: "/projects", icon: FolderKanban },
      { title: "Contabilidad", url: "/accounting", icon: BookOpenCheck },
      { title: "Organización", url: "/organization", icon: CalendarDays },
      { title: "Radar Autónomo", url: "/radar", icon: Radar },
      { title: "Ajustes", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { user } = useAuth();
  const router = useRouter();
  const { workspaces } = useActiveWorkspace();
  const showPortfolio = workspaces.length >= 2;
  const isActive = (path: string) => currentPath.startsWith(path);

  async function signOut() {
    await supabase.auth.signOut();
    router.invalidate();
  }

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-slate-800 bg-slate-950 text-slate-100 [&_[data-sidebar=sidebar]]:bg-slate-950 [&_[data-sidebar=sidebar]]:text-slate-100"
    >
      <SidebarHeader className="border-b border-slate-800 bg-slate-950 p-0">
        <div className={"relative w-full overflow-hidden bg-slate-950 " + (collapsed ? "h-12" : "h-24")}>
          <LogoIntroVideo src={veractLogoVideo.url} />
          {/* Feather edges into the sidebar background so the video's tone blends seamlessly */}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_28px_10px_rgb(2_6_23)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-slate-950 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-slate-950 to-transparent" />
          <button
            onClick={toggleSidebar}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-md bg-slate-900/70 text-slate-300 backdrop-blur transition hover:bg-slate-800 hover:text-white"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-slate-950 p-2">
        {user && <WorkspaceSwitcher collapsed={collapsed} />}
        <div className="mb-4">
          <nav className="flex flex-col gap-1">
            <Link
              to="/"
              title="Inicio"
              className={
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition " +
                (currentPath === "/"
                  ? "bg-gradient-to-r from-emerald-500/20 to-indigo-500/10 text-white ring-1 ring-emerald-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white")
              }
            >
              <Home className={"h-5 w-5 shrink-0 " + (currentPath === "/" ? "text-emerald-400" : "")} />
              {!collapsed && <span className="truncate">Inicio</span>}
            </Link>
          </nav>
        </div>
        {sections.map((section) => {
          const items = section.label === "Navegación" && showPortfolio
            ? [
                { title: "Cartera de clientes", url: "/portfolio", icon: Briefcase },
                ...section.items,
              ]
            : section.items;
          return (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {section.label}
              </div>
            )}
            <nav className="flex flex-col gap-1">
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <Link
                    key={item.title}
                    to={item.url}
                    title={item.title}
                    className={
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition " +
                      (active
                        ? "bg-gradient-to-r from-emerald-500/20 to-indigo-500/10 text-white ring-1 ring-emerald-500/30"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-white")
                    }
                  >
                    <item.icon className={"h-5 w-5 shrink-0 " + (active ? "text-emerald-400" : "")} />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-slate-800 bg-slate-950 p-2">
        {user && !collapsed && <PlanUsageCard userId={user.id} />}
        {user ? (
          <div className="flex items-center gap-2 rounded-lg bg-slate-900/60 px-2 py-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-indigo-500 text-xs font-bold text-white">
              {(user.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-slate-200">{user.email}</div>
              </div>
            )}
            <button
              onClick={signOut}
              title="Cerrar sesión"
              className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Link
            to="/auth"
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            {!collapsed && "Iniciar sesión"}
          </Link>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function PlanUsageCard({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<"basic" | "pro">("basic");
  const [limit, setLimit] = useState(10);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const [{ count: c }, { data: sub }] = await Promise.all([
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("usuario_id", userId)
          .gte("fecha_emision", start)
          .lt("fecha_emision", end),
        supabase
          .from("user_subscriptions")
          .select("plan_type, monthly_limit")
          .eq("id", userId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setCount(c ?? 0);
      if (sub) {
        setPlan((sub.plan_type as "basic" | "pro") ?? "basic");
        setLimit(sub.monthly_limit ?? 10);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const pct = Math.min(100, Math.round((count / Math.max(limit, 1)) * 100));
  const near = pct >= 80;

  return (
    <div className="mb-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <span className="flex items-center gap-1.5">
          <Gauge className="h-3 w-3 text-emerald-400" />
          Plan {plan === "pro" ? "Pro" : "Básico"}
        </span>
        <span className={near ? "text-amber-300" : "text-slate-500"}>
          {loading ? "…" : `${count}/${limit}`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={
            "h-full transition-all " +
            (near
              ? "bg-gradient-to-r from-amber-500 to-rose-500"
              : "bg-gradient-to-r from-emerald-500 to-indigo-500")
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-slate-500">Facturas este mes</div>
    </div>
  );
}

function LogoIntroVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const played = sessionStorage.getItem("veract-logo-played");
    if (played === "1") {
      // Skip straight to the last frame
      const jump = () => {
        try {
          v.currentTime = Math.max(0, (v.duration || 0) - 0.05);
        } catch {}
        v.pause();
        setEnded(true);
      };
      if (v.readyState >= 1) jump();
      else v.addEventListener("loadedmetadata", jump, { once: true });
      return;
    }
    v.play().catch(() => {});
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      playsInline
      preload="auto"
      onEnded={() => {
        setEnded(true);
        sessionStorage.setItem("veract-logo-played", "1");
        const v = videoRef.current;
        if (v) {
          try {
            v.currentTime = Math.max(0, (v.duration || 0) - 0.05);
          } catch {}
          v.pause();
        }
      }}
      className={
        "absolute inset-0 h-full w-full object-cover scale-125 transition-opacity duration-200 " +
        (ended ? "opacity-100" : "opacity-100")
      }
    />
  );
}