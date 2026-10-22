import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Bell, ChevronLeft, ChevronRight, HelpCircle, Home, Menu, Plus } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  ahoraLocal,
  alinearSeries,
  diasDeRango,
  etiquetaDia,
  expandir,
  fechaDe,
  fechaHoraADate,
  hoyFecha,
  inversoDe,
  moverVista,
  nuevoEvento,
  ocurrenciaExterna,
  ordenar,
  planEditar,
  planEliminar,
  rangoVista,
  sumarDias,
  sumarMinutos,
  tituloVista,
  type Alcance,
  type CambiosEvento,
  type ColorKey,
  type EventoRow,
  type Fecha,
  type FechaHora,
  type ItemExterno,
  type Ocurrencia,
  type Plan,
  type Vista,
} from "@/lib/calendar";
import {
  aplicarInterpretacion,
  borradorACambios,
  borradorDesdeOcurrencia,
  borradorNuevo,
  siguienteHoraRedonda,
  validarBorrador,
  type BorradorEvento,
} from "@/lib/calendar-form";
import { interpretarTexto } from "@/lib/calendar-quick";
import type { AlmacenCalendario, Rango } from "@/hooks/use-calendar";
import { useAlcance } from "./alcance";
import { CasillaTarea, type Anclaje } from "./chips";
import { CrearRapido } from "./crear-rapido";
import { DetallePopover } from "./detalle-popover";
import { btnIcono, btnPrimario, COLOR_UI } from "./estilos";
import { EventoDialogo } from "./evento-dialogo";
import { MiniMes } from "./mini-mes";
import { VistaAgenda } from "./vista-agenda";
import { VistaHoras } from "./vista-horas";
import { VistaMes } from "./vista-mes";

export type CapaExterna = { clave: string; nombre: string; color: ColorKey; porDefecto: boolean };

type Props = {
  useAlmacen: (rango: Rango) => AlmacenCalendario | null;
  useExternos: (rango: Rango, visibles: Record<string, boolean>) => ItemExterno[];
  capasExternas: CapaExterna[];
};

const VISTAS: { clave: Vista; etiqueta: string; atajo: string }[] = [
  { clave: "dia", etiqueta: "Día", atajo: "d" },
  { clave: "semana", etiqueta: "Semana", atajo: "w" },
  { clave: "mes", etiqueta: "Mes", atajo: "m" },
  { clave: "agenda", etiqueta: "Agenda", atajo: "a" },
];

const guardado = {
  leer(clave: string): string | null {
    try {
      return window.localStorage.getItem(clave);
    } catch {
      return null;
    }
  },
  escribir(clave: string, valor: string) {
    try {
      window.localStorage.setItem(clave, valor);
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  },
};

type Seleccion = { oc: Ocurrencia; anclaje: Anclaje };
type Creando = { borrador: BorradorEvento; anclaje: Anclaje; error: string | null };
type Editor = { borrador: BorradorEvento; oc: Ocurrencia | null; error: string | null };

const horaDeMinutos = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function CalendarioApp({ useAlmacen, useExternos, capasExternas }: Props) {
  const [vista, setVista] = useState<Vista>(() => {
    const g = typeof window === "undefined" ? null : guardado.leer("veract.calendario.vista");
    if (g === "dia" || g === "semana" || g === "mes" || g === "agenda") return g;
    return typeof window !== "undefined" && window.innerWidth < 768 ? "dia" : "semana";
  });
  const [ahora, setAhora] = useState<FechaHora>(() => ahoraLocal());
  const hoy = fechaDe(ahora);
  const [fecha, setFecha] = useState<Fecha>(() => hoyFecha());
  const [diasAgenda, setDiasAgenda] = useState(30);
  const [visibles, setVisibles] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = { eventos: true, tareas: true, ...Object.fromEntries(capasExternas.map((c) => [c.clave, c.porDefecto])) };
    try {
      const g = typeof window === "undefined" ? null : guardado.leer("veract.calendario.capas");
      return g ? { ...base, ...(JSON.parse(g) as Record<string, boolean>) } : base;
    } catch {
      return base;
    }
  });
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [creando, setCreando] = useState<Creando | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [lateralMovil, setLateralMovil] = useState(false);
  const [estrecho, setEstrecho] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const { preguntarAlcance, dialogoAlcance } = useAlcance();

  useEffect(() => {
    const t = setInterval(() => setAhora(ahoraLocal()), 30_000);
    const r = () => setEstrecho(window.innerWidth < 640);
    window.addEventListener("resize", r);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", r);
    };
  }, []);

  const rango = useMemo(() => rangoVista(vista, fecha, diasAgenda), [vista, fecha, diasAgenda]);
  const almacen = useAlmacen(rango);
  const externos = useExternos(rango, visibles);
  const filas = almacen?.filas;

  const ocs = useMemo(() => {
    const propias = expandir(filas ?? [], rango.desde, rango.hasta).filter((o) => (o.tipo === "evento" ? visibles.eventos : visibles.tareas));
    return ordenar([...propias, ...externos.map(ocurrenciaExterna)]);
  }, [filas, rango.desde, rango.hasta, visibles.eventos, visibles.tareas, externos]);

  const dias = useMemo(() => (vista === "dia" ? [fecha] : diasDeRango(rango.desde, rango.hasta)), [vista, fecha, rango.desde, rango.hasta]);
  const maestroDe = useCallback((oc: Ocurrencia) => (oc.serieId ? (filas ?? []).find((f) => f.id === oc.serieId) ?? null : null), [filas]);

  /* ---------------- Guardar cambios ---------------- */

  async function ejecutar(plan: Plan, mensaje: string, conocidas: EventoRow[]): Promise<boolean> {
    if (!almacen) return false;
    const final = alinearSeries(plan);
    setOcupado(true);
    try {
      await almacen.aplicar(final);
      setSeleccion(null);
      toast.success(mensaje, {
        action: {
          label: "Deshacer",
          onClick: () => {
            almacen.aplicar(inversoDe(final, conocidas)).then(() => toast.success("Cambio deshecho.")).catch((e: Error) => toast.error(e.message));
          },
        },
      });
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function contextoDe(oc: Ocurrencia) {
    const maestro = maestroDe(oc);
    const hijos = maestro && almacen ? await almacen.hijosDe(maestro.id) : [];
    return { oc, maestro, hijos };
  }

  async function cambiar(oc: Ocurrencia, cambios: CambiosEvento, o: { mensaje: string; pregunta: string; alcance?: Alcance }): Promise<boolean> {
    let alcance = o.alcance;
    if (oc.repite && !alcance) {
      const a = await preguntarAlcance({ titulo: o.pregunta, accion: "Guardar", esTarea: oc.tipo === "tarea" });
      if (!a) return false;
      alcance = a;
    }
    const ctx = await contextoDe(oc);
    return ejecutar(planEditar(ctx, cambios, alcance ?? "todas", () => crypto.randomUUID()), o.mensaje, [...(filas ?? []), ...ctx.hijos]);
  }

  async function crearFila(b: BorradorEvento, mensaje: string): Promise<boolean> {
    if (!almacen) return false;
    const c = borradorACambios(b);
    const fila = nuevoEvento(almacen.userId, crypto.randomUUID(), { ...c, titulo: c.titulo as string, inicio: c.inicio as FechaHora });
    return ejecutar({ guardar: [fila], eliminar: [] }, mensaje, filas ?? []);
  }

  async function borrar(oc: Ocurrencia): Promise<boolean> {
    let alcance: Alcance = "todas";
    if (oc.repite) {
      const a = await preguntarAlcance({ titulo: oc.tipo === "tarea" ? "¿Eliminar la tarea repetida?" : "¿Eliminar el evento repetido?", accion: "Eliminar", esTarea: oc.tipo === "tarea" });
      if (!a) return false;
      alcance = a;
    }
    const ctx = await contextoDe(oc);
    return ejecutar(planEliminar(ctx, alcance), oc.tipo === "tarea" ? "Tarea eliminada." : "Evento eliminado.", [...(filas ?? []), ...ctx.hijos]);
  }

  const alternarHecho = (oc: Ocurrencia) => {
    if (oc.soloLectura) return;
    void cambiar(oc, { hecho: !oc.hecho }, { mensaje: oc.hecho ? "Tarea pendiente otra vez." : "Tarea hecha.", pregunta: "", alcance: "esta" });
  };

  async function guardarEditor(interpretar: boolean) {
    if (!editor) return;
    let b = editor.borrador;
    if (!editor.oc && interpretar) b = aplicarInterpretacion(b, interpretarTexto(b.titulo, fechaHoraADate(ahora)));
    const error = validarBorrador(b);
    if (error) return setEditor({ ...editor, error });
    let ok: boolean;
    if (!editor.oc) ok = await crearFila(b, b.tipo === "tarea" ? "Tarea creada." : "Evento creado.");
    else {
      // El inicio y el fin son los de ESTA ocurrencia; si cambian los días de la serie, "alinearSeries" recoloca el inicio.
      const c = borradorACambios(b);
      const t = borradorACambios({ ...b, repeticion: null });
      ok = await cambiar(editor.oc, { ...c, inicio: t.inicio, fin: t.fin }, { mensaje: "Cambios guardados.", pregunta: "¿A cuáles afectan los cambios?" });
    }
    if (ok) setEditor(null);
  }

  async function guardarRapido(interpretar: boolean) {
    if (!creando) return;
    let b = creando.borrador;
    if (interpretar) b = aplicarInterpretacion(b, interpretarTexto(b.titulo, fechaHoraADate(ahora)));
    const error = validarBorrador(b);
    if (error) return setCreando({ ...creando, error });
    if (await crearFila(b, b.tipo === "tarea" ? "Tarea creada." : "Evento creado.")) setCreando(null);
  }

  /* ---------------- Abrir cosas ---------------- */

  const abrirDetalle = (oc: Ocurrencia, anclaje: Anclaje) => {
    setCreando(null);
    setSeleccion({ oc, anclaje });
  };

  const diaBase = rango.desde <= hoy && hoy < rango.hasta ? hoy : fecha;
  const abrirNuevo = useCallback(
    (tipo: "evento" | "tarea") => {
      const { fecha: f, hora } = diaBase === hoy ? siguienteHoraRedonda(ahora) : { fecha: diaBase, hora: "09:00" };
      setSeleccion(null);
      setCreando(null);
      setLateralMovil(false);
      setEditor({ borrador: borradorNuevo({ fecha: f, hora: tipo === "tarea" ? null : hora, tipo }), oc: null, error: null });
    },
    [diaBase, hoy, ahora],
  );

  function crearEnHueco(f: Fecha, iniMin: number, finMin: number, anclaje: Anclaje) {
    setSeleccion(null);
    setCreando({ borrador: borradorNuevo({ fecha: f, hora: horaDeMinutos(iniMin), duracionMin: Math.max(15, finMin - iniMin) }), anclaje, error: null });
  }
  function crearEnDia(f: Fecha, anclaje: Anclaje) {
    setSeleccion(null);
    const hora = f === hoy ? siguienteHoraRedonda(ahora).hora : "09:00";
    setCreando({ borrador: borradorNuevo({ fecha: f, hora }), anclaje, error: null });
  }
  function crearTodoElDia(f: Fecha, anclaje: Anclaje) {
    setSeleccion(null);
    setCreando({ borrador: borradorNuevo({ fecha: f, todoElDia: true, fechaFin: f }), anclaje, error: null });
  }

  const editarOcurrencia = (oc: Ocurrencia) => {
    setSeleccion(null);
    setEditor({ borrador: borradorDesdeOcurrencia(oc, maestroDe(oc)), oc, error: null });
  };

  /* ---------------- Navegación y atajos ---------------- */

  const elegirVista = useCallback((v: Vista) => {
    setVista(v);
    guardado.escribir("veract.calendario.vista", v);
  }, []);
  const ir = useCallback((dir: -1 | 1) => setFecha((f) => moverVista(vista, f, dir)), [vista]);
  const alternarCapa = (clave: string) =>
    setVisibles((v) => {
      const n = { ...v, [clave]: !v[clave] };
      guardado.escribir("veract.calendario.capas", JSON.stringify(n));
      return n;
    });

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (editor || creando || ayuda || document.querySelector('[role="dialog"][data-state="open"]')) return;
      const k = e.key.toLowerCase();
      const v = VISTAS.find((x) => x.atajo === k);
      if (v) elegirVista(v.clave);
      else if (k === "c") {
        e.preventDefault();
        abrirNuevo("evento");
      } else if (k === "t" && !e.shiftKey) setFecha(hoy);
      else if (k === "n" || k === "j" || k === "arrowright") ir(1);
      else if (k === "p" || k === "k" || k === "arrowleft") ir(-1);
      else if (e.key === "?") setAyuda(true);
      else if (e.key === "Escape") setSeleccion(null);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [editor, creando, ayuda, hoy, ir, elegirVista, abrirNuevo]);

  /* ---------------- Dibujo ---------------- */

  if (!almacen) {
    return <div className="grid h-screen place-items-center text-sm text-slate-400">Cargando calendario…</div>;
  }

  const lateral = (
    <Lateral
      fecha={fecha}
      hoy={hoy}
      desde={vista === "dia" || vista === "semana" ? rango.desde : fecha}
      hasta={vista === "dia" || vista === "semana" ? rango.hasta : sumarDias(fecha, 1)}
      onElegir={(f) => {
        setFecha(f);
        setLateralMovil(false);
      }}
      onCrear={abrirNuevo}
      visibles={visibles}
      capas={capasExternas}
      onAlternarCapa={alternarCapa}
      pendientes={almacen.tareasPendientes}
      onAlternarPendiente={(f) => {
        const oc = expandir([f], fechaDe(f.inicio), sumarDias(fechaDe(f.inicio), 1))[0];
        if (oc) alternarHecho(oc);
      }}
      onIrA={(f) => {
        setFecha(f);
        setLateralMovil(false);
      }}
    />
  );

  return (
    <div className="flex h-screen min-h-0 flex-col bg-slate-950 text-slate-100">
      {/* Barra superior */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2 sm:px-4">
        <button type="button" onClick={() => setLateralMovil(true)} className={cn(btnIcono, "lg:hidden")} aria-label="Abrir panel lateral">
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" title="Volver a inicio" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white">
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Inicio</span>
        </Link>
        <h1 className="mr-2 hidden text-lg font-semibold text-white lg:block">Organización</h1>
        <button type="button" onClick={() => setFecha(hoy)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">
          Hoy
        </button>
        <div className="flex">
          <button type="button" onClick={() => ir(-1)} aria-label="Anterior" className={btnIcono}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => ir(1)} aria-label="Siguiente" className={btnIcono}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-white sm:text-lg" aria-live="polite">
          {tituloVista(vista, fecha)}
        </h2>
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5" role="tablist" aria-label="Vista">
          {VISTAS.map((v) => (
            <button
              key={v.clave}
              type="button"
              role="tab"
              aria-selected={vista === v.clave}
              onClick={() => elegirVista(v.clave)}
              title={`${v.etiqueta} (${v.atajo.toUpperCase()})`}
              className={cn("rounded-md px-2.5 py-1 text-xs font-semibold transition sm:px-3 sm:text-sm", vista === v.clave ? "bg-emerald-500 text-white" : "text-slate-300 hover:text-white")}
            >
              {v.etiqueta}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setAyuda(true)} className={cn(btnIcono, "hidden sm:grid")} aria-label="Atajos de teclado" title="Atajos de teclado (?)">
          <HelpCircle className="h-5 w-5" />
        </button>
      </header>

      {almacen.error && (
        <div role="alert" className="shrink-0 border-b border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
          {almacen.error}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-800 p-4 lg:block">{lateral}</aside>
        <main className={cn("relative min-h-0 min-w-0 flex-1", almacen.cargando && "opacity-70")}>
          {vista === "mes" && (
            <VistaMes
              fecha={fecha}
              hoy={hoy}
              ocs={ocs}
              seleccionClave={seleccion?.oc.clave ?? null}
              maxFilas={estrecho ? 2 : 3}
              onCrear={crearEnDia}
              onAbrir={abrirDetalle}
              onIrADia={(f) => {
                setFecha(f);
                elegirVista("dia");
              }}
              onMoverDias={(oc, d) => void cambiar(oc, { inicio: sumarMinutos(oc.inicio, d * 1440), fin: sumarMinutos(oc.fin, d * 1440) }, { mensaje: "Movido.", pregunta: "¿A cuáles afecta el cambio de día?" })}
              onAlternarHecho={alternarHecho}
            />
          )}
          {(vista === "dia" || vista === "semana") && (
            <VistaHoras
              dias={dias}
              hoy={hoy}
              ahora={ahora}
              ocs={ocs}
              seleccionClave={seleccion?.oc.clave ?? null}
              onCrearRango={crearEnHueco}
              onCrearTodoElDia={crearTodoElDia}
              onAbrir={abrirDetalle}
              onMover={(oc, ini, fin) => void cambiar(oc, { inicio: ini, fin }, { mensaje: "Cambio guardado.", pregunta: "¿A cuáles afecta el cambio de hora?" })}
              onIrADia={(f) => {
                setFecha(f);
                elegirVista("dia");
              }}
              onAlternarHecho={alternarHecho}
            />
          )}
          {vista === "agenda" && (
            <VistaAgenda desde={rango.desde} hasta={rango.hasta} hoy={hoy} ocs={ocs} seleccionClave={seleccion?.oc.clave ?? null} onAbrir={abrirDetalle} onAlternarHecho={alternarHecho} onMas={() => setDiasAgenda((d) => d + 30)} onCrear={() => abrirNuevo("evento")} />
          )}
          <button type="button" onClick={() => abrirNuevo("evento")} aria-label="Crear evento" className={cn(btnPrimario, "fixed bottom-5 right-5 z-30 h-14 w-14 rounded-full p-0 shadow-2xl lg:hidden")}>
            <Plus className="h-6 w-6" />
          </button>
        </main>
      </div>

      {/* Panel lateral en el móvil */}
      <Sheet open={lateralMovil} onOpenChange={setLateralMovil}>
        <SheetContent side="left" className="w-[19rem] max-w-[85vw] overflow-y-auto border-slate-800 bg-slate-950 p-4 text-slate-100">
          <SheetTitle className="sr-only">Panel del calendario</SheetTitle>
          {lateral}
        </SheetContent>
      </Sheet>

      {seleccion && (
        <DetallePopover
          oc={seleccion.oc}
          maestro={maestroDe(seleccion.oc)}
          anclaje={seleccion.anclaje}
          onCerrar={() => setSeleccion(null)}
          onEditar={() => editarOcurrencia(seleccion.oc)}
          onBorrar={() => void borrar(seleccion.oc)}
          onAlternarHecho={() => alternarHecho(seleccion.oc)}
        />
      )}
      {creando && (
        <CrearRapido
          borrador={creando.borrador}
          anclaje={creando.anclaje}
          ahora={ahora}
          error={creando.error}
          ocupado={ocupado}
          onCambiar={(borrador) => setCreando({ ...creando, borrador, error: null })}
          onGuardar={(i) => void guardarRapido(i)}
          onMasOpciones={(i) => {
            const b = i ? aplicarInterpretacion(creando.borrador, interpretarTexto(creando.borrador.titulo, fechaHoraADate(ahora))) : creando.borrador;
            setCreando(null);
            setEditor({ borrador: b, oc: null, error: null });
          }}
          onCerrar={() => setCreando(null)}
        />
      )}
      {editor && (
        <EventoDialogo
          borrador={editor.borrador}
          ahora={ahora}
          esNuevo={!editor.oc}
          esSerie={!!editor.oc?.repite}
          error={editor.error}
          ocupado={ocupado}
          onCambiar={(borrador) => setEditor({ ...editor, borrador, error: null })}
          onGuardar={(i) => void guardarEditor(i)}
          onBorrar={editor.oc ? () => void borrar(editor.oc as Ocurrencia).then((ok) => ok && setEditor(null)) : undefined}
          onCerrar={() => setEditor(null)}
        />
      )}
      {dialogoAlcance}
      <AyudaAtajos abierta={ayuda} onCerrar={() => setAyuda(false)} />
    </div>
  );
}

/* ------------------------------ Panel lateral ------------------------------ */

function Lateral({
  fecha, hoy, desde, hasta, onElegir, onCrear, visibles, capas, onAlternarCapa, pendientes, onAlternarPendiente, onIrA,
}: {
  fecha: Fecha;
  hoy: Fecha;
  desde: Fecha;
  hasta: Fecha;
  onElegir: (f: Fecha) => void;
  onCrear: (tipo: "evento" | "tarea") => void;
  visibles: Record<string, boolean>;
  capas: CapaExterna[];
  onAlternarCapa: (clave: string) => void;
  pendientes: EventoRow[];
  onAlternarPendiente: (f: EventoRow) => void;
  onIrA: (f: Fecha) => void;
}) {
  const [permiso, setPermiso] = useState<NotificationPermission | "no">(() => (typeof Notification === "undefined" ? "no" : Notification.permission));
  const lista: { clave: string; nombre: string; color: ColorKey }[] = [
    { clave: "eventos", nombre: "Eventos", color: "azul" },
    { clave: "tareas", nombre: "Tareas", color: "esmeralda" },
    ...capas.map((c) => ({ clave: c.clave, nombre: c.nombre, color: c.color })),
  ];
  const ordenadas = [...pendientes].sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, 12);
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button type="button" onClick={() => onCrear("evento")} className={cn(btnPrimario, "flex-1")}>
          <Plus className="h-4 w-4" /> Evento
        </button>
        <button type="button" onClick={() => onCrear("tarea")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/50 px-3 py-2 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/10">
          <Plus className="h-4 w-4" /> Tarea
        </button>
      </div>

      <MiniMes fecha={fecha} hoy={hoy} desde={desde} hasta={hasta} onElegir={onElegir} />

      <section>
        <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-slate-500">Mis calendarios</h3>
        <ul className="space-y-1">
          {lista.map((c) => (
            <li key={c.clave}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-sm text-slate-200 hover:bg-slate-900">
                <input type="checkbox" checked={!!visibles[c.clave]} onChange={() => onAlternarCapa(c.clave)} className="sr-only" />
                <span aria-hidden className={cn("grid h-4 w-4 place-items-center rounded-sm border-2 transition", visibles[c.clave] ? cn(COLOR_UI[c.color].punto, "border-transparent text-white") : "border-slate-600")}>
                  {visibles[c.clave] && <span className="text-[10px] font-black leading-none">✓</span>}
                </span>
                {c.nombre}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-slate-500">Tareas pendientes</h3>
        {ordenadas.length === 0 ? (
          <p className="text-xs text-slate-500">No tienes tareas pendientes. 🎉</p>
        ) : (
          <ul className="space-y-1">
            {ordenadas.map((f) => {
              const dia = fechaDe(f.inicio);
              const atrasada = dia < hoy;
              return (
                <li key={f.id} className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-slate-900">
                  <button type="button" aria-label={`Marcar «${f.titulo}» como hecha`} onClick={() => onAlternarPendiente(f)} className="mt-0.5">
                    <CasillaTarea hecho={false} color={f.color} className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => onIrA(dia)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm text-slate-200">{f.titulo}</span>
                    <span className={cn("text-[11px]", atrasada ? "font-semibold text-rose-400" : "text-slate-500")}>{atrasada ? `Atrasada · ${etiquetaDia(dia, hoy)}` : etiquetaDia(dia, hoy)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-400">
        <p className="mb-2 flex items-center gap-1.5 font-semibold text-slate-300">
          <Bell className="h-3.5 w-3.5" /> Avisos
        </p>
        <p>Los avisos solo suenan con Veract abierto en el navegador.</p>
        {permiso === "default" && (
          <button
            type="button"
            onClick={() => Notification.requestPermission().then((p) => setPermiso(p))}
            className="mt-2 rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Activar avisos del navegador
          </button>
        )}
        {permiso === "denied" && <p className="mt-1 text-slate-500">Los avisos del navegador están bloqueados; se verán dentro de la app.</p>}
      </section>
    </div>
  );
}

/* ------------------------------ Ayuda ------------------------------ */

function AyudaAtajos({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const atajos: [string, string][] = [
    ["C", "Crear un evento"],
    ["T", "Ir a hoy"],
    ["D · W · M · A", "Vista día, semana, mes, agenda"],
    ["N · →", "Siguiente"],
    ["P · ←", "Anterior"],
    ["Esc", "Cerrar"],
    ["?", "Esta ayuda"],
  ];
  return (
    <Dialog.Root open={abierta} onOpenChange={(a) => !a && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-100 shadow-xl outline-none">
          <Dialog.Title className="mb-3 text-base font-semibold text-white">Atajos de teclado</Dialog.Title>
          <dl className="space-y-2 text-sm">
            {atajos.map(([k, d]) => (
              <div key={k} className="flex items-center justify-between gap-4">
                <dt>
                  <kbd className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-slate-200">{k}</kbd>
                </dt>
                <dd className="text-slate-400">{d}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Al crear, puedes escribir frases como «Dentista mañana 10:30», «Gimnasio todos los lunes y miércoles a las 19» o «tarea: pagar IVA el 20 de enero».
          </p>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-800">
              Cerrar
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
