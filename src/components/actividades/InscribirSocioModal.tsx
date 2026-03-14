"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inscribirSocio,
  getSociosForAutocomplete,
} from "@/app/(dashboard)/actividades/[id]/actions";

type SocioOption = {
  id: string;
  nro_socio: number;
  apellido: string;
  nombre: string;
};

interface InscribirSocioModalProps {
  open: boolean;
  onOpenChange: () => void;
  actividadId: string;
  onSaved: () => void;
}

export function InscribirSocioModal({
  open,
  onOpenChange,
  actividadId,
  onSaved,
}: InscribirSocioModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socioSearch, setSocioSearch] = useState("");
  const [socioResults, setSocioResults] = useState<SocioOption[]>([]);
  const [selectedSocioId, setSelectedSocioId] = useState("");

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
      setSocioSearch("");
      setSelectedSocioId("");
      setSocioResults([]);
    }
  }, [open]);

  function handleSelectSocio(socio: SocioOption) {
    setSelectedSocioId(socio.id);
    setSocioSearch(`#${socio.nro_socio} — ${socio.apellido}, ${socio.nombre}`);
    setSocioResults([]);
  }

  async function handleSubmit() {
    if (!selectedSocioId) {
      toast.error("Seleccione un socio");
      return;
    }
    setIsSubmitting(true);
    try {
      await inscribirSocio(actividadId, selectedSocioId);
      toast.success("Socio inscripto correctamente");
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al inscribir socio",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Inscribir Socio"
      description="Busque un socio por nombre o número para inscribirlo en la actividad"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Buscar socio (nombre o nro)</Label>
          <Input
            value={socioSearch}
            onChange={(e) => {
              setSocioSearch(e.target.value);
              setSelectedSocioId("");
            }}
            placeholder="Ej: 1001 o García"
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
        </div>
      </div>
    </FormModal>
  );
}
