"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { flushSync } from "react-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileSpreadsheet, Printer, Search } from "lucide-react";
import { getPadron, getPeriodoCorte } from "./actions";
import { getCategorias } from "../actions";
import { formatDateOnly, todayISO, exportToCSV } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { cn } from "@/lib/utils";
import type { PadronRow, CategoriaSocial } from "@/types/socios";

const PAGE_SIZE = 100;

function formatPeriodoCorte(periodo: string | null): string {
  if (!periodo) return "—";
  return format(new Date(`${periodo}T00:00:00`), "MM/yyyy", { locale: es });
}

type Column = {
  key: string;
  label: string;
  render: (s: PadronRow) => React.ReactNode;
  /**
   * Cuando está marcada, la columna no sale en la hoja impresa — sigue en
   * pantalla y en los exports, que son los que permiten auditar por qué
   * alguien quedó habilitado.
   *
   * Hoy sólo se marca para el padrón electoral, que se pega en los sectores
   * del club: publicar DNI y edad de miles de socios en un pasillo es exponer
   * datos personales que nadie necesita para encontrarse en la lista. El
   * padrón general se imprime completo, DNI incluido.
   */
  printHidden?: boolean;
};

export default function PadronPage() {
  const [socios, setSocios] = useState<PadronRow[]>([]);
  const [periodoCorte, setPeriodoCorte] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<CategoriaSocial[]>([]);
  const [selectedCategoria, setSelectedCategoria] = useState<string>("all");
  const [soloHabilitados, setSoloHabilitados] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [printAll, setPrintAll] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<"sin_permiso" | "error" | null>(null);

  // Descarta respuestas que llegan fuera de orden: con ~8.400 socios el fetch
  // tarda segundos, y si el usuario cambia el toggle o la categoría dos veces
  // en esa ventana, una respuesta vieja podría resolver última y mostrar un
  // listado que no corresponde al filtro vigente.
  const requestIdRef = useRef(0);
  const printTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoriasDisponibles = useMemo(
    () =>
      soloHabilitados
        ? categorias.filter((c) => c.habilita_voto)
        : categorias,
    [categorias, soloHabilitados],
  );

  const fetchData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const [data, corte] = await Promise.all([
        getPadron(
          selectedCategoria !== "all" ? selectedCategoria : undefined,
          soloHabilitados,
        ),
        getPeriodoCorte(),
      ]);
      if (requestIdRef.current !== requestId) return; // respuesta obsoleta
      setSocios(data);
      setPeriodoCorte(corte);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      const message = err instanceof Error ? err.message : "";
      if (message.includes("sin_permiso")) {
        setError("sin_permiso");
        toast.error("No tenés permiso para ver el padrón.");
      } else {
        setError("error");
        toast.error("Error al cargar el padrón. Reintentá en unos segundos.");
      }
      setSocios([]);
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false);
    }
  }, [selectedCategoria, soloHabilitados]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getCategorias().then(setCategorias);
  }, []);

  // Cubre también el Ctrl+P nativo del navegador, que no pasa por
  // handlePrint(). El fallback de printTimeoutRef restaura el estado en
  // navegadores/webviews donde afterprint no llega a dispararse.
  useEffect(() => {
    function handleBeforePrint() {
      flushSync(() => setPrintAll(true));
    }
    function handleAfterPrint() {
      if (printTimeoutRef.current) {
        clearTimeout(printTimeoutRef.current);
        printTimeoutRef.current = null;
      }
      flushSync(() => setPrintAll(false));
      setPrinting(false);
    }
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      if (printTimeoutRef.current) clearTimeout(printTimeoutRef.current);
    };
  }, []);

  function handleToggleSoloHabilitados(checked: boolean) {
    setSoloHabilitados(checked);
    if (checked && selectedCategoria !== "all") {
      const cat = categorias.find((c) => c.id === selectedCategoria);
      // Si la categoría elegida no habilita voto, el listado quedaría vacío
      // sin explicación: volver a "Todas" en vez de eso.
      if (!cat?.habilita_voto) setSelectedCategoria("all");
    }
    setPage(1);
  }

  function handleCategoriaChange(value: string) {
    setSelectedCategoria(value);
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return socios;
    return socios.filter((s) =>
      [
        s.apellido,
        s.nombre,
        s.dni,
        String(s.nro_socio),
        s.localidad,
        s.categoria,
      ].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [socios, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  // Render paginado client-side: con ~8.400 socios renderizar todo bloquea
  // el primer paint. `printAll` fuerza el listado completo justo antes de
  // window.print() (ver el listener de beforeprint más arriba).
  const paginated = useMemo(() => {
    if (printAll) return filtered;
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage, printAll]);

  // El nombre de la categoría filtrada, o null si están todas.
  const categoriaSeleccionada = useMemo(
    () =>
      selectedCategoria === "all"
        ? null
        : (categorias.find((c) => c.id === selectedCategoria)?.nombre ?? "—"),
    [categorias, selectedCategoria],
  );

  const hayFiltroActivo = selectedCategoria !== "all" || search.trim() !== "";

  const sinCuotas = useMemo(
    () => filtered.filter((s) => s.cuotas_sociales_emitidas === 0).length,
    [filtered],
  );

  // Columnas: única fuente para el <TableHeader>, las celdas, colSpan/skeleton
  // y los headers de export — un columnCount hardcodeado se hubiera
  // desincronizado del header. Las que salen del padrón electoral se marcan
  // con printHidden en vez de sacarlas del array: quitarlas achicaría también
  // el Excel y el CSV, que son justamente los que hay que poder auditar.
  const columns = useMemo<Column[]>(() => {
    const base: Column[] = [
      {
        key: "nro_socio",
        label: "Nro Socio",
        render: (s) => <span className="font-medium">{s.nro_socio}</span>,
      },
      { key: "apellido", label: "Apellido", render: (s) => s.apellido },
      { key: "nombre", label: "Nombre", render: (s) => s.nombre },
      {
        key: "dni",
        label: "DNI",
        render: (s) => s.dni,
        printHidden: soloHabilitados,
      },
      {
        key: "categoria",
        label: "Categoría",
        render: (s) => s.categoria,
        printHidden: soloHabilitados,
      },
      {
        key: "fecha_alta",
        label: "Fecha Alta",
        render: (s) => formatDateOnly(s.fecha_alta),
        printHidden: soloHabilitados,
      },
      {
        key: "localidad",
        label: "Localidad",
        render: (s) => s.localidad ?? "—",
        printHidden: soloHabilitados,
      },
    ];
    if (soloHabilitados) {
      base.push(
        {
          key: "edad",
          label: "Edad",
          render: (s) => s.edad ?? "—",
          printHidden: soloHabilitados,
        },
        {
          key: "antiguedad_anios",
          label: "Antigüedad",
          render: (s) => s.antiguedad_anios,
          printHidden: soloHabilitados,
        },
      );
    }
    return base;
  }, [soloHabilitados]);

  // Las pistas del grid de impresión salen de `columns` y no de un "3"
  // hardcodeado: agregar una columna al padrón electoral, o dar vuelta un
  // printHidden, desalineaba la hoja impresa sin error de compilación y sin
  // ningún síntoma en pantalla.
  const printGridTracks = useMemo(() => {
    const visibles = columns.filter((c) => !c.printHidden).length;
    if (visibles <= 1) return "1fr";
    // La primera (Nro Socio) es angosta y de ancho fijo para que las filas
    // alineen entre sí dentro de cada columna de nombres.
    return ["10mm", ...Array(visibles - 1).fill("1fr")].join(" ");
  }, [columns]);

  const exportHeaders = useMemo(
    () => columns.map((c) => ({ key: c.key, label: c.label })),
    [columns],
  );

  // exportToCSV/exportToExcel leen row[h.key] crudo, sin formatear: se
  // preformatea acá para no exportar fecha_alta en ISO ni "null" en vez de "—".
  const exportRows = useMemo(
    () =>
      filtered.map((s) => ({
        ...s,
        fecha_alta: formatDateOnly(s.fecha_alta),
        localidad: s.localidad ?? "—",
        edad: s.edad ?? "—",
      })),
    [filtered],
  );

  function handleExportCSV() {
    const filename = soloHabilitados
      ? `padron_electoral_${todayISO()}`
      : `padron_socios_${todayISO()}`;
    exportToCSV(
      exportRows as unknown as Record<string, unknown>[],
      filename,
      exportHeaders,
    );
  }

  function handleExportExcel() {
    const filename = soloHabilitados
      ? `padron_electoral_${todayISO()}`
      : `padron_socios_${todayISO()}`;
    const sheetName = soloHabilitados ? "Padrón Electoral" : "Padrón";
    exportToExcel(
      exportRows as unknown as Record<string, unknown>[],
      filename,
      sheetName,
      exportHeaders,
    );
  }

  function handlePrint() {
    setPrinting(true);
    // setTimeout y no flushSync directo acá: hace falta ceder un frame para
    // que el navegador pinte "Imprimiendo…" antes de que el listener de
    // beforeprint dispare el flushSync que monta ~8.400 filas y congela el
    // hilo principal varios segundos.
    setTimeout(() => {
      window.print();
      // Fallback: en navegadores/webviews donde afterprint no dispara (o
      // print() no bloquea, p. ej. iOS Safari) esto restaura igual el estado.
      printTimeoutRef.current = setTimeout(() => {
        setPrintAll(false);
        setPrinting(false);
      }, 8000);
    }, 50);
  }

  return (
    <div className="space-y-4">
      {/* print:hidden acá, no en PageHeader (compartido con otras pantallas):
          evita el <h1> duplicado con el encabezado de impresión de abajo. */}
      <div className="print:hidden">
        <PageHeader
          title={soloHabilitados ? "Padrón Electoral" : "Padrón de Socios"}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="solo-habilitados"
                  checked={soloHabilitados}
                  onCheckedChange={handleToggleSoloHabilitados}
                />
                <Label
                  htmlFor="solo-habilitados"
                  className="whitespace-nowrap"
                >
                  Solo habilitados a votar
                </Label>
              </div>
              <Select
                value={selectedCategoria}
                onValueChange={handleCategoriaChange}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categoriasDisponibles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={!!error}
              >
                <Download className="mr-1.5 h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={!!error}
              >
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={printing || !!error}
              >
                <Printer className="mr-1.5 h-4 w-4" />
                {printing ? "Imprimiendo…" : "Imprimir"}
              </Button>
            </div>
          }
        />
      </div>

      <div className="relative sm:max-w-xs print:hidden">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nro, apellido, nombre, DNI, categoría o localidad..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Encabezado de impresión: lo que hace auditable la hoja emitida.
          El padrón electoral se publica en los sectores del club, así que va
          mínimo (título y fecha); el padrón general conserva el detalle. */}
      <div className="hidden print:block">
        <h1 className="text-lg font-bold">
          {soloHabilitados ? "Padrón Electoral" : "Padrón de Socios"}
        </h1>
        <p className="text-sm">
          Fecha de emisión: {formatDateOnly(todayISO())}
        </p>
        {soloHabilitados ? (
          // Con un filtro puesto la hoja tiene que decir que es parcial: si no,
          // buscar "Gonz" e imprimir publica 40 nombres bajo el título "Padrón
          // Electoral" sin ninguna señal de que faltan los otros 8.300.
          hayFiltroActivo && (
            <p className="text-sm font-medium">
              Listado parcial: {filtered.length}{" "}
              {filtered.length === 1 ? "habilitado" : "habilitados"}
              {categoriaSeleccionada && ` · Categoría: ${categoriaSeleccionada}`}
              {search.trim() && ` · Búsqueda: "${search.trim()}"`}
            </p>
          )
        ) : (
          <>
            <p className="text-sm">Total: {filtered.length} socios</p>
            <p className="text-sm">
              Categoría: {categoriaSeleccionada ?? "Todas"}
              {search.trim() && ` · Búsqueda: "${search.trim()}"`}
            </p>
          </>
        )}
      </div>

      <div
        className="rounded-md border print:border-none"
        data-padron-compacto={soloHabilitados ? "" : undefined}
      >
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(c.printHidden && "print:hidden")}
                >
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn(c.printHidden && "print:hidden")}
                    >
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <p className="text-destructive">
                    {error === "sin_permiso"
                      ? "No tenés permiso para ver el padrón."
                      : "Error al cargar el padrón. Reintentá en unos segundos."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={fetchData}
                  >
                    Reintentar
                  </Button>
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Sin resultados.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((s) => (
                <TableRow key={s.id}>
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn(c.printHidden && "print:hidden")}
                    >
                      {c.render(s)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between print:hidden">
          <p className="text-sm text-muted-foreground">
            Total: {filtered.length}{" "}
            {soloHabilitados ? "habilitados a votar" : "socios"}
            {search.trim() && ` (de ${socios.length})`}
            {totalPages > 1 &&
              ` · ${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, filtered.length)}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
        {soloHabilitados &&
          !isLoading &&
          !error &&
          (periodoCorte === null ? (
            <p
              className="text-sm font-medium text-amber-600 print:hidden"
              role="alert"
            >
              Sin criterio de deuda activo: no hay cuotas sociales
              (&quot;afecta padrón&quot;) emitidas a la fecha.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground print:hidden">
              Al día hasta {formatPeriodoCorte(periodoCorte)} inclusive.
            </p>
          ))}
        {/* print:hidden como sus hermanas de arriba: es una métrica interna de
            calidad de datos. En la hoja que se pega en el club quedaría como el
            único número de la página y se lee como "137 socios deben cuotas". */}
        {soloHabilitados && !isLoading && !error && (
          <p className="text-xs text-muted-foreground print:hidden">
            {sinCuotas} habilitados no tienen cuotas sociales emitidas
          </p>
        )}
      </div>

      <style jsx global>{`
        @media print {
          /* Aplica a todo el trabajo de impresión, no sólo al padrón
             electoral: @page no se puede scopear a un selector. Es la única
             regla de acá que también toca la hoja del padrón general. */
          @page {
            margin: 12mm;
          }
          header,
          nav,
          [data-print-hide] {
            display: none !important;
          }
          main {
            padding: 0 !important;
          }
          thead {
            display: table-header-group;
          }
          tr {
            break-inside: avoid;
          }
          /* Densidad del padrón electoral. Medido sobre 8.400 socios: la tabla
             de pantalla (td p-4 = 16px arriba y abajo, th h-12) da ~16 nombres
             por hoja y 495 páginas para pegar en la pared. Bajando padding y
             cuerpo de letra son 156; en dos columnas de nombres, 73 — ~115
             nombres por hoja. El grueso del desperdicio no era la fuente sino
             el padding y la mitad derecha vacía de la hoja: tres columnas de
             texto corto no llenan un A4 a lo ancho.

             9pt es el piso legible de parado a un brazo de distancia; 8pt
             entraba en ~62 páginas pero ya cuesta leerlo en una pared.

             Se pierde la fila de encabezado repetida (el thead no se puede
             repetir arriba de cada columna), decisión tomada a cambio de las
             hojas. Salvo el margen de @page, todo esto va scopeado a
             [data-padron-compacto]: el padrón general se imprime con sus
             columnas y su encabezado como siempre. */
          [data-padron-compacto] table {
            display: block;
            font-size: 9pt;
            line-height: 1.2;
          }
          /* El wrapper de <Table> trae overflow-auto: un contenedor de scroll
             puede cortar el contenido en la primera página al paginar. */
          [data-padron-compacto] .overflow-auto {
            overflow: visible;
          }
          [data-padron-compacto] thead {
            display: none;
          }
          [data-padron-compacto] tbody {
            display: block;
            column-count: 2;
            column-gap: 6mm;
            column-fill: auto;
          }
          [data-padron-compacto] tbody tr {
            display: grid;
            grid-template-columns: ${printGridTracks};
            column-gap: 2mm;
          }
          /* Las filas de "Sin resultados." y de error son un solo td con
             colSpan, que display:grid ignora: sin esto el mensaje entra
             aplastado en la primera pista de 10mm. */
          [data-padron-compacto] tbody td[colspan] {
            grid-column: 1 / -1;
          }
          [data-padron-compacto] tbody td {
            display: block;
            padding: 1px 2px;
          }
          /* Reafirmar el ocultamiento, que si no se pierde en la cascada: la
             regla de arriba es (0,1,2) y la utilidad .print\\:hidden de Tailwind
             es (0,1,0), así que el display:block le gana y las columnas
             ocultas —DNI incluido— volvían a imprimirse. Verificado contando
             las celdas dibujadas en el PDF: 3 en vez de 2. Es la clase de
             regresión que no se ve en pantalla y termina en la pared. */
          [data-padron-compacto] tbody td.print\\:hidden,
          [data-padron-compacto] thead th.print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
