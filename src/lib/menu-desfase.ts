// ¿El menú sigue encajando con tus calorías? El menú guarda raciones en gramos, no el objetivo con
// el que se generó: si luego cambias de objetivo (pasas a déficit, subes las calorías…), sigue
// aportando las de antes y nada lo avisaba. Funciones puras.

// Por encima de esta diferencia (sobre el objetivo) se avisa. Un menú casero nunca clava el objetivo.
export const UMBRAL_DESFASE_MENU = 0.08;

export type DesfaseMenu = {
  kcalMenu: number; // media diaria de lo que aporta el menú
  kcalObjetivo: number;
  diferenciaPct: number; // + si el menú se pasa del objetivo
};

// Los días con al menos dos comidas cuentan como «montados»; un día con solo un desayuno puesto no.
export function diaMontado(items: { comida: string }[]): boolean {
  return new Set(items.map((i) => i.comida)).size >= 2;
}

export function desfaseDelMenu(kcalPorDia: number[], objetivo: number): DesfaseMenu | null {
  if (kcalPorDia.length === 0 || !(objetivo > 0)) return null;
  const media = kcalPorDia.reduce((a, b) => a + b, 0) / kcalPorDia.length;
  const diferencia = (media - objetivo) / objetivo;
  if (Math.abs(diferencia) <= UMBRAL_DESFASE_MENU + 1e-9) return null;
  return { kcalMenu: Math.round(media), kcalObjetivo: Math.round(objetivo), diferenciaPct: Math.round(diferencia * 100) };
}
