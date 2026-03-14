"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Cliente, ClienteFormData } from "@/types/ventas";

export async function getClientes(search?: string): Promise<Cliente[]> {
  const supabase = createClient();

  let query = supabase
    .from("clientes")
    .select("*")
    .order("apellido")
    .order("nombre");

  if (search) {
    query = query.or(
      `apellido.ilike.%${search}%,nombre.ilike.%${search}%,dni.ilike.%${search}%`,
    );
  }

  const { data: clientes, error } = await query;
  if (error) throw new Error(error.message);
  if (!clientes || clientes.length === 0) return [];

  // Get purchase counts and totals
  const clienteIds = clientes.map((c) => c.id);
  const { data: ventasData } = await supabase
    .from("ventas")
    .select("cliente_id, total")
    .in("cliente_id", clienteIds)
    .eq("anulada", false);

  const stats: Record<string, { count: number; total: number }> = {};
  if (ventasData) {
    for (const v of ventasData) {
      if (!v.cliente_id) continue;
      if (!stats[v.cliente_id]) stats[v.cliente_id] = { count: 0, total: 0 };
      stats[v.cliente_id].count++;
      stats[v.cliente_id].total += Number(v.total);
    }
  }

  return clientes.map((c) => ({
    ...c,
    cant_compras: stats[c.id]?.count ?? 0,
    total_comprado: stats[c.id]?.total ?? 0,
  })) as Cliente[];
}

export async function createCliente(formData: ClienteFormData) {
  const supabase = createClient();
  const { error } = await supabase.from("clientes").insert({
    apellido: formData.apellido,
    nombre: formData.nombre,
    dni: formData.dni || null,
    email: formData.email || null,
    telefono: formData.telefono || null,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un cliente con esos datos");
    }
    throw new Error(error.message);
  }
  revalidatePath("/ventas/clientes");
}

export async function updateCliente(id: string, formData: ClienteFormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("clientes")
    .update({
      apellido: formData.apellido,
      nombre: formData.nombre,
      dni: formData.dni || null,
      email: formData.email || null,
      telefono: formData.telefono || null,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un cliente con esos datos");
    }
    throw new Error(error.message);
  }
  revalidatePath("/ventas/clientes");
}
