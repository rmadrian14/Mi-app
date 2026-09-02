import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const LS_KEY = "veract-active-workspace";

export type Workspace = {
  id: string;
  name: string;
  nif: string | null;
  owner_user_id: string;
  role?: "owner" | "admin" | "gestor" | "viewer";
};

// Module-level cache: workspaces per user id, and current active id.
let cachedForUser: string | null = null;
let cachedWorkspaces: Workspace[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

async function loadWorkspaces(userId: string): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces:workspace_id ( id, name, nif, owner_user_id )")
    .eq("user_id", userId);
  if (error) throw error;
  const rows = (data ?? [])
    .map((r: any) => r.workspaces ? { ...r.workspaces, role: r.role } as Workspace : null)
    .filter(Boolean) as Workspace[];
  return rows;
}

/**
 * Returns the active workspace id + list of workspaces the current user belongs to.
 * Persists the choice in localStorage. Falls back to the first workspace.
 */
export function useActiveWorkspace() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>(cachedForUser === user?.id ? cachedWorkspaces : []);
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(LS_KEY);
  });
  const [loading, setLoading] = useState(!user ? false : cachedForUser !== user?.id);

  useEffect(() => {
    const l = () => {
      setWorkspaces([...cachedWorkspaces]);
    };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setWorkspaces([]);
      setActiveId(null);
      setLoading(false);
      cachedForUser = null;
      cachedWorkspaces = [];
      return;
    }
    if (cachedForUser === user.id && cachedWorkspaces.length) {
      setWorkspaces(cachedWorkspaces);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadWorkspaces(user.id).then((ws) => {
      if (cancelled) return;
      cachedForUser = user.id;
      cachedWorkspaces = ws;
      setWorkspaces(ws);
      notify();
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Reconcile active id when workspaces change.
  useEffect(() => {
    if (!workspaces.length) return;
    if (!activeId || !workspaces.find((w) => w.id === activeId)) {
      const next = workspaces[0].id;
      setActiveId(next);
      try { window.localStorage.setItem(LS_KEY, next); } catch {}
    }
  }, [workspaces, activeId]);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    try { window.localStorage.setItem(LS_KEY, id); } catch {}
  }, []);

  const active = workspaces.find((w) => w.id === activeId) ?? null;
  return {
    workspaceId: active?.id ?? null,
    workspace: active,
    workspaces,
    role: active?.role ?? null,
    canWrite: active?.role ? active.role !== "viewer" : false,
    loading,
    setActive,
  };
}

/**
 * Synchronous read of the current active workspace id.
 * Useful in imperative code paths where a hook doesn't fit.
 */
export function getActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LS_KEY);
}

/**
 * Imperative resolver: returns the active workspace id, fetching from the DB
 * if not yet cached. Used from mutation handlers where a hook isn't available.
 */
export async function resolveActiveWorkspaceId(userId: string): Promise<string> {
  const cached = getActiveWorkspaceId();
  if (cached && cachedForUser === userId && cachedWorkspaces.some((w) => w.id === cached)) {
    return cached;
  }
  if (cachedForUser !== userId || cachedWorkspaces.length === 0) {
    cachedWorkspaces = await loadWorkspaces(userId);
    cachedForUser = userId;
    notify();
  }
  const chosen =
    (cached && cachedWorkspaces.find((w) => w.id === cached)?.id) ||
    cachedWorkspaces[0]?.id;
  if (!chosen) throw new Error("No hay ningún workspace disponible para este usuario.");
  try { window.localStorage.setItem(LS_KEY, chosen); } catch {}
  return chosen;
}