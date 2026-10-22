import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/app-sidebar";
import { mostrarBarraDeNegocio } from "@/lib/rutas";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/hooks/use-theme";
import { BookOpenCheck, FolderKanban, Radar } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o se ha movido.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página no se ha cargado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo ha fallado por nuestra parte. Puedes volver a intentarlo o ir al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#020617" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Veract" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: "Veract" },
      { name: "description", content: "Veract: negocio, entrenamiento, planificación y alimentación en una sola app personal." },
      { property: "og:title", content: "Veract" },
      { property: "og:description", content: "Veract: negocio, entrenamiento, planificación y alimentación en una sola app personal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Veract" },
      { name: "twitter:description", content: "Veract: negocio, entrenamiento, planificación y alimentación en una sola app personal." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppShell />
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showSidebar = mostrarBarraDeNegocio(pathname);
  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-slate-950">
        {showSidebar && <AppSidebar />}
        <main className="flex-1 min-w-0 bg-slate-950 text-slate-100">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}

const GLOBAL_TABS = [
  { to: "/projects", label: "Gestión de Proyectos", icon: FolderKanban },
  { to: "/accounting", label: "Contabilidad", icon: BookOpenCheck },
  { to: "/radar", label: "Radar Autónomo", icon: Radar },
] as const;

function GlobalTabsNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const operational = ["/projects", "/accounting", "/radar"];
  if (!operational.some((p) => pathname.startsWith(p))) {
    return null;
  }
  const isActive = (to: string) => pathname.startsWith(to);
  return (
    <div className="border-b border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/75 sticky top-0 z-30">
      <nav className="mx-auto flex w-full max-w-7xl flex-wrap gap-1 px-3 py-2 sm:px-6 lg:px-8">
        {GLOBAL_TABS.map((t) => {
          const Icon = t.icon;
          const active = isActive(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={
                "flex flex-1 min-w-[160px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition " +
                (active
                  ? "bg-gradient-to-r from-emerald-500/25 to-indigo-500/15 text-white ring-1 ring-emerald-500/40"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white")
              }
            >
              <Icon className={"h-4 w-4 " + (active ? "text-emerald-400" : "text-slate-400")} />
              <span className="truncate">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
