// Cambiar de día un entrenamiento de la rutina o poner otro en su lugar: qué días se pueden
// elegir y qué se le explica al usuario antes de confirmar. Funciones puras, sin acceso a datos.
// La operación real (atómica) la hacen las funciones SQL intercambiar_dias_rutina y
// sustituir_entrenamiento_dia.

export const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export type DiaPlan = {
  dia_semana: number; // 0 = lunes ... 6 = domingo
  nombre_dia: string;
  es_dia_entreno: boolean;
  ejercicios: unknown[];
};

const porDia = (dias: DiaPlan[], dow: number) => dias.find((d) => d.dia_semana === dow);
const comoEntreno = (d: DiaPlan) => `«${d.nombre_dia}»`;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export type Confirmacion = { titulo: string; descripcion: string };

// Mover el día "origen" a "destino": el que estaba en destino pasa a origen (se intercambian).
export function describirIntercambio(dias: DiaPlan[], origen: number, destino: number): Confirmacion | null {
  const a = porDia(dias, origen);
  const b = porDia(dias, destino);
  if (!a || !b || origen === destino) return null;
  const nombreA = a.es_dia_entreno ? comoEntreno(a) : "El descanso";
  const frases: string[] = [];
  frases.push(`${nombreA} pasará del ${DIAS_SEMANA[origen]} al ${DIAS_SEMANA[destino]}.`);
  if (b.es_dia_entreno) frases.push(`${comoEntreno(b)} pasará del ${DIAS_SEMANA[destino]} al ${DIAS_SEMANA[origen]}.`);
  else frases.push(`El descanso del ${DIAS_SEMANA[destino]} pasará al ${DIAS_SEMANA[origen]}.`);
  frases.push("Se mueve el día completo, con sus ejercicios, hábitos e historial.");
  return {
    titulo: a.es_dia_entreno ? `¿Mover ${comoEntreno(a)} al ${DIAS_SEMANA[destino]}?` : `¿Mover el descanso al ${DIAS_SEMANA[destino]}?`,
    descripcion: frases.join(" "),
  };
}

// Entrenamientos que se pueden copiar a un día: los que tienen ejercicios, de otro día.
export function entrenamientosParaCopiar(dias: DiaPlan[], destino: number): DiaPlan[] {
  return dias
    .filter((d) => d.dia_semana !== destino && d.es_dia_entreno && d.ejercicios.length > 0)
    .sort((x, y) => x.dia_semana - y.dia_semana);
}

// Poner en "destino" una copia del entrenamiento de "origen".
export function describirSustitucion(dias: DiaPlan[], destino: number, origen: number): Confirmacion | null {
  const d = porDia(dias, destino);
  const o = porDia(dias, origen);
  if (!d || !o || destino === origen || !o.es_dia_entreno || o.ejercicios.length === 0) return null;
  const copia = `una copia de ${comoEntreno(o)} del ${DIAS_SEMANA[origen]} (${plural(o.ejercicios.length, "ejercicio", "ejercicios")}, con sus series, repeticiones y pesos)`;
  const actuales = d.ejercicios.length;
  const quitar =
    actuales === 1
      ? "Se quitará de la rutina el ejercicio actual"
      : `Se quitarán de la rutina los ${actuales} ejercicios actuales`;
  const descripcion =
    actuales > 0
      ? `${quitar} de ${d.es_dia_entreno ? comoEntreno(d) : "este día"} y se pondrá ${copia}. El historial de series ya registradas se conserva.`
      : `El ${DIAS_SEMANA[destino]} pasará a ser un día de entreno con ${copia}.`;
  return { titulo: `¿Poner «${o.nombre_dia}» el ${DIAS_SEMANA[destino]}?`, descripcion };
}
