"use client";

import { useEffect, useState, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { getSociosMorosos, getAllMorosos } from "./actions";
import { formatDate, formatCurrency, exportToCSV } from "@/lib/format";
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
  const [data, setData] = useState<SocioMoroso[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getSociosMorosos(page, PAGE_SIZE);
      setData(result.data);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleExportCSV() {
    const all = await getAllMorosos();
    exportToCSV(
      all as unknown as Record<string, unknown>[],
      "socios_morosos",
      [
        { key: "nro_socio", label: "Nro Socio" },
        { key: "apellido", label: "Apellido" },
        { key: "nombre", label: "Nombre" },
        { key: "dni", label: "DNI" },
        { key: "categoria", label: "Categoría" },
        { key: "cuotas_impagas", label: "Cuotas Impagas" },
        { key: "monto_adeudado", label: "Monto Adeudado" },
        { key: "ultima_cuota_pagada", label: "Última Cuota Pagada" },
      ],
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Socios Morosos" />
      <DataTable
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isLoading={isLoading}
        onExportCSV={handleExportCSV}
      />
    </div>
  );
}
