"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { getAllMorosos } from "./actions";
import { formatDate, formatCurrency, exportToCSV } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import type { SocioMoroso } from "@/types/socios";

const PAGE_SIZE = 50;

const columns: ColumnDef<SocioMoroso>[] = [
  { accessorKey: "nro_socio", header: "Nro Socio" },
  { accessorKey: "apellido", header: "Apellido" },
  { accessorKey: "nombre", header: "Nombre" },
  { accessorKey: "dni", header: "DNI" },
  { accessorKey: "categoria", header: "Categoría" },
  {
    accessorKey: "cuotas_impagas",
    header: "Cuotas Impagas",
    cell: ({ row }) => {
      const v = Number(row.original.cuotas_impagas);
      return (
        <span className={v > 3 ? "font-bold text-red-600" : ""}>
          {v}
        </span>
      );
    },
  },
  {
    accessorKey: "monto_adeudado",
    header: "Monto Adeudado",
    cell: ({ row }) => formatCurrency(Number(row.original.monto_adeudado)),
  },
  {
    accessorKey: "ultima_cuota_pagada",
    header: "Última Cuota Pagada",
    cell: ({ row }) => formatDate(row.original.ultima_cuota_pagada),
  },
];

export default function MorososPage() {
  const [allData, setAllData] = useState<SocioMoroso[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await getAllMorosos();
      setAllData(all);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allData;
    return allData.filter((s) =>
      [s.apellido, s.nombre, s.dni, String(s.nro_socio), s.categoria].some(
        (v) => v?.toLowerCase().includes(q),
      ),
    );
  }, [allData, search]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const morososHeaders = [
    { key: "nro_socio", label: "Nro Socio" },
    { key: "apellido", label: "Apellido" },
    { key: "nombre", label: "Nombre" },
    { key: "dni", label: "DNI" },
    { key: "categoria", label: "Categoría" },
    { key: "cuotas_impagas", label: "Cuotas Impagas" },
    { key: "monto_adeudado", label: "Monto Adeudado" },
    { key: "ultima_cuota_pagada", label: "Última Cuota Pagada" },
  ];

  function handleExportCSV() {
    exportToCSV(
      filtered as unknown as Record<string, unknown>[],
      "socios_morosos",
      morososHeaders,
    );
  }

  function handleExportExcel() {
    exportToExcel(
      filtered as unknown as Record<string, unknown>[],
      "socios_morosos",
      "Morosos",
      morososHeaders,
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Socios Morosos" />
      <DataTable
        columns={columns}
        data={pageData}
        totalCount={filtered.length}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        searchPlaceholder="Buscar por nro, apellido, nombre, DNI o categoría..."
        isLoading={isLoading}
        onExportCSV={handleExportCSV}
        onExportExcel={handleExportExcel}
      />
    </div>
  );
}
