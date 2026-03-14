"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clienteSchema, type ClienteSchemaType } from "@/lib/schemas/ventas";
import {
  createCliente,
  updateCliente,
} from "@/app/(dashboard)/ventas/clientes/actions";
import type { Cliente } from "@/types/ventas";

interface ClienteFormProps {
  open: boolean;
  onOpenChange: () => void;
  cliente: Cliente | null;
  onSaved: () => void;
}

export function ClienteForm({
  open,
  onOpenChange,
  cliente,
  onSaved,
}: ClienteFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!cliente;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClienteSchemaType>({
    resolver: zodResolver(clienteSchema),
  });

  useEffect(() => {
    if (open && cliente) {
      reset({
        apellido: cliente.apellido,
        nombre: cliente.nombre,
        dni: cliente.dni,
        email: cliente.email,
        telefono: cliente.telefono,
      });
    } else if (open) {
      reset({
        apellido: "",
        nombre: "",
        dni: null,
        email: null,
        telefono: null,
      });
    }
  }, [open, cliente, reset]);

  async function onSubmit(data: ClienteSchemaType) {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateCliente(cliente.id, {
          apellido: data.apellido,
          nombre: data.nombre,
          dni: data.dni || null,
          email: data.email || null,
          telefono: data.telefono || null,
        });
        toast.success("Cliente actualizado correctamente");
      } else {
        await createCliente({
          apellido: data.apellido,
          nombre: data.nombre,
          dni: data.dni || null,
          email: data.email || null,
          telefono: data.telefono || null,
        });
        toast.success("Cliente creado correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el cliente",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Cliente" : "Nuevo Cliente"}
      description={
        isEditing
          ? `Editando cliente "${cliente?.apellido}, ${cliente?.nombre}"`
          : "Complete los datos del nuevo cliente"
      }
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="apellido">Apellido</Label>
          <Input id="apellido" {...register("apellido")} />
          {errors.apellido && (
            <p className="text-xs text-red-500">{errors.apellido.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" {...register("nombre")} />
          {errors.nombre && (
            <p className="text-xs text-red-500">{errors.nombre.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="dni">DNI</Label>
          <Input id="dni" {...register("dni")} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" {...register("telefono")} />
        </div>
      </div>
    </FormModal>
  );
}
