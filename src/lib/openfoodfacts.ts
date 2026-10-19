// Importación puntual de un producto envasado desde Open Food Facts. Se llama
// desde el navegador (la API permite CORS) y el resultado se guarda en la
// biblioteca propia del usuario, así no dependemos de sus límites de uso.

export type ProductoOff = {
  codigo: string;
  nombre: string;
  marca: string | null;
  kcal_100: number;
  proteina_100: number;
  grasa_100: number;
  hidratos_100: number;
  contiene: string[];
};

const ALERGENOS: Record<string, string> = {
  "en:gluten": "gluten",
  "en:crustaceans": "crustaceos",
  "en:eggs": "huevo",
  "en:fish": "pescado",
  "en:peanuts": "cacahuetes",
  "en:soybeans": "soja",
  "en:milk": "lacteos",
  "en:nuts": "frutos_secos",
  "en:celery": "apio",
  "en:mustard": "mostaza",
  "en:sesame-seeds": "sesamo",
  "en:sulphur-dioxide-and-sulphites": "sulfitos",
  "en:lupin": "altramuces",
  "en:molluscs": "moluscos",
};

const CAMPOS = "code,product_name,product_name_es,brands,nutriments,allergens_tags";

function aNumero(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function mapear(p: any, codigoFallback: string): ProductoOff | null {
  const n = p?.nutriments ?? {};
  const proteina = aNumero(n.proteins_100g);
  const grasa = aNumero(n.fat_100g);
  const hidratos = aNumero(n.carbohydrates_100g);
  if (proteina == null || grasa == null || hidratos == null) return null;
  let kcal = aNumero(n["energy-kcal_100g"]);
  if (kcal == null) {
    const kj = aNumero(n["energy-kj_100g"]) ?? aNumero(n.energy_100g);
    kcal = kj != null ? kj / 4.184 : 4 * proteina + 9 * grasa + 4 * hidratos;
  }
  const nombre = String(p.product_name_es || p.product_name || "").trim();
  if (!nombre) return null;
  const contiene = Array.from(
    new Set(((p.allergens_tags ?? []) as string[]).map((t) => ALERGENOS[t]).filter(Boolean)),
  );
  return {
    codigo: String(p.code ?? codigoFallback),
    nombre,
    marca: p.brands ? String(p.brands).split(",")[0].trim() || null : null,
    kcal_100: Math.round(kcal),
    proteina_100: Math.round(proteina * 10) / 10,
    grasa_100: Math.round(grasa * 10) / 10,
    hidratos_100: Math.round(hidratos * 10) / 10,
    contiene,
  };
}

export async function buscarPorCodigo(codigo: string): Promise<ProductoOff> {
  const limpio = codigo.replace(/\s+/g, "");
  if (!/^\d{8,14}$/.test(limpio)) throw new Error("El código de barras debe tener entre 8 y 14 dígitos.");
  let res: Response;
  try {
    res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${limpio}?fields=${CAMPOS}&lc=es`,
    );
  } catch {
    throw new Error("No se ha podido conectar con Open Food Facts.");
  }
  if (res.status === 404) throw new Error("Open Food Facts no tiene ese producto.");
  if (!res.ok) throw new Error("Open Food Facts no responde ahora mismo. Inténtalo más tarde.");
  const json = await res.json();
  if (json.status !== 1 || !json.product) throw new Error("Open Food Facts no tiene ese producto.");
  const producto = mapear(json.product, limpio);
  if (!producto) throw new Error("El producto no tiene valores nutricionales completos en Open Food Facts.");
  return producto;
}

// El buscador por texto de Open Food Facts tiene límites estrictos (10
// búsquedas por minuto) y a veces responde 503: se avisa sin romper nada.
export async function buscarPorTexto(texto: string): Promise<ProductoOff[]> {
  const q = texto.trim();
  if (q.length < 3) throw new Error("Escribe al menos 3 letras.");
  let res: Response;
  try {
    res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=10&lc=es&fields=${CAMPOS}`,
    );
  } catch {
    throw new Error("No se ha podido conectar con Open Food Facts.");
  }
  if (!res.ok) {
    throw new Error(
      "El buscador de Open Food Facts no está disponible ahora (tiene límites de uso). Prueba con el código de barras.",
    );
  }
  const json = await res.json();
  const lista = ((json.products ?? []) as any[])
    .map((p) => mapear(p, ""))
    .filter((p): p is ProductoOff => p !== null);
  if (!lista.length) throw new Error("Sin resultados con valores nutricionales completos.");
  return lista;
}
