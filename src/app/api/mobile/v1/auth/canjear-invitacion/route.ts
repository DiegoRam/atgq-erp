import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError, newRequestId } from "@/lib/api/response";
import { chequearLimite, limpiarLimite } from "@/lib/api/rate-limit";
import { canjearInvitacionSchema } from "@/lib/schemas/mobile";
import { hashCodigo, tieneFormaDeCodigo } from "@/lib/invitaciones";
import { codigoDeError } from "@/lib/api/rpc-errors";

/**
 * Paso 2 de la activación: canjea el código, CREA la cuenta y devuelve la sesión.
 *
 * La cuenta se crea acá y no antes por tres razones:
 *   * permite dejar `enable_signup = false` en Supabase Auth — con signup
 *     abierto, cualquiera con la anon key (que es pública) crea cuentas;
 *   * no existe el estado intermedio "tengo cuenta pero no estoy vinculado",
 *     que habría que diseñar, mostrar y soportar;
 *   * es un solo request desde la pantalla de activación.
 *
 * El ORDEN de los pasos es parte del diseño, no una casualidad:
 *   1. rate limit          → 429
 *   2. validar sin consumir → 400/409/410
 *   3. crear el usuario     → 409 si el email ya existe
 *   4. canjear + vincular   → atómico en la base; si falla, se borra el usuario
 *   5. iniciar sesión       → 201 con la sesión
 *
 * Validar ANTES de crear evita dos cosas: consumir el código si la creación
 * falla, y usar el endpoint como oráculo de "¿este email ya tiene cuenta?" sin
 * haber demostrado antes tener un código válido.
 */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const admin = createAdminClient();

  // El body se parsea antes del rate limit: el limiter usa el hash del código
  // como clave alternativa cuando no hay IP confiable (ver chequearLimite).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("body_invalido", 400, "El cuerpo no es JSON válido.", requestId);
  }

  const parsed = canjearInvitacionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "datos_invalidos",
      400,
      parsed.error.issues[0].message,
      requestId,
    );
  }
  const { codigo, email, password } = parsed.data;

  if (!tieneFormaDeCodigo(codigo)) {
    return jsonError("codigo_invalido", 400, "El código no es válido.", requestId);
  }
  const codigoHash = hashCodigo(codigo);

  // ---- 1. rate limit ------------------------------------------------------
  const limite = await chequearLimite(admin, request, requestId, codigoHash);
  if (!limite.permitido) return limite.response;

  // ---- 2. validar sin consumir -------------------------------------------
  const { data: val, error: errVal } = await admin.rpc("mobile_validar_invitacion", {
    p_codigo_hash: codigoHash,
  });
  if (errVal) {
    console.error(`[${requestId}] mobile_validar_invitacion:`, errVal);
    return jsonError(
      "error_interno",
      500,
      "Ocurrió un error inesperado. Intente nuevamente más tarde.",
      requestId,
    );
  }
  const estado: string = (Array.isArray(val) ? val[0] : val)?.estado ?? "inexistente";
  if (estado === "expirada") {
    return jsonError(
      "codigo_expirado",
      410,
      "El código venció. Solicite uno nuevo en el club.",
      requestId,
    );
  }
  if (estado === "usada") {
    return jsonError(
      "codigo_ya_utilizado",
      409,
      "El código ya fue utilizado.",
      requestId,
    );
  }
  if (estado !== "valida") {
    return jsonError("codigo_invalido", 400, "El código no es válido.", requestId);
  }

  // ---- 3. crear el usuario Auth ------------------------------------------
  // email_confirm: true porque hoy `enable_confirmations = false` y no hay SMTP
  // configurado. Quien llegó hasta acá demostró tener un código emitido por el
  // club, así que el email no es la prueba de identidad. Cuando haya SMTP
  // conviene activar la confirmación: si el socio se equivoca al tipear el
  // mail, hoy se queda sin forma de recuperar la contraseña.
  const { data: creado, error: errUser } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (errUser || !creado?.user) {
    const msg = errUser?.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return jsonError(
        "email_en_uso",
        409,
        "Ya existe una cuenta con ese email.",
        requestId,
      );
    }
    console.error(`[${requestId}] createUser:`, errUser);
    return jsonError(
      "error_interno",
      500,
      "No se pudo crear la cuenta. Intente nuevamente más tarde.",
      requestId,
    );
  }
  const userId = creado.user.id;

  // ---- 4. canjear + vincular (atómico en la base) -------------------------
  const { data: canje, error: errCanje } = await admin.rpc(
    "mobile_canjear_invitacion",
    { p_codigo_hash: codigoHash, p_user_id: userId },
  );

  if (errCanje) {
    // Compensación: el usuario Auth se creó pero no quedó vinculado a ningún
    // socio. Dejarlo sería dejar una cuenta huérfana que ocupa el email y no
    // sirve para nada — y que impediría reintentar la activación, porque el
    // reintento chocaría contra `email_en_uso` para siempre.
    //
    // supabase-js resuelve con { data, error } y NO rechaza ante un error de
    // la API, así que hay que mirar `error`: un .catch() acá sería código
    // muerto y una compensación fallida quedaría completamente muda.
    const { error: errBorrado } = await admin.auth.admin.deleteUser(userId);
    if (errBorrado) {
      console.error(
        `[${requestId}] COMPENSACIÓN FALLIDA: quedó el usuario Auth ${userId} (${email}) sin vínculo. Borrar a mano desde Seguridad.`,
        errBorrado,
      );
    }

    const cod = codigoDeError(errCanje.message);
    if (cod === "codigo_invalido") {
      // Perdió la carrera contra otro canje del mismo código entre el paso 2 y
      // el 4. El UPDATE ... WHERE usado_at IS NULL es lo que garantiza que sólo
      // uno de los dos gane.
      return jsonError(
        "codigo_ya_utilizado",
        409,
        "El código ya fue utilizado.",
        requestId,
      );
    }
    console.error(`[${requestId}] mobile_canjear_invitacion:`, errCanje);
    return jsonError(
      "error_interno",
      500,
      "No se pudo activar la cuenta. Intente nuevamente más tarde.",
      requestId,
    );
  }

  const socio = Array.isArray(canje) ? canje[0] : canje;

  // ---- 5. iniciar sesión --------------------------------------------------
  // Con la anon key, no con el admin: se quiere exactamente la misma sesión que
  // obtendría la app llamando a signInWithPassword por su cuenta.
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: sesion, error: errLogin } = await anon.auth.signInWithPassword({
    email,
    password,
  });

  await limpiarLimite(admin, limite.claveHash);

  if (errLogin || !sesion?.session) {
    // La cuenta quedó creada y vinculada: no se compensa nada. Sólo falló el
    // login automático, y la app puede loguear con las credenciales que el
    // socio acaba de elegir.
    console.error(`[${requestId}] signInWithPassword tras canje:`, errLogin);
    return jsonOk(
      { socio, session: null, aviso: "Cuenta activada. Inicie sesión con su email y contraseña." },
      requestId,
      undefined,
      201,
    );
  }

  return jsonOk(
    {
      socio,
      session: {
        access_token: sesion.session.access_token,
        refresh_token: sesion.session.refresh_token,
        expires_at: sesion.session.expires_at,
        token_type: sesion.session.token_type,
      },
    },
    requestId,
    undefined,
    201,
  );
}
