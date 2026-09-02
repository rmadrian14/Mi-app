// Feature flag: cuestionario inicial del emisor.
// Ponlo en `true` para que los usuarios con perfil incompleto sean redirigidos
// automáticamente a /onboarding al entrar. Mientras esté en `false`, la ruta
// existe (puedes visitarla manualmente para probarla) pero nadie es forzado.
export const ONBOARDING_ENABLED = false;

// Campos mínimos que consideramos "perfil completo" (validación flexible).
export type MinimalCompanyProfile = {
  legal_name?: string | null;
  nif?: string | null;
  territorio?: string | null;
  email?: string | null;
  onboarding_completed?: boolean | null;
};

export function isProfileComplete(p: MinimalCompanyProfile | null | undefined): boolean {
  if (!p) return false;
  if (p.onboarding_completed) return true;
  return Boolean(
    (p.legal_name ?? "").trim() &&
    (p.nif ?? "").trim() &&
    (p.territorio ?? "").trim() &&
    (p.email ?? "").trim(),
  );
}