"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { MovimientoFormData, Caja, CategoriaMovimiento } from "@/types/tesoreria";

export async function getCajasActivas(): Promise<Caja[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cajas")
    .select("*")
    .eq("activa", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as Caja[];
}

export async function getCategoriasActivas(): Promise<CategoriaMovimiento[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categorias_movimientos")
    .select("*")
    .eq("activa", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoriaMovimiento[];
}

export async function ingresarMovimiento(formData: MovimientoFormData) {
  const supabase = createClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("movimientos_fondos").insert({
    caja_id: formData.caja_id,
    categoria_id: formData.categoria_id,
    tipo: formData.tipo,
    monto: formData.monto,
    descripcion: formData.descripcion || null,
    fecha: formData.fecha,
    usuario_id: user.id,
  });

  if (error) throw new Error(error.message);

  // Calculate new balance for the affected caja
  const { data: caja } = await supabase
    .from("cajas")
    .select("saldo_inicial")
    .eq("id", formData.caja_id)
    .single();

  const { data: movimientos } = await supabase
    .from("movimientos_fondos")
    .select("tipo, monto")
    .eq("caja_id", formData.caja_id);

  let saldo = Number(caja?.saldo_inicial ?? 0);
  if (movimientos) {
    for (const m of movimientos) {
      if (m.tipo === "ingreso" || m.tipo === "transferencia") {
        saldo += Number(m.monto);
      } else {
        saldo -= Number(m.monto);
      }
    }
  }

  revalidatePath("/tesoreria/movimientos");
  revalidatePath("/tesoreria/cajas");

  return { success: true, nuevoSaldo: saldo };
}
