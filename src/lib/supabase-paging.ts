// La API de Supabase devuelve como mucho 1.000 filas por consulta (ajuste «Max
// rows», 1.000 por defecto) y lo hace EN SILENCIO: una consulta que debería
// traer 3.000 filas trae 1.000 sin avisar. Para leer un historial completo hay
// que pedirlo por páginas con .range(), y con un orden estable (único) para que
// ninguna fila se repita ni se pierda entre páginas.
//
// Uso:
//   const { data, error } = await leerTodo((desde, hasta) =>
//     supabase.from("session_sets").select("…").eq("user_id", id)
//       .order("created_at").order("id").range(desde, hasta));

// Debe ser ≤ al «Max rows» del proyecto (1.000 por defecto). Si algún día se
// baja ese ajuste, hay que bajar también este valor.
export const TAMANO_PAGINA = 1000;

// Tope de seguridad para no entrar en un bucle infinito si algo falla.
const MAX_FILAS = 500_000;

type RespuestaPagina<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function leerTodo<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<RespuestaPagina<T>>,
  tamano: number = TAMANO_PAGINA,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const todas: T[] = [];
  for (let desde = 0; desde < MAX_FILAS; desde += tamano) {
    const { data, error } = await pagina(desde, desde + tamano - 1);
    if (error) return { data: todas, error };
    const filas = data ?? [];
    todas.push(...filas);
    if (filas.length < tamano) break; // última página
  }
  return { data: todas, error: null };
}
