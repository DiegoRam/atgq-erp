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
import {
  getTiposCuotas,
  previewGeneracionMasiva,
  generarCuotasMasivas,
} from "../actions";

export default function GenerarCuotasPage() {
  const [tiposCuotas, setTiposCuotas] = useState<{ id: string; nombre: string }[]>([]);
  const [tipoCuotaId, setTipoCuotaId] = useState("");
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [monto, setMonto] = useState("");
  const [preview, setPreview] = useState<{ count: number; tipoCuota: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    getTiposCuotas().then(setTiposCuotas);
  }, []);

  const periodo = `${anio}-${mes}-01`;

  async function handlePreview() {
    if (!tipoCuotaId) {
      toast.error("Seleccione un tipo de cuota");
      return;
    }
    try {
      const result = await previewGeneracionMasiva(periodo, tipoCuotaId);
      setPreview(result);
    } catch {
      toast.error("Error al obtener preview");
    }
  }

  async function handleGenerar() {
    if (!tipoCuotaId || !monto) {
      toast.error("Complete todos los campos");
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generarCuotasMasivas(periodo, tipoCuotaId, Number(monto));
      toast.success(`Se generaron ${result.count} cuotas correctamente`);
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
        title="Generar Cuotas Masivas"
        description="Genera cuotas para todos los socios activos"
      />

      <div className="grid max-w-2xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label>Tipo de Cuota</Label>
              <Select value={tipoCuotaId} onValueChange={setTipoCuotaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {tiposCuotas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <strong>Tipo:</strong> {preview.tipoCuota}
              </p>
              <p className="text-sm">
                <strong>Período:</strong> {mes}/{anio}
              </p>
              <p className="text-sm">
                <strong>Socios a generar:</strong> {preview.count}
              </p>
              {monto && (
                <p className="text-sm">
                  <strong>Monto total:</strong> ${(Number(monto) * preview.count).toLocaleString("es-AR")}
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
