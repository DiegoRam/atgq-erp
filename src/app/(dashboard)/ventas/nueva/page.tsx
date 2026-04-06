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
import { formatCurrency } from "@/lib/format";
import { CarritoVenta } from "@/components/ventas/CarritoVenta";
import {
  getItemsVentasActivos,
  getClientesForSelect,
  getMetodosPago,
  getSociosForAutocomplete,
  crearVenta,
} from "./actions";
import type { ItemVenta, CartItem } from "@/types/ventas";

type ClienteOption = { id: string; apellido: string; nombre: string };
type SocioOption = { id: string; nro_socio: number; apellido: string; nombre: string };
type MetodoPago = { id: string; nombre: string };

export default function NuevaVentaPage() {
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [socioResults, setSocioResults] = useState<SocioOption[]>([]);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [cantidad, setCantidad] = useState(1);

  // Client selection
  const [tipoCliente, setTipoCliente] = useState<"socio" | "cliente">("socio");
  const [socioSearch, setSocioSearch] = useState("");
  const [selectedSocioId, setSelectedSocioId] = useState("");
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [metodoPagoId, setMetodoPagoId] = useState("");

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);

  useEffect(() => {
    Promise.all([
      getItemsVentasActivos(),
      getClientesForSelect(),
      getMetodosPago(),
    ]).then(([itemsData, clientesData, metodosData]) => {
      setItems(itemsData);
      setClientes(clientesData);
      setMetodosPago(metodosData);
      if (metodosData.length > 0) {
        const efectivo = metodosData.find((m) => m.nombre === "Efectivo");
        if (efectivo) setMetodoPagoId(efectivo.id);
      }
    });
  }, []);

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
      if (tipoCliente === "socio") searchSocios(socioSearch);
    }, 300);
    return () => clearTimeout(timeout);
  }, [socioSearch, tipoCliente, searchSocios]);

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

  async function handleConfirm() {
    if (cart.length === 0) {
      toast.error("Agregue al menos un ítem");
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
    if (tipoCliente === "cliente" && !selectedClienteId) {
      toast.error("Seleccione un cliente");
      return;
    }

    setIsSubmitting(true);
    try {
      await crearVenta({
        socio_id: tipoCliente === "socio" ? selectedSocioId : null,
        cliente_id: tipoCliente === "cliente" ? selectedClienteId : null,
        metodo_pago_id: metodoPagoId,
        items: cart.map((c) => ({
          item_id: c.item_id,
          cantidad: c.cantidad,
          precio_unitario: c.precio_unitario,
        })),
      });
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
    setSelectedClienteId("");
    setSocioSearch("");
    setSuccessDialog(false);
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
              <Label className="text-xs font-semibold">Tipo de cliente</Label>
              <div className="flex gap-2">
                <Button
                  variant={tipoCliente === "socio" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTipoCliente("socio");
                    setSelectedClienteId("");
                  }}
                >
                  Socio
                </Button>
                <Button
                  variant={tipoCliente === "cliente" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTipoCliente("cliente");
                    setSelectedSocioId("");
                    setSocioSearch("");
                  }}
                >
                  Cliente
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
              <div className="space-y-1">
                <Label className="text-xs">Cliente</Label>
                <Select
                  value={selectedClienteId}
                  onValueChange={setSelectedClienteId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.apellido}, {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                disabled={isSubmitting || cart.length === 0}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                {isSubmitting ? "Procesando..." : "Confirmar Venta"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={successDialog} onOpenChange={setSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
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
