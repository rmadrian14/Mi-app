// Copia de seguridad de los datos de Veract: vuelca TODAS las tablas de la base de
// datos (se descubren solas, así que las nuevas entran sin tocar el script) a un
// único archivo JSON en backups/, que git ignora.
//
// Uso:  npm run backup
//
// Necesita en .env:  SUPABASE_URL (o VITE_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY.
// La clave de servicio se lee del archivo, nunca se imprime ni se guarda en la
// copia, y este script solo LEE (no escribe ni borra nada en la base de datos).
//
// Qué NO incluye:
//  - Los usuarios de acceso (auth.users: emails y contraseñas), que no están
//    expuestos por la API de datos.
//  - Los archivos de Storage (PDF de facturas, justificantes). Solo se listan los
//    buckets en el resumen; si los necesitas, descárgalos desde el panel.
//
// Para restaurar hay que volver a insertar las filas (por la API o con SQL); el
// JSON conserva todas las columnas tal como estaban.
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

function leerEnv() {
  const env = {};
  const ruta = path.join(RAIZ, ".env");
  if (!fs.existsSync(ruta)) throw new Error("No se encuentra el archivo .env en la raíz del proyecto.");
  for (const linea of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return env;
}

const env = leerEnv();
const URL_BASE = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const CLAVE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !CLAVE) throw new Error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env.");

const cabeceras = { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` };
const TAMANO_PAGINA = 1000; // tope de filas por petición de la API (ver src/lib/supabase-paging.ts)

async function pedir(ruta, extra = {}) {
  const res = await fetch(`${URL_BASE}${ruta}`, { headers: { ...cabeceras, ...extra } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${ruta.split("?")[0]}: ${(await res.text()).slice(0, 160)}`);
  return res;
}

// La API publica su propio esquema: de ahí salen las tablas y sus columnas.
const esquema = await (await pedir("/rest/v1/")).json();
const tablas = Object.entries(esquema.definitions ?? {}).map(([nombre, def]) => ({
  nombre,
  columnas: Object.keys(def.properties ?? {}),
}));
if (!tablas.length) throw new Error("No se han podido descubrir las tablas (¿la clave es correcta?).");

const copia = {};
const resumen = [];
for (const { nombre, columnas } of tablas.sort((a, b) => a.nombre.localeCompare(b.nombre))) {
  try {
    const filas = [];
    // Orden estable por id si existe, para que las páginas no se solapen.
    const orden = columnas.includes("id") ? "&order=id" : "";
    for (let desde = 0; ; desde += TAMANO_PAGINA) {
      const res = await pedir(`/rest/v1/${encodeURIComponent(nombre)}?select=*${orden}`, {
        Range: `${desde}-${desde + TAMANO_PAGINA - 1}`,
        "Range-Unit": "items",
      });
      const pagina = await res.json();
      filas.push(...pagina);
      if (pagina.length < TAMANO_PAGINA) break;
    }
    copia[nombre] = filas;
    resumen.push({ nombre, filas: filas.length, error: null });
  } catch (e) {
    resumen.push({ nombre, filas: 0, error: e.message });
  }
}

// Buckets de Storage (solo nombres).
let buckets = [];
try {
  buckets = (await (await pedir("/storage/v1/bucket")).json()).map((b) => ({ nombre: b.name, publico: b.public }));
} catch {
  /* Storage es opcional */
}

const ahora = new Date();
const dos = (n) => String(n).padStart(2, "0");
const marca = `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}_${dos(ahora.getHours())}${dos(ahora.getMinutes())}`;
const carpeta = path.join(RAIZ, "backups");
fs.mkdirSync(carpeta, { recursive: true });
const archivo = path.join(carpeta, `veract-${marca}.json`);
fs.writeFileSync(
  archivo,
  JSON.stringify(
    { creada: ahora.toISOString(), proyecto: new URL(URL_BASE).host, buckets, resumen, tablas: copia },
    null,
    2,
  ),
);

const conDatos = resumen.filter((r) => r.filas > 0);
const fallos = resumen.filter((r) => r.error);
console.log(`Copia creada: ${path.relative(RAIZ, archivo)} (${(fs.statSync(archivo).size / 1024).toFixed(1)} KB)`);
console.log(`Tablas: ${resumen.length} · con datos: ${conDatos.length} · filas en total: ${resumen.reduce((s, r) => s + r.filas, 0)}`);
for (const r of conDatos) console.log(`  ${r.nombre.padEnd(26)} ${String(r.filas).padStart(6)} filas`);
if (buckets.length) console.log(`Storage (solo listado, sin archivos): ${buckets.map((b) => b.nombre).join(", ")}`);
if (fallos.length) {
  console.log(`\n⚠ ${fallos.length} tabla(s) NO se han podido copiar:`);
  for (const r of fallos) console.log(`  ${r.nombre}: ${r.error}`);
  process.exitCode = 1;
}
