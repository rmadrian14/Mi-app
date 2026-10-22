// Rutas que NO llevan el menú lateral de Negocio: el selector de módulos y los módulos propios
// (Entrenamiento, Alimentación, Organización). Todo lo demás es "Negocio" y sí lo muestra.
export const RUTAS_SIN_BARRA_DE_NEGOCIO = ["/", "/auth", "/invite", "/training", "/planning", "/organization", "/nutrition"];

export function mostrarBarraDeNegocio(pathname: string): boolean {
  return !RUTAS_SIN_BARRA_DE_NEGOCIO.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")));
}
