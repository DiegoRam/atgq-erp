"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { revalidatePath } from "next/cache";
import type { ItemVenta, ItemVentaFormData } from "@/types/ventas";
import type { StockItem } from "@/types/stock";

export async function getItemsVentas(): Promise<ItemVenta[]> {
  const supabase = await createClient();
  return fetchAllRows<ItemVenta>((from, to) =>
    supabase
      .from("items_ventas")
      .select("*, stock_item:stock_items(id, nombre)")
      .order("nombre")
      .order("id")
      .range(from, to),
  );
}

export async function getStockItemsForSelect(): Promise<StockItem[]> {
  const supabase = await createClient();
  return fetchAllRows<StockItem>((from, to) =>
    supabase
      .from("stock_items")
      .select("*")
      .eq("activo", true)
      .order("nombre")
      .order("id")
      .range(from, to),
  );
}

export async function createItemVenta(formData: ItemVentaFormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("items_ventas").insert({
    nombre: formData.nombre,
    descripcion: formData.descripcion || null,
    precio: formData.precio,
    activo: formData.activo,
    stock_item_id: formData.stock_item_id || null,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un ítem de venta con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/ventas/items");
}

export async function updateItemVenta(id: string, formData: ItemVentaFormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("items_ventas")
    .update({
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      precio: formData.precio,
      activo: formData.activo,
      stock_item_id: formData.stock_item_id || null,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un ítem de venta con ese nombre");
    }
    throw new Error(error.message);
  }
  revalidatePath("/ventas/items");
}

/**
 * El error se **devuelve**, no se tira: en un build de producción Next redacta
 * el mensaje de cualquier Error que escape de un server action y el cliente
 * recibe "An error occurred in the Server Components render...". Devolverlo es
 * lo único que hace llegar el motivo real al usuario, y es la convención que ya
 * usa `src/app/login/actions.ts`.
 */
export async function deleteItemVenta(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // `ventas_items.item_id` es NO ACTION: el borrado con historial fallaría con
  // 23503, así que se chequea antes para dar un mensaje entendible. Se falla
  // cerrado ante un `count` nulo; el 23503 de más abajo es la red final.
  const { count, error: countError } = await supabase
    .from("ventas_items")
    .select("*", { count: "exact", head: true })
    .eq("item_id", id);
  if (countError) {
    console.error("deleteItemVenta/count", countError);
    return { error: countError.message };
  }
  if (count === null || count > 0) {
    return {
      error:
        "No se puede eliminar el ítem: figura en ventas registradas. Desactívelo en su lugar.",
    };
  }

  const { data, error } = await supabase
    .from("items_ventas")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("deleteItemVenta/delete", error);
    if (error.code === "23503") {
      return {
        error:
          "No se puede eliminar el ítem: tiene registros asociados. Desactívelo en su lugar.",
      };
    }
    return { error: error.message };
  }

  // RLS que deniega no devuelve error: devuelve cero filas.
  if (!data || data.length === 0) {
    return {
      error:
        "No se pudo eliminar el ítem: no existe o no tiene permisos para eliminarlo.",
    };
  }

  revalidatePath("/ventas/items");
  revalidatePath("/ventas/nueva");
  return {};
}
