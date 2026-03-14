"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatCurrency } from "@/lib/format";
import { getCuotasBySocio, getSocioById } from "../../cuotas/actions";
import { RegistrarPagoForm } from "@/components/socios/RegistrarPagoForm";
import type { Cuota } from "@/types/socios";

export default function SocioCuotasPage() {
  const params = useParams();
  const socioId = params.id as string;
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [socio, setSocio] = useState<{ nro_socio: number; apellido: string; nombre: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCuota, setSelectedCuota] = useState<Cuota | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cuotasData, socioData] = await Promise.all([
        getCuotasBySocio(socioId),
        getSocioById(socioId),
      ]);
      setCuotas(cuotasData);
      setSocio(socioData);
    } finally {
      setIsLoading(false);
    }
  }, [socioId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          socio
            ? `Cuotas — #${socio.nro_socio} ${socio.apellido}, ${socio.nombre}`
            : "Cuotas del Socio"
        }
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha Pago</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="w-32">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : cuotas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Sin cuotas registradas.
                </TableCell>
              </TableRow>
            ) : (
              cuotas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{formatDate(c.periodo)}</TableCell>
                  <TableCell>{c.tipo_cuota?.nombre ?? "—"}</TableCell>
                  <TableCell>{formatCurrency(c.monto)}</TableCell>
                  <TableCell>
                    <Badge variant={c.pagada ? "default" : "destructive"}>
                      {c.pagada ? "Pagada" : "Impaga"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(c.fecha_pago)}</TableCell>
                  <TableCell>{c.metodo_pago?.nombre ?? "—"}</TableCell>
                  <TableCell>
                    {!c.pagada && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCuota(c)}
                      >
                        Registrar Pago
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selectedCuota && (
        <RegistrarPagoForm
          open={!!selectedCuota}
          onOpenChange={() => setSelectedCuota(null)}
          cuota={selectedCuota}
          onSaved={() => {
            setSelectedCuota(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
