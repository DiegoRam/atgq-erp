"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Trash2, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGruposFamiliares,
  removeMiembroFromGrupo,
} from "./actions";
import { GrupoFamiliarFormModal } from "@/components/socios/GrupoFamiliarForm";
import type { GrupoFamiliar } from "@/types/socios";

export default function GruposFamiliaresPage() {
  const [grupos, setGrupos] = useState<GrupoFamiliar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getGruposFamiliares();
      setGrupos(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleRemoveMiembro(socioId: string) {
    try {
      await removeMiembroFromGrupo(socioId);
      toast.success("Miembro removido del grupo");
      fetchData();
    } catch {
      toast.error("Error al remover miembro");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Grupos Familiares"
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Nuevo Grupo
          </Button>
        }
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Nro Grupo</TableHead>
              <TableHead>Titular</TableHead>
              <TableHead>Cantidad Miembros</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : grupos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No hay grupos familiares registrados.
                </TableCell>
              </TableRow>
            ) : (
              grupos.map((g, idx) => {
                const isExpanded = expandedIds.has(g.id);
                return (
                  <>
                    <TableRow
                      key={g.id}
                      className="cursor-pointer"
                      onClick={() => toggleExpand(g.id)}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell>
                        {g.titular
                          ? `${g.titular.apellido}, ${g.titular.nombre} (#${g.titular.nro_socio})`
                          : "Sin titular"}
                      </TableCell>
                      <TableCell>{g.miembros?.length ?? 0}</TableCell>
                    </TableRow>
                    {isExpanded && g.miembros && g.miembros.length > 0 && (
                      <TableRow key={`${g.id}-members`}>
                        <TableCell />
                        <TableCell colSpan={3}>
                          <div className="space-y-1 py-2">
                            {g.miembros.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center justify-between rounded bg-muted/50 px-3 py-1.5 text-sm"
                              >
                                <span>
                                  #{m.nro_socio} — {m.apellido}, {m.nombre}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveMiembro(m.id);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <GrupoFamiliarFormModal
        open={modalOpen}
        onOpenChange={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          fetchData();
        }}
      />
    </div>
  );
}
