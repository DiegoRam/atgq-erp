"use client";

import { useState, useEffect, useCallback } from "react";
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
import { turnoSchema, type TurnoSchemaType } from "@/lib/schemas/actividades";
import {
  createTurno,
  getSociosForAutocomplete,
} from "@/app/(dashboard)/turnos/actions";
import type { Instalacion } from "@/types/actividades";

type SocioOption = {
  id: string;
  nro_socio: number;
  apellido: string;
  nombre: string;
};

interface TurnoFormProps {
  open: boolean;
  onOpenChange: () => void;
  instalaciones: Instalacion[];
  onSaved: () => void;
}

export function TurnoForm({
  open,
  onOpenChange,
  instalaciones,
  onSaved,
}: TurnoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socioSearch, setSocioSearch] = useState("");
  const [socioResults, setSocioResults] = useState<SocioOption[]>([]);
  const [selectedSocioId, setSelectedSocioId] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TurnoSchemaType>({
    resolver: zodResolver(turnoSchema),
  });

  const instalacionIdValue = watch("instalacion_id");

  const searchSocios = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSocioResults([]);
      return;
    }
    const results = await getSociosForAutocomplete(term);
    setSocioResults(results);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchSocios(socioSearch);
    }, 300);
    return () => clearTimeout(timeout);
  }, [socioSearch, searchSocios]);

  useEffect(() => {
    if (open) {
      reset({
        socio_id: "",
        instalacion_id: "",
        fecha_turno: "",
        hora_inicio: "",
        hora_fin: "",
      });
      setSocioSearch("");
      setSelectedSocioId("");
      setSocioResults([]);
    }
  }, [open, reset]);

  function handleSelectSocio(socio: SocioOption) {
    setSelectedSocioId(socio.id);
    setValue("socio_id", socio.id);
    setSocioSearch(`#${socio.nro_socio} — ${socio.apellido}, ${socio.nombre}`);
    setSocioResults([]);
  }

  async function onSubmit(data: TurnoSchemaType) {
    setIsSubmitting(true);
    try {
      await createTurno(data);
      toast.success("Turno creado correctamente");
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al crear el turno",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo Turno"
      description="Complete los datos para reservar un turno"
      onSubmit={handleSubmit(onSubmit)}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Socio</Label>
          <Input
            value={socioSearch}
            onChange={(e) => {
              setSocioSearch(e.target.value);
              setSelectedSocioId("");
              setValue("socio_id", "");
            }}
            placeholder="Buscar por nombre o nro de socio..."
          />
          {socioResults.length > 0 && !selectedSocioId && (
            <div className="rounded-md border bg-background shadow-md max-h-40 overflow-y-auto">
              {socioResults.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => handleSelectSocio(s)}
                >
                  #{s.nro_socio} — {s.apellido}, {s.nombre}
                </button>
              ))}
            </div>
          )}
          {errors.socio_id && (
            <p className="text-xs text-red-500">{errors.socio_id.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label>Instalación</Label>
          <Select value={instalacionIdValue || undefined} onValueChange={(v) => setValue("instalacion_id", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar instalación..." />
            </SelectTrigger>
            <SelectContent>
              {instalaciones.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.instalacion_id && (
            <p className="text-xs text-red-500">{errors.instalacion_id.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="fecha_turno">Fecha</Label>
          <Input id="fecha_turno" type="date" {...register("fecha_turno")} />
          {errors.fecha_turno && (
            <p className="text-xs text-red-500">{errors.fecha_turno.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="hora_inicio">Hora Inicio</Label>
            <Input id="hora_inicio" type="time" {...register("hora_inicio")} />
            {errors.hora_inicio && (
              <p className="text-xs text-red-500">{errors.hora_inicio.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="hora_fin">Hora Fin</Label>
            <Input id="hora_fin" type="time" {...register("hora_fin")} />
            {errors.hora_fin && (
              <p className="text-xs text-red-500">{errors.hora_fin.message}</p>
            )}
          </div>
        </div>
      </div>
    </FormModal>
  );
}
