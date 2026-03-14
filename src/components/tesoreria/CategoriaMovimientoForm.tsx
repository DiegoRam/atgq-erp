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
import {
  categoriaMovimientoSchema,
  type CategoriaMovimientoSchemaType,
} from "@/lib/schemas/tesoreria";
import {
  createCategoria,
  updateCategoria,
} from "@/app/(dashboard)/tesoreria/config/categorias/actions";
import type { CategoriaMovimiento } from "@/types/tesoreria";

interface CategoriaMovimientoFormProps {
  open: boolean;
  onOpenChange: () => void;
  categoria: CategoriaMovimiento | null;
  onSaved: () => void;
}

export function CategoriaMovimientoForm({
  open,
  onOpenChange,
  categoria,
  onSaved,
}: CategoriaMovimientoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!categoria;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CategoriaMovimientoSchemaType>({
    resolver: zodResolver(categoriaMovimientoSchema),
  });

  useEffect(() => {
    if (open && categoria) {
      reset({
        nombre: categoria.nombre,
        tipo: categoria.tipo,
        activa: categoria.activa,
      });
    } else if (open) {
      reset({
        nombre: "",
        tipo: "ingreso",
        activa: true,
      });
    }
  }, [open, categoria, reset]);

  async function onSubmit(data: CategoriaMovimientoSchemaType) {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateCategoria(categoria.id, data);
        toast.success("Categoría actualizada correctamente");
      } else {
        await createCategoria(data);
        toast.success("Categoría creada correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar la categoría",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const tipoValue = watch("tipo");
  const activaValue = watch("activa");

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Categoría" : "Nueva Categoría"}
      description={
        isEditing
          ? `Editando categoría "${categoria?.nombre}"`
          : "Complete los datos de la nueva categoría"
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
          <Label>Tipo</Label>
          <Select
            value={tipoValue || "ingreso"}
            onValueChange={(v) =>
              setValue("tipo", v as "ingreso" | "egreso")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ingreso">Ingreso</SelectItem>
              <SelectItem value="egreso">Egreso</SelectItem>
            </SelectContent>
          </Select>
          {errors.tipo && (
            <p className="text-xs text-red-500">{errors.tipo.message}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="activa"
            checked={activaValue ?? true}
            onCheckedChange={(v) => setValue("activa", v)}
          />
          <Label htmlFor="activa">Activa</Label>
        </div>
      </div>
    </FormModal>
  );
}
