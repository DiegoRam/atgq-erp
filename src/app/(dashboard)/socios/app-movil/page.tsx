"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CodigoEmitidoDialog } from "@/components/socios/CodigoEmitidoDialog";
import { useTabsStore } from "@/store/tabsStore";
import { formatDate } from "@/lib/format";
import {
  desvincularCuenta,
  emitirCodigo,
  getEstadoAppMovil,
  revocarCodigo,
} from "./actions";
import {
  ESTADO_APP_MOVIL_LABEL,
  type CodigoEmitido,
  type EstadoAppMovil,
  type FilaAppMovil,
} from "@/types/app-movil";

const PAGE_SIZE = 50;

const VARIANTE_BADGE: Record<
  EstadoAppMovil,
  "default" | "secondary" | "destructive" | "outline"
> = {
  vinculado: "default",
  codigo_vigente: "secondary",
  codigo_vencido: "destructive",
  sin_codigo: "outline",
};

type Confirmacion = {
  titulo: string;
  descripcion: string;
  accion: () => Promise<void>;
};

export default function AppMovilPage() {
  const router = useRouter();
  const openTab = useTabsStore((s) => s.openTab);

  const [data, setData] = useState<FilaAppMovil[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("todos");
  const [isLoading, setIsLoading] = useState(true);
  const [emitido, setEmitido] = useState<CodigoEmitido | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [procesando, setProcesando] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getEstadoAppMovil({
        search,
        estado,
        page,
        pageSize: PAGE_SIZE,
      });
      setData(res.data);
      setTotal(res.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar el listado");
    } finally {
      setIsLoading(false);
    }
  }, [search, estado, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleEmitir(fila: FilaAppMovil) {
    setProcesando(true);
    try {
      const codigo = await emitirCodigo(fila.socio_id);
      setEmitido(codigo);
      await fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo emitir el código");
    } finally {
      setProcesando(false);
    }
  }

  function pedirReemitir(fila: FilaAppMovil) {
    setConfirmacion({
      titulo: "¿Reemitir el código?",
      descripcion: `${fila.apellido}, ${fila.nombre} ya tiene un código vigente. Emitir uno nuevo invalida el anterior: si ya se lo entregó, va a dejar de funcionar.`,
      accion: async () => {
        const codigo = await emitirCodigo(fila.socio_id);
        setEmitido(codigo);
      },
    });
  }

  function pedirRevocar(fila: FilaAppMovil) {
    setConfirmacion({
      titulo: "¿Revocar el código?",
      descripcion: `El código pendiente de ${fila.apellido}, ${fila.nombre} dejará de servir. Si ya se lo entregó, deberá emitir uno nuevo.`,
      accion: async () => {
        await revocarCodigo(fila.socio_id);
        toast.success("Código revocado");
      },
    });
  }

  function pedirDesvincular(fila: FilaAppMovil) {
    setConfirmacion({
      titulo: "¿Desvincular la cuenta?",
      descripcion: `${fila.apellido}, ${fila.nombre} perderá el acceso a la app y su cuenta quedará bloqueada. Para volver a darle acceso habrá que emitir un código nuevo.`,
      accion: async () => {
        await desvincularCuenta(fila.socio_id);
        toast.success("Cuenta desvinculada");
      },
    });
  }

  async function confirmar() {
    if (!confirmacion) return;
    setProcesando(true);
    try {
      await confirmacion.accion();
      setConfirmacion(null);
      await fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la operación");
    } finally {
      setProcesando(false);
    }
  }

  const columns: ColumnDef<FilaAppMovil>[] = [
    { accessorKey: "nro_socio", header: "Nro" },
    {
      id: "socio",
      header: "Socio",
      cell: ({ row }) => `${row.original.apellido}, ${row.original.nombre}`,
    },
    { accessorKey: "dni", header: "DNI" },
    {
      accessorKey: "estado",
      header: "Estado app",
      cell: ({ row }) => {
        const e = row.original.estado;
        return (
          <Badge variant={VARIANTE_BADGE[e]}>{ESTADO_APP_MOVIL_LABEL[e]}</Badge>
        );
      },
    },
    {
      id: "detalle",
      header: "Detalle",
      cell: ({ row }) => {
        const f = row.original;
        if (f.estado === "vinculado") {
          return (
            <span className="text-sm text-muted-foreground">
              {f.email ?? "—"}
            </span>
          );
        }
        if (f.codigo_prefijo) {
          return (
            <span className="font-mono text-sm text-muted-foreground">
              {f.codigo_prefijo}…{" "}
              {f.expira_at ? `· vence ${formatDate(f.expira_at)}` : ""}
            </span>
          );
        }
        return <span className="text-sm text-muted-foreground">—</span>;
      },
    },
    {
      id: "ultimo_acceso",
      header: "Último acceso",
      cell: ({ row }) =>
        row.original.ultimo_acceso ? formatDate(row.original.ultimo_acceso) : "—",
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => {
        const f = row.original;
        return (
          <div className="flex justify-end gap-2">
            {f.estado === "vinculado" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => pedirDesvincular(f)}
              >
                Desvincular
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={procesando}
                  onClick={() => {
                    // Reemitir revoca el código anterior. Si está vigente, el
                    // socio puede tenerlo en la mano y dejaría de funcionar sin
                    // que nadie se entere hasta que lo intente usar.
                    if (f.estado === "codigo_vigente") {
                      pedirReemitir(f);
                    } else {
                      handleEmitir(f);
                    }
                  }}
                >
                  {f.estado === "sin_codigo" ? "Emitir" : "Reemitir"}
                </Button>
                {f.estado !== "sin_codigo" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => pedirRevocar(f)}
                  >
                    Revocar
                  </Button>
                ) : null}
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="App Móvil — Códigos de activación"
        description="Emita y administre los códigos de un solo uso con los que los socios activan su cuenta en la app."
        actions={
          <Button
            onClick={() => {
              openTab("/socios/app-movil/emision-masiva", "Emisión masiva");
              router.push("/socios/app-movil/emision-masiva");
            }}
          >
            Emisión masiva
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Select
          value={estado}
          onValueChange={(v) => {
            setEstado(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {/* "todos" y no "" como value: un SelectItem con value vacío rompe
                el Select de Radix (bug conocido del repo con el filtro "Todos"). */}
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="sin_codigo">Sin código</SelectItem>
            <SelectItem value="codigo_vigente">Código vigente</SelectItem>
            <SelectItem value="codigo_vencido">Código vencido</SelectItem>
            <SelectItem value="vinculado">Vinculado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data}
        totalCount={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        searchPlaceholder="Buscar por nro, apellido, nombre o DNI..."
        isLoading={isLoading}
      />

      <CodigoEmitidoDialog codigo={emitido} onClose={() => setEmitido(null)} />

      <AlertDialog
        open={!!confirmacion}
        onOpenChange={(abierto) => {
          if (!abierto) setConfirmacion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmacion?.titulo}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacion?.descripcion}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={procesando}
              onClick={(e) => {
                e.preventDefault();
                confirmar();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
