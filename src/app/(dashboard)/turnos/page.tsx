"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatDate } from "@/lib/format";
import { getTurnos, getInstalacionesActivas, cancelarTurno } from "./actions";
import { TurnoForm } from "@/components/turnos/TurnoForm";
import type { Turno, Instalacion } from "@/types/actividades";

export default function TurnosPage() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [instalaciones, setInstalaciones] = useState<Instalacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);

  // Filters
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroInstalacion, setFiltroInstalacion] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [turnosData, instData] = await Promise.all([
        getTurnos({
          fecha: filtroFecha || undefined,
          instalacion_id: filtroInstalacion || undefined,
          estado: filtroEstado,
        }),
        getInstalacionesActivas(),
      ]);
      setTurnos(turnosData);
      setInstalaciones(instData);
    } finally {
      setIsLoading(false);
    }
  }, [filtroFecha, filtroInstalacion, filtroEstado]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCancelar() {
    if (!cancelId) return;
    try {
      await cancelarTurno(cancelId);
      toast.success("Turno cancelado correctamente");
      setCancelId(null);
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al cancelar el turno",
      );
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Administrar Turnos" />

      <div className="flex items-end gap-4 rounded-md border bg-muted/30 p-4">
        <div className="space-y-1">
          <Label className="text-xs">Fecha</Label>
          <Input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Instalación</Label>
          <Select value={filtroInstalacion} onValueChange={setFiltroInstalacion}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {instalaciones.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="confirmado">Confirmado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFiltroFecha("");
            setFiltroInstalacion("");
            setFiltroEstado("todos");
          }}
        >
          Limpiar
        </Button>
        <div className="flex-1" />
        <Button onClick={() => setModalOpen(true)}>Nuevo Turno</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Hora Inicio</TableHead>
              <TableHead>Hora Fin</TableHead>
              <TableHead>Instalación</TableHead>
              <TableHead>Socio</TableHead>
              <TableHead>Estado</TableHead>
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
            ) : turnos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Sin turnos registrados.
                </TableCell>
              </TableRow>
            ) : (
              turnos.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDate(t.fecha_turno)}</TableCell>
                  <TableCell>{t.hora_inicio.slice(0, 5)}</TableCell>
                  <TableCell>{t.hora_fin.slice(0, 5)}</TableCell>
                  <TableCell>{t.instalacion?.nombre ?? "—"}</TableCell>
                  <TableCell>
                    {t.socio
                      ? `#${t.socio.nro_socio} — ${t.socio.apellido}, ${t.socio.nombre}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        t.estado === "confirmado" ? "default" : "secondary"
                      }
                    >
                      {t.estado === "confirmado" ? "Confirmado" : "Cancelado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {t.estado === "confirmado" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setCancelId(t.id)}
                      >
                        Cancelar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TurnoForm
        open={modalOpen}
        onOpenChange={() => setModalOpen(false)}
        instalaciones={instalaciones}
        onSaved={() => {
          setModalOpen(false);
          fetchData();
        }}
      />

      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar turno</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de cancelar este turno? Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelar}>
              Confirmar Cancelación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
