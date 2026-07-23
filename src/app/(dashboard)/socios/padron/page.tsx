"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { getPadron } from "./actions";
import { getCategorias } from "../actions";
import { formatDate, exportToCSV } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import type { Socio, CategoriaSocial } from "@/types/socios";

export default function PadronPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [categorias, setCategorias] = useState<CategoriaSocial[]>([]);
  const [selectedCategoria, setSelectedCategoria] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return socios;
    return socios.filter((s) =>
      [s.apellido, s.nombre, s.dni, String(s.nro_socio), s.localidad].some(
        (v) => v?.toLowerCase().includes(q),
      ),
    );
  }, [socios, search]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPadron(
        selectedCategoria !== "all" ? selectedCategoria : undefined,
      );
      setSocios(data as Socio[]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategoria]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getCategorias().then(setCategorias);
  }, []);

  const padronHeaders = [
    { key: "nro_socio", label: "Nro Socio" },
    { key: "apellido", label: "Apellido" },
    { key: "nombre", label: "Nombre" },
    { key: "dni", label: "DNI" },
    { key: "fecha_alta", label: "Fecha Alta" },
    { key: "localidad", label: "Localidad" },
  ];

  function handleExportCSV() {
    exportToCSV(
      filtered as unknown as Record<string, unknown>[],
      "padron_socios",
      padronHeaders,
    );
  }

  function handleExportExcel() {
    exportToExcel(
      filtered as unknown as Record<string, unknown>[],
      "padron_socios",
      "Padrón",
      padronHeaders,
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Padrón de Socios"
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={selectedCategoria}
              onValueChange={setSelectedCategoria}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="mr-1.5 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="mr-1.5 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        }
      />

      <div className="relative sm:max-w-xs print:hidden">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nro, apellido, nombre, DNI o localidad..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="rounded-md border print:border-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nro Socio</TableHead>
              <TableHead>Apellido</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Fecha Alta</TableHead>
              <TableHead>Localidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Sin resultados.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.nro_socio}</TableCell>
                  <TableCell>{s.apellido}</TableCell>
                  <TableCell>{s.nombre}</TableCell>
                  <TableCell>{s.dni}</TableCell>
                  <TableCell>{s.categoria?.nombre ?? "—"}</TableCell>
                  <TableCell>{formatDate(s.fecha_alta)}</TableCell>
                  <TableCell>{s.localidad ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground print:hidden">
        Total: {filtered.length} socios
      </p>

      <style jsx global>{`
        @media print {
          header, nav, [data-print-hide] { display: none !important; }
          main { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
