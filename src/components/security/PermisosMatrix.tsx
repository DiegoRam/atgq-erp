"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MODULOS, MODULO_LABELS, type Modulo } from "@/types/security";
import type { PermisoModulo } from "@/types/security";
import { updateRolePermisos } from "@/app/(dashboard)/security/roles/actions";

interface PermisosMatrixProps {
  rolId: string;
  initialPermisos: PermisoModulo[];
}

type PermisoState = {
  modulo: string;
  puede_leer: boolean;
  puede_escribir: boolean;
  puede_eliminar: boolean;
};

export function PermisosMatrix({ rolId, initialPermisos }: PermisosMatrixProps) {
  const [permisos, setPermisos] = useState<PermisoState[]>(() =>
    MODULOS.map((m) => {
      const existing = initialPermisos.find((p) => p.modulo === m);
      return {
        modulo: m,
        puede_leer: existing?.puede_leer ?? false,
        puede_escribir: existing?.puede_escribir ?? false,
        puede_eliminar: existing?.puede_eliminar ?? false,
      };
    }),
  );
  const [isSaving, setIsSaving] = useState(false);

  function handleChange(
    modulo: string,
    field: "puede_leer" | "puede_escribir" | "puede_eliminar",
    checked: boolean,
  ) {
    setPermisos((prev) =>
      prev.map((p) => {
        if (p.modulo !== modulo) return p;
        const updated = { ...p, [field]: checked };

        // Cascade: eliminar → auto-check escribir + leer
        if (field === "puede_eliminar" && checked) {
          updated.puede_escribir = true;
          updated.puede_leer = true;
        }
        // Cascade: escribir → auto-check leer
        if (field === "puede_escribir" && checked) {
          updated.puede_leer = true;
        }
        // Cascade down: uncheck leer → uncheck escribir + eliminar
        if (field === "puede_leer" && !checked) {
          updated.puede_escribir = false;
          updated.puede_eliminar = false;
        }
        // Cascade down: uncheck escribir → uncheck eliminar
        if (field === "puede_escribir" && !checked) {
          updated.puede_eliminar = false;
        }

        return updated;
      }),
    );
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateRolePermisos(rolId, permisos);
      toast.success("Permisos guardados correctamente");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar permisos",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Módulo</th>
              <th className="px-4 py-3 text-center font-medium">Leer</th>
              <th className="px-4 py-3 text-center font-medium">Escribir</th>
              <th className="px-4 py-3 text-center font-medium">Eliminar</th>
            </tr>
          </thead>
          <tbody>
            {permisos.map((p) => (
              <tr key={p.modulo} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">
                  {MODULO_LABELS[p.modulo as Modulo] ?? p.modulo}
                </td>
                <td className="px-4 py-3 text-center">
                  <Checkbox
                    checked={p.puede_leer}
                    onCheckedChange={(checked) =>
                      handleChange(p.modulo, "puede_leer", !!checked)
                    }
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <Checkbox
                    checked={p.puede_escribir}
                    onCheckedChange={(checked) =>
                      handleChange(p.modulo, "puede_escribir", !!checked)
                    }
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <Checkbox
                    checked={p.puede_eliminar}
                    onCheckedChange={(checked) =>
                      handleChange(p.modulo, "puede_eliminar", !!checked)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Guardar Permisos
        </Button>
      </div>
    </div>
  );
}
