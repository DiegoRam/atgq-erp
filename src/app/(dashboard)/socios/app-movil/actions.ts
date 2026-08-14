"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatearCodigo,
  generarCodigo,
  hashCodigo,
  prefijoCodigo,
} from "@/lib/invitaciones";
import type {
  CandidatoEmision,
  CodigoEmitido,
  FilaAppMovil,
} from "@/types/app-movil";

/**
 * Emisión y administración de los códigos de la app móvil.
 *
 * Todas las operaciones pasan por RPCs que hacen su propio chequeo de RBAC
 * con `permiso_modulo_todos_los_roles`, así que el gate no depende de que
 * estas funciones se acuerden de validar. Se usa el cliente de cookies
 * (`createClient`) y no el admin: la RPC necesita el `auth.uid()` del operador
 * para el gate y para registrar quién emitió cada código.
 */

const MAX_LOTE = 1000;

export async function getEstadoAppMovil(params: {
  search?: string;
  estado?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: FilaAppMovil[]; total: number }> {
  const supabase = await createClient();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;

  const { data, error } = await supabase.rpc("listar_estado_app_movil", {
    p_search: params.search?.trim() || null,
    p_estado: params.estado || "todos",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });

  if (error) throw new Error(traducirError(error.message));

  const filas = (data ?? []) as (FilaAppMovil & { total_filas: number })[];
  // `total_filas` viene repetido en cada fila (count(*) OVER () de la RPC):
  // se lo saca del payload y se lo devuelve una sola vez.
  return {
    data: filas.map((fila) => {
      const copia = { ...fila } as Partial<FilaAppMovil & { total_filas: number }>;
      delete copia.total_filas;
      return copia as FilaAppMovil;
    }),
    total: filas.length > 0 ? Number(filas[0].total_filas) : 0,
  };
}

/**
 * Emite un código para un socio y lo devuelve EN CLARO, una sola vez.
 *
 * El código se genera acá (Node) y a la base sólo viaja su hash: ver
 * `hashCodigo` en src/lib/invitaciones.ts.
 */
export async function emitirCodigo(
  socioId: string,
  dias = 14,
): Promise<CodigoEmitido> {
  const supabase = await createClient();

  const codigo = generarCodigo();

  const { data, error } = await supabase.rpc("emitir_invitacion_socio", {
    p_socio_id: socioId,
    p_codigo_hash: hashCodigo(codigo),
    p_prefijo: prefijoCodigo(codigo),
    p_dias: dias,
  });

  if (error) throw new Error(traducirError(error.message));

  const fila = Array.isArray(data) ? data[0] : data;

  const { data: socio } = await supabase
    .from("socios")
    .select("nro_socio, apellido, nombre")
    .eq("id", socioId)
    .single();

  revalidatePath("/socios/app-movil");

  return {
    socio_id: socioId,
    nro_socio: socio?.nro_socio ?? 0,
    apellido: socio?.apellido ?? "",
    nombre: socio?.nombre ?? "",
    codigo: formatearCodigo(codigo),
    expira_at: fila?.expira_at ?? "",
  };
}

/**
 * Emisión masiva. Un solo round-trip a la base: hacer N llamadas a
 * `emitir_invitacion_socio` desde acá tardaría minutos con un lote grande y se
 * comería el timeout de la lambda.
 *
 * Los socios que ya tienen cuenta activa se saltean en silencio del lado de la
 * base; por eso el resultado puede tener menos filas que `socioIds`.
 */
export async function emitirCodigosMasivo(
  socioIds: string[],
  dias = 14,
): Promise<CodigoEmitido[]> {
  if (socioIds.length === 0) return [];
  if (socioIds.length > MAX_LOTE) {
    throw new Error(
      `El lote no puede superar los ${MAX_LOTE} socios. Filtre por categoría y emita por tandas.`,
    );
  }

  const supabase = await createClient();

  // El código en claro se conserva sólo en memoria de este request, indexado
  // por socio, para poder devolverlo junto con el nombre. A la base va el hash.
  const claros = new Map<string, string>();
  const items = socioIds.map((socioId) => {
    const codigo = generarCodigo();
    claros.set(socioId, codigo);
    return {
      socio_id: socioId,
      codigo_hash: hashCodigo(codigo),
      prefijo: prefijoCodigo(codigo),
    };
  });

  const { data, error } = await supabase.rpc("emitir_invitaciones_socios", {
    p_items: items,
    p_dias: dias,
  });
  if (error) throw new Error(traducirError(error.message));

  const emitidas = (data ?? []) as { socio_id: string; expira_at: string }[];
  if (emitidas.length === 0) return [];

  const { data: socios } = await supabase
    .from("socios")
    .select("id, nro_socio, apellido, nombre")
    .in(
      "id",
      emitidas.map((e) => e.socio_id),
    );

  const porId = new Map((socios ?? []).map((s) => [s.id, s]));

  revalidatePath("/socios/app-movil");

  return emitidas.map((e) => {
    const s = porId.get(e.socio_id);
    return {
      socio_id: e.socio_id,
      nro_socio: s?.nro_socio ?? 0,
      apellido: s?.apellido ?? "",
      nombre: s?.nombre ?? "",
      codigo: formatearCodigo(claros.get(e.socio_id)!),
      expira_at: e.expira_at,
    };
  });
}

export async function revocarCodigo(socioId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revocar_invitacion_socio", {
    p_socio_id: socioId,
  });
  if (error) throw new Error(traducirError(error.message));
  revalidatePath("/socios/app-movil");
  return Number(data ?? 0);
}

/**
 * Desvincula la cuenta de un socio y además la banea en Auth.
 *
 * Las dos cosas hacen falta: revocar la fila de `socios_usuarios` hace que las
 * RPCs devuelvan vacío de inmediato, pero el access token que el teléfono ya
 * tiene sigue siendo un token válido del proyecto hasta que expire (1 h). El
 * ban lo corta ahí mismo y evita que pueda renovarlo.
 */
export async function desvincularCuenta(socioId: string): Promise<void> {
  const supabase = await createClient();

  const { data: userId, error } = await supabase.rpc("desvincular_cuenta_socio", {
    p_socio_id: socioId,
  });
  if (error) throw new Error(traducirError(error.message));

  if (userId) {
    const admin = createAdminClient();
    const { error: banError } = await admin.auth.admin.updateUserById(
      userId as string,
      { ban_duration: "876000h" }, // ~100 años, igual que toggleUsuarioStatus
    );
    // El vínculo ya se revocó y es lo que corta el acceso a los datos. Si el
    // ban falla se avisa, pero no se revierte: dejar el vínculo vivo sería peor.
    if (banError) {
      throw new Error(
        "La cuenta fue desvinculada, pero no se pudo bloquear el acceso en Auth. Revise el usuario en Seguridad.",
      );
    }
  }

  revalidatePath("/socios/app-movil");
}

/**
 * Socios candidatos para la emisión masiva: sin cuenta activa, sin código
 * vigente (los vencidos SÍ entran) y sin fecha de baja.
 *
 * El filtro por categoría y el tope del lote los resuelve la RPC en SQL.
 * Filtrarlos acá sobre una consulta ya paginada devolvía "los de esta categoría
 * que además caen en la primera página", que para una categoría grande son unos
 * pocos o ninguno — y sin ninguna señal de que faltaba gente.
 *
 * `total` es el total real de candidatos, que puede ser mayor que `data.length`
 * si supera el tope: así la pantalla puede avisar cuántos quedan afuera en vez
 * de dar la tanda por completa.
 */
export async function getSociosParaEmision(categoriaId?: string): Promise<{
  data: CandidatoEmision[];
  total: number;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("listar_socios_para_emision", {
    p_categoria_id: categoriaId ?? null,
    p_limit: MAX_LOTE,
  });
  if (error) throw new Error(traducirError(error.message));

  const filas = (data ?? []) as (CandidatoEmision & { total_candidatos: number })[];

  return {
    data: filas.map((fila) => {
      const copia = { ...fila } as Partial<
        CandidatoEmision & { total_candidatos: number }
      >;
      delete copia.total_candidatos;
      return copia as CandidatoEmision;
    }),
    total: filas.length > 0 ? Number(filas[0].total_candidatos) : 0,
  };
}

/**
 * Las RPCs levantan identificadores snake_case (contrato compartido con la API
 * móvil, ver src/lib/api/rpc-errors.ts). Acá se traducen al español para el ERP.
 *
 * Lo NO mapeado se generaliza en vez de mostrarse tal cual. El caso concreto que
 * lo motiva: dos operadores emitiendo lotes con socios en común hacen saltar el
 * índice `ux_socios_invitaciones_socio_viva`, y sin esto el toast mostraba
 * "duplicate key value violates unique constraint …" en la cara del usuario.
 */
function traducirError(mensaje: string): string {
  const limpio = mensaje.trim();

  const mapa: Record<string, string> = {
    sin_permiso: "No tiene permisos para realizar esta operación.",
    no_autenticado: "Su sesión expiró. Vuelva a iniciar sesión.",
    socio_ya_vinculado: "El socio ya tiene una cuenta activa en la app.",
    socio_inexistente: "El socio no existe.",
    sin_cuenta_vinculada: "El socio no tiene una cuenta vinculada.",
    dias_fuera_de_rango: "La validez debe estar entre 1 y 90 días.",
    lote_demasiado_grande: `El lote no puede superar los ${MAX_LOTE} socios.`,
    cuenta_con_rol_erp:
      "Esa cuenta tiene un rol del ERP asignado; no puede vincularse como socio.",
  };
  if (limpio in mapa) return mapa[limpio];

  if (limpio.includes("ux_socios_invitaciones_socio_viva")) {
    return "Otro usuario emitió un código para alguno de estos socios al mismo tiempo. Recalcule el lote y reintente.";
  }

  console.error("[app-movil] error no mapeado:", mensaje);
  return "Ocurrió un error inesperado. Intente nuevamente.";
}
