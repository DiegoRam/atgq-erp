"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TransferenciaFormData, Caja, MovimientoFondo } from "@/types/tesoreria";

export async function getCajasConSaldo(): Promise<Caja[]> {
  const supabase = createClient();

  const { data: cajas, error } = await supabase
    .from("cajas")
    .select("*")
    .eq("activa", true)
    .order("nombre");

  if (error) throw new Error(error.message);
  if (!cajas || cajas.length === 0) return [];

  const cajaIds = cajas.map((c) => c.id);
  const { data: movimientos } = await supabase
    .from("movimientos_fondos")
    .select("caja_id, tipo, monto")
    .in("caja_id", cajaIds);

  const saldos: Record<string, number> = {};
  if (movimientos) {
    for (const mov of movimientos) {
      if (!saldos[mov.caja_id]) saldos[mov.caja_id] = 0;
      if (mov.tipo === "ingreso" || mov.tipo === "transferencia") {
        saldos[mov.caja_id] += Number(mov.monto);
      } else {
        saldos[mov.caja_id] -= Number(mov.monto);
      }
    }
  }

  return cajas.map((c) => ({
    ...c,
    saldo_actual: Number(c.saldo_inicial) + (saldos[c.id] ?? 0),
  })) as Caja[];
}

export async function realizarTransferencia(formData: TransferenciaFormData) {
  const supabase = createClient();

  if (formData.caja_origen_id === formData.caja_destino_id) {
    throw new Error("La caja origen y destino deben ser diferentes");
  }

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Get transfer categories
  const { data: catEgreso } = await supabase
    .from("categorias_movimientos")
    .select("id")
    .eq("nombre", "Transferencia")
    .eq("tipo", "egreso")
    .single();

  const { data: catIngreso } = await supabase
    .from("categorias_movimientos")
    .select("id")
    .eq("nombre", "Transferencia")
    .eq("tipo", "ingreso")
    .single();

  if (!catEgreso || !catIngreso) {
    throw new Error("Faltan categorías de transferencia. Ejecute el seed de categorías.");
  }

  // 1. INSERT egreso in origin caja
  const { data: egresoData, error: egresoErr } = await supabase
    .from("movimientos_fondos")
    .insert({
      caja_id: formData.caja_origen_id,
      categoria_id: catEgreso.id,
      tipo: "egreso",
      monto: formData.monto,
      descripcion: formData.descripcion || "Transferencia entre cajas",
      fecha: formData.fecha,
      caja_destino_id: formData.caja_destino_id,
      usuario_id: user.id,
    })
    .select("id")
    .single();

  if (egresoErr) throw new Error(egresoErr.message);

  // 2. INSERT ingreso in destination caja
  const { data: ingresoData, error: ingresoErr } = await supabase
    .from("movimientos_fondos")
    .insert({
      caja_id: formData.caja_destino_id,
      categoria_id: catIngreso.id,
      tipo: "transferencia",
      monto: formData.monto,
      descripcion: formData.descripcion || "Transferencia entre cajas",
      fecha: formData.fecha,
      referencia_id: egresoData.id,
      usuario_id: user.id,
    })
    .select("id")
    .single();

  if (ingresoErr) throw new Error(ingresoErr.message);

  // 3. Update egreso with cross-reference
  await supabase
    .from("movimientos_fondos")
    .update({ referencia_id: ingresoData.id })
    .eq("id", egresoData.id);

  revalidatePath("/tesoreria/cajas");
  revalidatePath("/tesoreria/movimientos");
  revalidatePath("/tesoreria/transferencias");

  return { success: true };
}

export async function getUltimasTransferencias(): Promise<MovimientoFondo[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("movimientos_fondos")
    .select(
      "*, caja:cajas!caja_id(id,nombre), categoria:categorias_movimientos(id,nombre), caja_destino:cajas!caja_destino_id(id,nombre)",
    )
    .eq("tipo", "egreso")
    .not("caja_destino_id", "is", null)
    .order("fecha", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return (data ?? []) as MovimientoFondo[];
}
