"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { socioSchema, type SocioSchemaType } from "@/lib/schemas/socio";
import {
  getCategorias,
  getMetodosCobranza,
  getNextNroSocio,
  checkDniUnique,
  createSocio,
  updateSocio,
} from "@/app/(dashboard)/socios/actions";
import type { Socio, CategoriaSocial, MetodoCobranza } from "@/types/socios";
import { format } from "date-fns";

interface SocioFormProps {
  open: boolean;
  onOpenChange: () => void;
  socio: Socio | null;
  onSaved: () => void;
}

export function SocioForm({ open, onOpenChange, socio, onSaved }: SocioFormProps) {
  const [categorias, setCategorias] = useState<CategoriaSocial[]>([]);
  const [metodos, setMetodos] = useState<MetodoCobranza[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!socio;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SocioSchemaType>({
    resolver: zodResolver(socioSchema),
  });

  useEffect(() => {
    if (open) {
      Promise.all([getCategorias(), getMetodosCobranza()]).then(
        ([cats, mets]) => {
          setCategorias(cats);
          setMetodos(mets);
        },
      );
    }
  }, [open]);

  useEffect(() => {
    if (open && socio) {
      reset({
        nro_socio: socio.nro_socio,
        apellido: socio.apellido,
        nombre: socio.nombre,
        dni: socio.dni,
        categoria_id: socio.categoria_id,
        fecha_alta: socio.fecha_alta,
        fecha_baja: socio.fecha_baja,
        metodo_cobranza_id: socio.metodo_cobranza_id,
        localidad: socio.localidad,
        fecha_nacimiento: socio.fecha_nacimiento,
      });
    } else if (open) {
      getNextNroSocio().then((nro) => {
        reset({
          nro_socio: nro,
          apellido: "",
          nombre: "",
          dni: "",
          categoria_id: "",
          fecha_alta: format(new Date(), "yyyy-MM-dd"),
          fecha_baja: null,
          metodo_cobranza_id: null,
          localidad: null,
          fecha_nacimiento: null,
        });
      });
    }
  }, [open, socio, reset]);

  async function onSubmit(data: SocioSchemaType) {
    setIsSubmitting(true);
    try {
      // Check DNI uniqueness
      const dniUnique = await checkDniUnique(data.dni, socio?.id);
      if (!dniUnique) {
        toast.error("El DNI ya está registrado para otro socio");
        setIsSubmitting(false);
        return;
      }

      if (isEditing) {
        await updateSocio(socio.id, data);
        toast.success("Socio actualizado correctamente");
      } else {
        await createSocio(data);
        toast.success("Socio creado correctamente");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el socio",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const categoriaId = watch("categoria_id");
  const metodoId = watch("metodo_cobranza_id");

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar Socio" : "Nuevo Socio"}
      description={
        isEditing
          ? `Editando socio #${socio?.nro_socio}`
          : "Complete los datos del nuevo socio"
      }
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
      size="lg"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="nro_socio">Nro Socio</Label>
          <Input
            id="nro_socio"
            type="number"
            {...register("nro_socio", { valueAsNumber: true })}
          />
          {errors.nro_socio && (
            <p className="text-xs text-red-500">{errors.nro_socio.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="dni">DNI</Label>
          <Input id="dni" {...register("dni")} />
          {errors.dni && (
            <p className="text-xs text-red-500">{errors.dni.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="apellido">Apellido</Label>
          <Input
            id="apellido"
            {...register("apellido")}
            onChange={(e) => {
              setValue("apellido", e.target.value.toUpperCase());
            }}
          />
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
          <Label>Categoría</Label>
          <Select
            value={categoriaId || ""}
            onValueChange={(v) => setValue("categoria_id", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.categoria_id && (
            <p className="text-xs text-red-500">
              {errors.categoria_id.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label>Método Cobranza</Label>
          <Select
            value={metodoId || ""}
            onValueChange={(v) =>
              setValue("metodo_cobranza_id", v || null)
            }
          >
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

        <div className="space-y-1">
          <Label htmlFor="fecha_alta">Fecha Alta</Label>
          <Input id="fecha_alta" type="date" {...register("fecha_alta")} />
          {errors.fecha_alta && (
            <p className="text-xs text-red-500">{errors.fecha_alta.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="fecha_baja">Fecha Baja</Label>
          <Input id="fecha_baja" type="date" {...register("fecha_baja")} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="localidad">Localidad</Label>
          <Input id="localidad" {...register("localidad")} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="fecha_nacimiento">Fecha Nacimiento</Label>
          <Input
            id="fecha_nacimiento"
            type="date"
            {...register("fecha_nacimiento")}
          />
        </div>
      </div>
    </FormModal>
  );
}
