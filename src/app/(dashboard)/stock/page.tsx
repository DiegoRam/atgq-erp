"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, ChevronDown, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
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
import { getInventario } from "./actions";
import type { InventarioRow } from "@/types/stock";

interface DepositoGroup {
  deposito_id: string;
  deposito_nombre: string;
  items: InventarioRow[];
}

export default function InventarioPage() {
  const [groups, setGroups] = useState<DepositoGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNegative, setHasNegative] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getInventario();

      // Group by deposito
      const groupMap = new Map<string, DepositoGroup>();
      let negative = false;

      for (const row of data) {
        const depId = row.deposito_id;
        const depName = row.deposito?.nombre ?? "Sin depósito";

        if (!groupMap.has(depId)) {
          groupMap.set(depId, {
            deposito_id: depId,
            deposito_nombre: depName,
            items: [],
          });
        }
        groupMap.get(depId)!.items.push(row);

        if (row.cantidad < 0) negative = true;
      }

      // Sort groups by name
      const sorted = Array.from(groupMap.values()).sort((a, b) =>
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

  function handleExportCSV() {
    const rows: Record<string, unknown>[] = [];
    for (const group of groups) {
      for (const row of group.items) {
        rows.push({
          deposito: group.deposito_nombre,
          item: row.item?.nombre ?? "",
          unidad: row.item?.unidad ?? "",
          cantidad: row.cantidad,
        });
      }
    }
    exportToCSV(rows, "inventario_stock", [
      { key: "deposito", label: "Depósito" },
      { key: "item", label: "Ítem" },
      { key: "unidad", label: "Unidad" },
      { key: "cantidad", label: "Cantidad" },
    ]);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventario"
        actions={
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-1.5 h-4 w-4" />
            Exportar CSV
          </Button>
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

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          Cargando inventario...
        </div>
      ) : groups.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No hay datos de inventario
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Collapsible key={group.deposito_id} defaultOpen>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-md bg-blue-50 px-4 py-2.5 text-left font-medium text-blue-900 hover:bg-blue-100">
                  <span>
                    Depósito &rArr; {group.deposito_nombre}{" "}
                    <span className="text-sm font-normal text-blue-600">
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
