"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, ShoppingCart, Check } from "lucide-react";
import { formatCurrency, formatDateOnly, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CarritoVenta } from "@/components/ventas/CarritoVenta";
import {
  getItemsVentasActivos,
  getMetodosPago,
  getSociosForAutocomplete,
  getPuntosVentaActivos,
  crearVenta,
} from "./actions";
import type { ItemVenta, CartItem } from "@/types/ventas";
import type { Deposito } from "@/types/stock";

type SocioOption = { id: string; nro_socio: number; apellido: string; nombre: string };
type MetodoPago = { id: string; nombre: string };

/** El cajero trabaja en un mismo sector todo el turno: se recuerda su elección */
const PDV_STORAGE_KEY = "atgq-erp-pdv";

export default function NuevaVentaPage() {
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [socioResults, setSocioResults] = useState<SocioOption[]>([]);
  const [puntosVenta, setPuntosVenta] = useState<Deposito[]>([]);
  const [puntoVentaId, setPuntoVentaId] = useState("");

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [cantidad, setCantidad] = useState(1);

  // Client selection
  const [tipoCliente, setTipoCliente] = useState<"socio" | "no_socio">("socio");
  const [socioSearch, setSocioSearch] = useState("");
  const [selectedSocioId, setSelectedSocioId] = useState("");
  const [metodoPagoId, setMetodoPagoId] = useState("");

  // No socio: comprador ocasional, se carga a mano en el mostrador
  const [noSocioNombre, setNoSocioNombre] = useState("");
  const [noSocioDni, setNoSocioDni] = useState("");
  const [noSocioVenc, setNoSocioVenc] = useState("");

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);

  useEffect(() => {
    Promise.all([
      getItemsVentasActivos(),
      getMetodosPago(),
      getPuntosVentaActivos(),
    ]).then(([itemsData, metodosData, puntosData]) => {
      setItems(itemsData);
      setMetodosPago(metodosData);
      setPuntosVenta(puntosData);

      if (metodosData.length > 0) {
        const efectivo = metodosData.find((m) => m.nombre === "Efectivo");
        if (efectivo) setMetodoPagoId(efectivo.id);
      }

      // Preseleccionar el último punto de venta usado, si sigue activo
      const guardado = window.localStorage.getItem(PDV_STORAGE_KEY);
      if (guardado && puntosData.some((p) => p.id === guardado)) {
        setPuntoVentaId(guardado);
      } else if (puntosData.length === 1) {
        setPuntoVentaId(puntosData[0].id);
      }
    });
  }, []);

  function handleSelectPuntoVenta(id: string) {
    setPuntoVentaId(id);
    window.localStorage.setItem(PDV_STORAGE_KEY, id);
  }

  const searchSocios = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSocioResults([]);
      return;
    }
    const results = await getSociosForAutocomplete(term);
    setSocioResults(results);
  }, []);

  useEffect(() => {
    // Con un socio ya elegido el input muestra "#1 - Apellido, Nombre": volver a
    // buscar con eso no sirve para nada y además rompía el filtro de PostgREST
    const timeout = setTimeout(() => {
      if (tipoCliente === "socio" && !selectedSocioId) searchSocios(socioSearch);
    }, 300);
    return () => clearTimeout(timeout);
  }, [socioSearch, tipoCliente, selectedSocioId, searchSocios]);

  function handleAddItem() {
    if (!selectedItemId) return;
    const item = items.find((i) => i.id === selectedItemId);
    if (!item) return;

    const existing = cart.findIndex((c) => c.item_id === item.id);
    if (existing >= 0) {
      const updated = [...cart];
      updated[existing].cantidad += cantidad;
      updated[existing].subtotal =
        updated[existing].cantidad * updated[existing].precio_unitario;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          item_id: item.id,
          nombre: item.nombre,
          precio_unitario: Number(item.precio),
          cantidad,
          subtotal: Number(item.precio) * cantidad,
          stock_item_id: item.stock_item_id,
        },
      ]);
    }
    setSelectedItemId("");
    setCantidad(1);
  }

  function handleRemoveItem(index: number) {
    setCart(cart.filter((_, i) => i !== index));
  }

  function handleSelectSocio(socio: SocioOption) {
    setSelectedSocioId(socio.id);
    setSocioSearch(`#${socio.nro_socio} - ${socio.apellido}, ${socio.nombre}`);
    setSocioResults([]);
  }

  const credencialVencida = !!noSocioVenc && noSocioVenc < todayISO();
  // Mismo criterio que el schema: los puntos no cuentan como dígitos
  const dniValido = /^\d{7,8}$/.test(noSocioDni.replace(/\./g, "").trim());
  const noSocioCompleto =
    noSocioNombre.trim() !== "" && dniValido && !!noSocioVenc;
  const compradorListo =
    tipoCliente === "socio"
      ? !!selectedSocioId
      : noSocioCompleto && !credencialVencida;

  async function handleConfirm() {
    if (cart.length === 0) {
      toast.error("Agregue al menos un ítem");
      return;
    }
    if (!puntoVentaId) {
      toast.error("Seleccione un punto de venta");
      return;
    }
    if (!metodoPagoId) {
      toast.error("Seleccione un método de pago");
      return;
    }
    if (tipoCliente === "socio" && !selectedSocioId) {
      toast.error("Seleccione un socio");
      return;
    }
    if (tipoCliente === "no_socio") {
      if (!noSocioCompleto) {
        toast.error(
          "Complete nombre, DNI y vencimiento de la credencial del no socio",
        );
        return;
      }
      if (credencialVencida) {
        toast.error(
          `La credencial de legítimo usuario está vencida (venció el ${formatDateOnly(
            noSocioVenc,
          )})`,
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const esNoSocio = tipoCliente === "no_socio";
      const result = await crearVenta({
        punto_venta_id: puntoVentaId,
        socio_id: esNoSocio ? null : selectedSocioId,
        cliente_id: null,
        no_socio_nombre: esNoSocio ? noSocioNombre.trim() : null,
        no_socio_dni: esNoSocio ? noSocioDni.trim() : null,
        no_socio_credencial_vencimiento: esNoSocio ? noSocioVenc : null,
        metodo_pago_id: metodoPagoId,
        items: cart.map((c) => ({
          item_id: c.item_id,
          cantidad: c.cantidad,
        })),
      });

      if (result.items_negativos.length > 0) {
        toast.warning(
          `Stock negativo en: ${result.items_negativos
            .map((i) => `${i.nombre} (${i.cantidad})`)
            .join(", ")}`,
        );
      }
      setSuccessDialog(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al crear la venta",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNewSale() {
    setCart([]);
    setSelectedSocioId("");
    setSocioSearch("");
    limpiarNoSocio();
    setSuccessDialog(false);
  }

  function limpiarNoSocio() {
    setNoSocioNombre("");
    setNoSocioDni("");
    setNoSocioVenc("");
  }

  const total = cart.reduce((sum, c) => sum + c.subtotal, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Nueva Venta" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Item picker + Cart */}
        <div className="space-y-4 lg:col-span-8">
          <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Ítem</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ítem..." />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nombre} — {formatCurrency(Number(item.precio))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-xs">Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <Button
              onClick={handleAddItem}
              disabled={!selectedItemId}
              size="sm"
            >
              <Plus className="mr-1 h-4 w-4" />
              Agregar
            </Button>
          </div>

          <CarritoVenta items={cart} onRemove={handleRemoveItem} />
        </div>

        {/* Right: Client + Payment */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-md border p-4 space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Punto de Venta</Label>
              <Select value={puntoVentaId} onValueChange={handleSelectPuntoVenta}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sector..." />
                </SelectTrigger>
                <SelectContent>
                  {puntosVenta.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {puntosVenta.length === 0 && (
                <p className="text-xs text-destructive">
                  No hay puntos de venta activos. Cree uno en Stock &rarr;
                  Puntos de Venta.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tipo de cliente</Label>
              <div className="flex gap-2">
                <Button
                  variant={tipoCliente === "socio" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTipoCliente("socio");
                    limpiarNoSocio();
                  }}
                >
                  Socio
                </Button>
                <Button
                  variant={tipoCliente === "no_socio" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTipoCliente("no_socio");
                    setSelectedSocioId("");
                    setSocioSearch("");
                    setSocioResults([]);
                  }}
                >
                  No Socio
                </Button>
              </div>
            </div>

            {tipoCliente === "socio" ? (
              <div className="space-y-1">
                <Label className="text-xs">Buscar socio (nombre o nro)</Label>
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
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => handleSelectSocio(s)}
                      >
                        #{s.nro_socio} — {s.apellido}, {s.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="no-socio-nombre">
                    Nombre y Apellido
                  </Label>
                  <Input
                    id="no-socio-nombre"
                    value={noSocioNombre}
                    onChange={(e) => setNoSocioNombre(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="no-socio-dni">
                    DNI
                  </Label>
                  <Input
                    id="no-socio-dni"
                    inputMode="numeric"
                    value={noSocioDni}
                    onChange={(e) => setNoSocioDni(e.target.value)}
                    placeholder="Ej: 30123456"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="no-socio-venc">
                    Venc. credencial legítimo usuario
                  </Label>
                  <Input
                    id="no-socio-venc"
                    type="date"
                    value={noSocioVenc}
                    onChange={(e) => setNoSocioVenc(e.target.value)}
                    className={cn(
                      credencialVencida &&
                        "border-destructive text-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {credencialVencida && (
                    <p className="text-xs text-destructive">
                      Credencial vencida: no se puede registrar la venta.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Método de Pago</Label>
              <Select value={metodoPagoId} onValueChange={setMetodoPagoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {metodosPago.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleConfirm}
                disabled={
                  isSubmitting ||
                  cart.length === 0 ||
                  !puntoVentaId ||
                  !compradorListo
                }
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                {isSubmitting ? "Procesando..." : "Confirmar Venta"}
              </Button>
              {cart.length > 0 && puntoVentaId && !compradorListo && (
                <p className="text-center text-xs text-muted-foreground">
                  {tipoCliente === "socio"
                    ? "Seleccione un socio para confirmar."
                    : credencialVencida
                      ? "La credencial vencida impide confirmar la venta."
                      : noSocioDni.trim() !== "" && !dniValido
                        ? "El DNI debe tener 7 u 8 dígitos."
                        : "Complete nombre, DNI y vencimiento de la credencial."}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cerrar con Escape también limpia: si no, el carrito queda cargado y
          un segundo clic registra la misma venta dos veces */}
      <AlertDialog
        open={successDialog}
        onOpenChange={(open) => {
          if (!open) handleNewSale();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-success" />
              Venta registrada exitosamente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Total: {formatCurrency(total)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleNewSale}>
              Nueva Venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
