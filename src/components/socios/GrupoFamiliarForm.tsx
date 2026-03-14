"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormModal } from "@/components/shared/FormModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  searchSocios,
  createGrupoFamiliar,
} from "@/app/(dashboard)/socios/grupos-familiares/actions";

interface SocioResult {
  id: string;
  nro_socio: number;
  apellido: string;
  nombre: string;
}

interface GrupoFamiliarFormModalProps {
  open: boolean;
  onOpenChange: () => void;
  onSaved: () => void;
}

export function GrupoFamiliarFormModal({
  open,
  onOpenChange,
  onSaved,
}: GrupoFamiliarFormModalProps) {
  const [titular, setTitular] = useState<SocioResult | null>(null);
  const [miembros, setMiembros] = useState<SocioResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SocioResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchMode, setSearchMode] = useState<"titular" | "miembro">("titular");

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const results = await searchSocios(query);
    setSearchResults(results);
  }

  function selectSocio(socio: SocioResult) {
    if (searchMode === "titular") {
      setTitular(socio);
    } else {
      if (!miembros.find((m) => m.id === socio.id) && socio.id !== titular?.id) {
        setMiembros([...miembros, socio]);
      }
    }
    setSearchQuery("");
    setSearchResults([]);
  }

  async function handleSubmit() {
    if (!titular) {
      toast.error("Debe seleccionar un titular");
      return;
    }
    setIsSubmitting(true);
    try {
      await createGrupoFamiliar(
        titular.id,
        miembros.map((m) => m.id),
      );
      toast.success("Grupo familiar creado");
      setTitular(null);
      setMiembros([]);
      onSaved();
    } catch {
      toast.error("Error al crear el grupo familiar");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo Grupo Familiar"
      description="Seleccione el titular y los miembros del grupo"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      size="lg"
    >
      <div className="space-y-4">
        {/* Titular */}
        <div className="space-y-1">
          <Label>Titular</Label>
          {titular ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                #{titular.nro_socio} — {titular.apellido}, {titular.nombre}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => setTitular(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Buscar titular por apellido o nombre..."
                value={searchMode === "titular" ? searchQuery : ""}
                onFocus={() => setSearchMode("titular")}
                onChange={(e) => {
                  setSearchMode("titular");
                  handleSearch(e.target.value);
                }}
              />
              {searchMode === "titular" && searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                  {searchResults.map((s) => (
                    <button
                      key={s.id}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => selectSocio(s)}
                    >
                      #{s.nro_socio} — {s.apellido}, {s.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Miembros */}
        <div className="space-y-1">
          <Label>Miembros</Label>
          <div className="relative">
            <Input
              placeholder="Buscar miembro por apellido o nombre..."
              value={searchMode === "miembro" ? searchQuery : ""}
              onFocus={() => setSearchMode("miembro")}
              onChange={(e) => {
                setSearchMode("miembro");
                handleSearch(e.target.value);
              }}
            />
            {searchMode === "miembro" && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                {searchResults.map((s) => (
                  <button
                    key={s.id}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => selectSocio(s)}
                  >
                    #{s.nro_socio} — {s.apellido}, {s.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
          {miembros.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {miembros.map((m) => (
                <Badge
                  key={m.id}
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  #{m.nro_socio} — {m.apellido}
                  <button
                    onClick={() =>
                      setMiembros(miembros.filter((x) => x.id !== m.id))
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </FormModal>
  );
}
