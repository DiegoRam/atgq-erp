"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatCurrency } from "@/lib/format";
import {
  getActividadesBySocio,
  getActividadesDisponibles,
  inscribirEnActividad,
  darDeBaja,
  getSocioById,
} from "./actions";
import type { SocioActividad } from "@/types/actividades";

export default function SocioActividadesPage() {
  const params = useParams();
  const socioId = params.id as string;
  const [actividades, setActividades] = useState<SocioActividad[]>([]);
  const [disponibles, setDisponibles] = useState<{ id: string; nombre: string; monto_cuota: number | null }[]>([]);
  const [socio, setSocio] = useState<{ nro_socio: number; apellido: string; nombre: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedActividadId, setSelectedActividadId] = useState("");
  const [bajaId, setBajaId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [actData, dispData, socioData] = await Promise.all([
        getActividadesBySocio(socioId),
        getActividadesDisponibles(),
        getSocioById(socioId),
      ]);
      setActividades(actData);
      setDisponibles(dispData);
      setSocio(socioData);
    } finally {
      setIsLoading(false);
    }
  }, [socioId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleInscribir() {
    if (!selectedActividadId) {
      toast.error("Seleccione una actividad");
      return;
    }
    try {
      await inscribirEnActividad(socioId, selectedActividadId);
      toast.success("Socio inscripto en la actividad");
      setSelectedActividadId("");
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al inscribir",
      );
    }
  }

  async function handleDarDeBaja() {
    if (!bajaId) return;
    try {
      await darDeBaja(bajaId);
      toast.success("Socio dado de baja de la actividad");
      setBajaId(null);
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al dar de baja",
      );
    }
  }

  // Filter out actividades the socio is already in
  const inscriptaIds = new Set(actividades.map((a) => a.actividad_id));
  const actividadesDisponibles = disponibles.filter(
    (d) => !inscriptaIds.has(d.id),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          socio
            ? `Actividades — #${socio.nro_socio} ${socio.apellido}, ${socio.nombre}`
            : "Actividades del Socio"
        }
      />

      <div className="flex items-end gap-3 rounded-md border bg-muted/30 p-4">
        <div className="flex-1 space-y-1">
          <span className="text-sm font-medium">Inscribir en actividad</span>
          <Select value={selectedActividadId} onValueChange={setSelectedActividadId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar actividad..." />
            </SelectTrigger>
            <SelectContent>
              {actividadesDisponibles.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nombre} {a.monto_cuota != null ? `— ${formatCurrency(Number(a.monto_cuota))}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleInscribir} disabled={!selectedActividadId}>
          Inscribir
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Actividad</TableHead>
              <TableHead>Monto Cuota</TableHead>
              <TableHead>Fecha Inscripción</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-32">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : actividades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  El socio no está inscripto en ninguna actividad.
                </TableCell>
              </TableRow>
            ) : (
              actividades.map((sa) => (
                <TableRow key={sa.id}>
                  <TableCell className="font-medium">
                    {sa.actividad?.nombre ?? "—"}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(sa.actividad?.monto_cuota != null ? Number(sa.actividad.monto_cuota) : null)}
                  </TableCell>
                  <TableCell>{formatDate(sa.fecha_inscripcion)}</TableCell>
                  <TableCell>
                    <Badge variant="default">Activa</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setBajaId(sa.id)}
                    >
                      Dar de baja
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!bajaId} onOpenChange={() => setBajaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar baja</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de dar de baja al socio de esta actividad?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDarDeBaja}>
              Confirmar Baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
