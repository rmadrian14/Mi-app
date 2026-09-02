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
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/hooks/use-theme";
import { BookOpenCheck, FolderKanban, BarChart3, Radar } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Calculadora Freelance Feliz helps freelancers calculate hourly rates and project budgets." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Calculadora Freelance Feliz helps freelancers calculate hourly rates and project budgets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "Calculadora Freelance Feliz helps freelancers calculate hourly rates and project budgets." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0f59ec7f-3acd-4303-ac56-d7dbb1051d83/id-preview-e53f8843--68809dea-f0f2-4f6d-8666-fa3b73314ae2.lovable.app-1782469444887.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0f59ec7f-3acd-4303-ac56-d7dbb1051d83/id-preview-e53f8843--68809dea-f0f2-4f6d-8666-fa3b73314ae2.lovable.app-1782469444887.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-slate-950">
        <AppSidebar />
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
  { to: "/", label: "Simulador de Tarifas", icon: BarChart3 },
  { to: "/radar", label: "Radar Autónomo", icon: Radar },
] as const;

function GlobalTabsNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const operational = ["/", "/projects", "/accounting", "/radar"];
  if (!operational.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)))) {
    return null;
  }
  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);
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
