"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import { getActividadById, getInscriptosByActividad } from "../actions";
import { darDeBajaSocio } from "./actions";
import { InscribirSocioModal } from "@/components/actividades/InscribirSocioModal";
import type { Actividad, SocioActividad } from "@/types/actividades";

export default function ActividadDetallePage() {
  const params = useParams();
  const actividadId = params.id as string;
  const [actividad, setActividad] = useState<Actividad | null>(null);
  const [inscriptos, setInscriptos] = useState<SocioActividad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inscribirOpen, setInscribirOpen] = useState(false);
  const [bajaId, setBajaId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [actData, inscData] = await Promise.all([
        getActividadById(actividadId),
        getInscriptosByActividad(actividadId),
      ]);
      setActividad(actData);
      setInscriptos(inscData);
    } finally {
      setIsLoading(false);
    }
  }, [actividadId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDarDeBaja() {
    if (!bajaId) return;
    try {
      await darDeBajaSocio(bajaId);
      toast.success("Socio dado de baja de la actividad");
      setBajaId(null);
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al dar de baja",
      );
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          actividad
            ? `Actividad: ${actividad.nombre}`
            : "Detalle de Actividad"
        }
      />

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : actividad ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Nombre:</span> {actividad.nombre}
            </div>
            <div>
              <span className="font-medium">Estado:</span>{" "}
              <Badge variant={actividad.activa ? "default" : "secondary"}>
                {actividad.activa ? "Activa" : "Inactiva"}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Descripción:</span>{" "}
              {actividad.descripcion ?? "—"}
            </div>
            <div>
              <span className="font-medium">Monto Cuota:</span>{" "}
              {formatCurrency(actividad.monto_cuota)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Inscriptos ({inscriptos.length})
        </h3>
        <Button onClick={() => setInscribirOpen(true)}>Inscribir Socio</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nro Socio</TableHead>
              <TableHead>Apellido</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Fecha Inscripción</TableHead>
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
            ) : inscriptos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Sin inscriptos en esta actividad.
                </TableCell>
              </TableRow>
            ) : (
              inscriptos.map((sa) => (
                <TableRow key={sa.id}>
                  <TableCell>{sa.socio?.nro_socio ?? "—"}</TableCell>
                  <TableCell>{sa.socio?.apellido ?? "—"}</TableCell>
                  <TableCell>{sa.socio?.nombre ?? "—"}</TableCell>
                  <TableCell>{formatDate(sa.fecha_inscripcion)}</TableCell>
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

      <InscribirSocioModal
        open={inscribirOpen}
        onOpenChange={() => setInscribirOpen(false)}
        actividadId={actividadId}
        onSaved={() => {
          setInscribirOpen(false);
          fetchData();
        }}
      />

      <AlertDialog open={!!bajaId} onOpenChange={() => setBajaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar baja</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de dar de baja a este socio de la actividad? El socio
              dejará de figurar como inscripto.
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
