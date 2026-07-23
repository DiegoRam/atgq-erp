"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cuotas;
    return cuotas.filter((c) =>
      [
        c.periodo,
        formatDate(c.periodo),
        c.tipo_cuota?.nombre,
        c.metodo_pago?.nombre,
        c.pagada ? "pagada" : "impaga",
      ].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [cuotas, search]);

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

      <div className="relative sm:max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por período, tipo, método o estado..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
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
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Sin cuotas registradas.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
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
