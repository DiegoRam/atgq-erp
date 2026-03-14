"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  getActividadesConInscriptos,
  previewGeneracion,
  generarCuotaActividad,
} from "./actions";

type ActividadOption = {
  id: string;
  nombre: string;
  monto_cuota: number | null;
  inscriptos_count: number;
};

export default function GenerarCuotaActividadPage() {
  const [actividades, setActividades] = useState<ActividadOption[]>([]);
  const [actividadId, setActividadId] = useState("");
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [monto, setMonto] = useState("");
  const [preview, setPreview] = useState<{ count: number; actividad: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    getActividadesConInscriptos().then(setActividades);
  }, []);

  // Pre-fill monto when actividad changes
  useEffect(() => {
    if (actividadId) {
      const act = actividades.find((a) => a.id === actividadId);
      if (act?.monto_cuota != null) {
        setMonto(String(act.monto_cuota));
      }
    }
    setPreview(null);
  }, [actividadId, actividades]);

  const periodo = `${anio}-${mes}-01`;

  async function handlePreview() {
    if (!actividadId) {
      toast.error("Seleccione una actividad");
      return;
    }
    try {
      const result = await previewGeneracion(actividadId, periodo);
      setPreview(result);
    } catch {
      toast.error("Error al obtener vista previa");
    }
  }

  async function handleGenerar() {
    if (!actividadId || !monto) {
      toast.error("Complete todos los campos");
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generarCuotaActividad(actividadId, periodo, Number(monto));
      toast.success(
        `Se generaron ${result.count} cuotas por un total de ${formatCurrency(result.total)}`,
      );
      setPreview(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar cuotas");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Generar Cuota de Actividades"
        description="Genera cuotas para los socios inscriptos en una actividad"
      />

      <div className="grid max-w-2xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Actividad</Label>
              <Select value={actividadId} onValueChange={setActividadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar actividad..." />
                </SelectTrigger>
                <SelectContent>
                  {actividades.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nombre} ({a.inscriptos_count} inscriptos)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Mes</Label>
                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = String(i + 1).padStart(2, "0");
                      const labels = [
                        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
                      ];
                      return (
                        <SelectItem key={m} value={m}>
                          {labels[i]}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="anio">Año</Label>
                <Input
                  id="anio"
                  type="number"
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="monto">Monto por cuota ($)</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <Button onClick={handlePreview} variant="outline">
              Vista previa
            </Button>
          </CardContent>
        </Card>

        {preview && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vista Previa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <strong>Actividad:</strong> {preview.actividad}
              </p>
              <p className="text-sm">
                <strong>Período:</strong> {mes}/{anio}
              </p>
              <p className="text-sm">
                <strong>Socios a generar:</strong> {preview.count}
              </p>
              {monto && (
                <p className="text-sm">
                  <strong>Monto total:</strong>{" "}
                  {formatCurrency(Number(monto) * preview.count)}
                </p>
              )}
              <Button
                onClick={handleGenerar}
                disabled={isGenerating || !monto}
                className="mt-2"
              >
                {isGenerating && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Confirmar y Generar
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
