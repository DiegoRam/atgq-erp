"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exportToCSV } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { getInventario } from "./actions";
import {
  TIPO_UBICACION_LABELS,
  type InventarioRow,
  type TipoUbicacion,
} from "@/types/stock";

interface DepositoGroup {
  deposito_id: string;
  deposito_nombre: string;
  deposito_tipo: TipoUbicacion;
  items: InventarioRow[];
}

export default function InventarioPage() {
  const [groups, setGroups] = useState<DepositoGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNegative, setHasNegative] = useState(false);
  const [search, setSearch] = useState("");

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => {
        if (group.deposito_nombre.toLowerCase().includes(q)) return group;
        const items = group.items.filter((row) =>
          [row.item?.nombre, row.item?.unidad].some((v) =>
            v?.toLowerCase().includes(q),
          ),
        );
        return { ...group, items };
      })
      .filter((group) => group.items.length > 0);
  }, [groups, search]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getInventario();

      // Group by deposito
      const groupMap = new Map<string, DepositoGroup>();
      let negative = false;

      for (const row of data) {
        const depId = row.deposito_id;
        const depName = row.deposito?.nombre ?? "Sin ubicación";

        if (!groupMap.has(depId)) {
          groupMap.set(depId, {
            deposito_id: depId,
            deposito_nombre: depName,
            deposito_tipo: row.deposito?.tipo ?? "deposito",
            items: [],
          });
        }
        groupMap.get(depId)!.items.push(row);

        if (row.cantidad < 0) negative = true;
      }

      // Sort groups by name
      const sorted = Array.from(groupMap.values()).sort(
        (a, b) =>
          a.deposito_tipo.localeCompare(b.deposito_tipo) ||
          a.deposito_nombre.localeCompare(b.deposito_nombre),
      );

      // Sort items within each group
      for (const group of sorted) {
        group.items.sort((a, b) =>
          (a.item?.nombre ?? "").localeCompare(b.item?.nombre ?? ""),
        );
      }

      setGroups(sorted);
      setHasNegative(negative);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const inventarioHeaders = [
    { key: "tipo", label: "Tipo" },
    { key: "deposito", label: "Ubicación" },
    { key: "item", label: "Ítem" },
    { key: "unidad", label: "Unidad" },
    { key: "cantidad", label: "Cantidad" },
  ];

  function getExportData() {
    const rows: Record<string, unknown>[] = [];
    for (const group of filteredGroups) {
      for (const row of group.items) {
        rows.push({
          tipo: TIPO_UBICACION_LABELS[group.deposito_tipo],
          deposito: group.deposito_nombre,
          item: row.item?.nombre ?? "",
          unidad: row.item?.unidad ?? "",
          cantidad: row.cantidad,
        });
      }
    }
    return rows;
  }

  function handleExportCSV() {
    exportToCSV(getExportData(), "inventario_stock", inventarioHeaders);
  }

  function handleExportExcel() {
    exportToExcel(
      getExportData(),
      "inventario_stock",
      "Inventario",
      inventarioHeaders,
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventario"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="mr-1.5 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              Excel
            </Button>
          </div>
        }
      />

      {hasNegative && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Hay ítems con stock negativo. Revise los movimientos pendientes.
          </span>
        </div>
      )}

      <div className="relative sm:max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por ítem, unidad o ubicación..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          Cargando inventario...
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No hay datos de inventario
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => (
            <Collapsible key={group.deposito_id} defaultOpen>
              <CollapsibleTrigger asChild>
                <button
                  className={`flex w-full items-center justify-between rounded-md px-4 py-2.5 text-left font-medium ${
                    group.deposito_tipo === "punto_venta"
                      ? "bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                      : "bg-blue-50 text-blue-900 hover:bg-blue-100"
                  }`}
                >
                  <span>
                    {TIPO_UBICACION_LABELS[group.deposito_tipo]} &rArr;{" "}
                    {group.deposito_nombre}{" "}
                    <span
                      className={`text-sm font-normal ${
                        group.deposito_tipo === "punto_venta"
                          ? "text-emerald-600"
                          : "text-blue-600"
                      }`}
                    >
                      ({group.items.length} ítems)
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ítem</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="w-32 text-right">
                        Cantidad
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((row) => {
                      const qty = row.cantidad;
                      const qtyClass =
                        qty <= 0
                          ? "text-red-600 font-bold"
                          : qty <= 10
                            ? "text-orange-600 font-semibold"
                            : "";
                      return (
                        <TableRow key={row.id}>
                          <TableCell>{row.item?.nombre ?? "—"}</TableCell>
                          <TableCell>{row.item?.unidad ?? "—"}</TableCell>
                          <TableCell className={`text-right ${qtyClass}`}>
                            {qty}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
