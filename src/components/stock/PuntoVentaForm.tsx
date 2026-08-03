"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { depositoSchema, type DepositoSchemaType } from "@/lib/schemas/stock";
import {
  createPuntoVenta,
  updatePuntoVenta,
  getCajasForSelect,
} from "@/app/(dashboard)/stock/puntos-venta/actions";
import type { Deposito } from "@/types/stock";

const SIN_CAJA = "__sin_caja__";

interface PuntoVentaFormProps {
  open: boolean;
  onOpenChange: () => void;
  puntoVenta: Deposito | null;
  onSaved: () => void;
}

export function PuntoVentaForm({
  open,
  onOpenChange,
  puntoVenta,
  onSaved,
}: PuntoVentaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cajas, setCajas] = useState<{ id: string; nombre: string }[]>([]);
  const isEditing = !!puntoVenta;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DepositoSchemaType>({
    resolver: zodResolver(depositoSchema),
  });

  useEffect(() => {
    if (!open) return;
    getCajasForSelect()
      .then(setCajas)
      .catch(() => setCajas([]));
  }, [open]);

  useEffect(() => {
    if (open && puntoVenta) {
      reset({
        nombre: puntoVenta.nombre,
        descripcion: puntoVenta.descripcion,
        activo: puntoVenta.activo,
        tipo: "punto_venta",
        caja_id: puntoVenta.caja_id,
      });
    } else if (open) {
      reset({
        nombre: "",
        descripcion: null,
        activo: true,
        tipo: "punto_venta",
        caja_id: null,
      });
    }
  }, [open, puntoVenta, reset]);

  async function onSubmit(data: DepositoSchemaType) {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updatePuntoVenta(puntoVenta.id, data);
        toast.success("Punto de venta actualizado correctamente");
      } else {
        await createPuntoVenta(data);
        toast.success("Punto de venta creado correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Error al guardar el punto de venta",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const activoValue = watch("activo");
  const cajaValue = watch("caja_id");

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Punto de Venta" : "Nuevo Punto de Venta"}
      description={
        isEditing
          ? `Editando punto de venta "${puntoVenta?.nombre}"`
          : "Complete los datos del nuevo punto de venta"
      }
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" {...register("nombre")} />
          {errors.nombre && (
            <p className="text-xs text-red-500">{errors.nombre.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="descripcion">Descripción</Label>
          <Input id="descripcion" {...register("descripcion")} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="caja_id">Caja asociada</Label>
          <Select
            value={cajaValue ?? SIN_CAJA}
            onValueChange={(v) =>
              setValue("caja_id", v === SIN_CAJA ? null : v)
            }
          >
            <SelectTrigger id="caja_id">
              <SelectValue placeholder="Seleccione una caja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_CAJA}>Ninguna</SelectItem>
              {cajas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Las ventas de este sector se acreditan como ingreso en esta caja.
          </p>
          {errors.caja_id && (
            <p className="text-xs text-red-500">{errors.caja_id.message}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="activo"
            checked={activoValue ?? true}
            onCheckedChange={(v) => setValue("activo", v)}
          />
          <Label htmlFor="activo">Activo</Label>
        </div>
      </div>
    </FormModal>
  );
}
