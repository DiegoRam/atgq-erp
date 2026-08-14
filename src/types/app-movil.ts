/** Estado de la cuenta de app móvil de un socio, tal como lo devuelve `listar_estado_app_movil`. */
export type EstadoAppMovil =
  | "sin_codigo"
  | "codigo_vigente"
  | "codigo_vencido"
  | "vinculado";

export const ESTADO_APP_MOVIL_LABEL: Record<EstadoAppMovil, string> = {
  sin_codigo: "Sin código",
  codigo_vigente: "Código vigente",
  codigo_vencido: "Código vencido",
  vinculado: "Vinculado",
};

export type FilaAppMovil = {
  socio_id: string;
  nro_socio: number;
  apellido: string;
  nombre: string;
  dni: string;
  estado: EstadoAppMovil;
  codigo_prefijo: string | null;
  expira_at: string | null;
  email: string | null;
  vinculado_at: string | null;
  ultimo_acceso: string | null;
};

/**
 * Resultado de emitir un código. `codigo` es el ÚNICO momento en que el código
 * existe en claro: la base sólo guarda su hash, así que si el operador cierra
 * el diálogo sin copiarlo hay que reemitir.
 */
/** Candidato a recibir un código en la emisión masiva. */
export type CandidatoEmision = {
  socio_id: string;
  nro_socio: number;
  apellido: string;
  nombre: string;
  categoria: string;
  /** true si ya tenía un código pero venció: reemitir lo reemplaza. */
  vencido: boolean;
};

export type CodigoEmitido = {
  socio_id: string;
  nro_socio: number;
  apellido: string;
  nombre: string;
  codigo: string;
  expira_at: string;
};
