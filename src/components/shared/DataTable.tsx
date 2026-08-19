"use client";

import { useState } from "react";
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSearch?: (query: string) => void;
  onSort?: (sorting: SortingState) => void;
  isLoading?: boolean;
  onNewClick?: () => void;
  newButtonLabel?: string;
  onExportCSV?: () => void;
  onExportExcel?: () => void;
  searchPlaceholder?: string;
  meta?: Record<string, unknown>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onSearch,
  onSort,
  isLoading = false,
  onNewClick,
  newButtonLabel = "Nuevo",
  onExportCSV,
  onExportExcel,
  searchPlaceholder = "Buscar...",
  meta,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [searchValue, setSearchValue] = useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil(totalCount / pageSize),
    meta,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);
      onSort?.(newSorting);
    },
    onColumnVisibilityChange: setColumnVisibility,
  });

  // Math.max(1, …): con totalCount = 0 el techo da 0 y el pie decía "Pág. 1/0".
  // Antes quedaba abajo de todo y casi no se veía; ahora se muestra también
  // arriba, y en las 6 pantallas con paginación server-side el primer render
  // tiene totalCount = 0 mientras carga, así que "0–0 de 0 · Pág. 1/0" sería lo
  // primero que se lee. `disabled={page >= totalPages}` no cambia: pasa de
  // `1 >= 0` a `1 >= 1`, true en los dos casos.
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  // Resumen + controles: se muestran arriba y abajo de la tabla. Arriba para
  // que el total y la página actual se vean sin tener que scrollear hasta el
  // final del listado; abajo se mantiene para poder pasar de página después
  // de recorrer las filas sin volver arriba.
  //
  // La desambiguación entre los dos pares de botones va en el <nav> y no en un
  // aria-label por botón: un lector de pantalla anunciando "Página anterior
  // arriba, botón" no dice nada útil, mientras que el landmark ya da el
  // contexto. Nombres accesibles repetidos NO son un problema cuando el
  // contenedor los distingue.
  function renderPaginationBar(position: "arriba" | "abajo") {
    return (
      <nav
        aria-label={
          position === "arriba"
            ? "Paginación, arriba de la tabla"
            : "Paginación, abajo de la tabla"
        }
        className="flex flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row sm:justify-between"
      >
        <span>
          {from}–{to} de {totalCount}
        </span>
        {/* Sin nada que paginar los controles son ruido: 14 de las ~20
            pantallas que usan DataTable pasan pageSize = cantidad de filas, así
            que nunca tienen más de una página y mostraban un par de botones
            permanentemente deshabilitados. El total sí se muestra siempre.
            Mismo criterio que /socios/padron, que ya gateaba en totalPages > 1. */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm">
              Pág. {page}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </nav>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {onSearch && (
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                onSearch(e.target.value);
              }}
              className="pl-8"
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Columnas</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={(v) => col.toggleVisibility(!!v)}
                  >
                    {typeof col.columnDef.header === "string"
                      ? col.columnDef.header
                      : col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {onExportCSV && (
            <Button variant="outline" size="sm" onClick={onExportCSV}>
              <Download className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          )}
          {onExportExcel && (
            <Button variant="outline" size="sm" onClick={onExportExcel}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
          )}
          {onNewClick && (
            <Button size="sm" onClick={onNewClick}>
              <Plus className="mr-1.5 h-4 w-4" />
              {newButtonLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Resumen + paginación arriba de la tabla: con listados largos había
          que scrollear hasta el final para saber cuántos resultados hay y en
          qué página se está. El bloque de abajo se mantiene para poder pasar
          de página sin volver arriba después de recorrer la página actual. */}
      {renderPaginationBar("arriba")}

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={
                      header.column.getCanSort()
                        ? "cursor-pointer select-none"
                        : ""
                    }
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {header.column.getIsSorted() === "asc" && (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                      {header.column.getIsSorted() === "desc" && (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((_, j) => (
                    <TableCell key={`skeleton-${i}-${j}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Sin resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {renderPaginationBar("abajo")}
    </div>
  );
}
