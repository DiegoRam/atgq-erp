"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registrarPago } from "@/app/(dashboard)/socios/cuotas/actions";
import { getMetodosCobranza } from "@/app/(dashboard)/socios/actions";
import type { Cuota, MetodoCobranza } from "@/types/socios";
import { format } from "date-fns";

interface RegistrarPagoFormProps {
  open: boolean;
  onOpenChange: () => void;
  cuota: Cuota;
  onSaved: () => void;
}

export function RegistrarPagoForm({
  open,
  onOpenChange,
  cuota,
  onSaved,
}: RegistrarPagoFormProps) {
  const [monto, setMonto] = useState(String(cuota.monto));
  const [fechaPago, setFechaPago] = useState(format(new Date(), "yyyy-MM-dd"));
  const [metodoPagoId, setMetodoPagoId] = useState("");
  const [metodos, setMetodos] = useState<MetodoCobranza[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      getMetodosCobranza().then(setMetodos);
      setMonto(String(cuota.monto));
      setFechaPago(format(new Date(), "yyyy-MM-dd"));
      setMetodoPagoId("");
    }
  }, [open, cuota.monto]);

  async function handleSubmit() {
    if (!metodoPagoId) {
      toast.error("Seleccione un método de pago");
      return;
    }
    setIsSubmitting(true);
    try {
      await registrarPago(cuota.id, {
        monto: Number(monto),
        fecha_pago: fechaPago,
        metodo_pago_id: metodoPagoId,
      });
      toast.success("Pago registrado correctamente");
      onSaved();
    } catch {
      toast.error("Error al registrar el pago");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Pago"
      description={`Período: ${cuota.periodo}`}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="monto">Monto</Label>
          <Input
            id="monto"
            type="number"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fecha_pago">Fecha de Pago</Label>
          <Input
            id="fecha_pago"
            type="date"
            value={fechaPago}
            onChange={(e) => setFechaPago(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Método de Pago</Label>
          <Select value={metodoPagoId} onValueChange={setMetodoPagoId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {metodos.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FormModal>
  );
}
