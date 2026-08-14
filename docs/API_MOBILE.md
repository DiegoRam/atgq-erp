# API móvil para socios

API HTTP que permite a la app de los socios consultar **sus propios** datos:
perfil, cuotas sociales, compras y —si es titular— las cuotas de su grupo familiar.

Base: `https://<host>/api/mobile/v1`

---

## Modelo de seguridad

La propiedad central, y la que hay que preservar en cualquier cambio futuro:

> **Un socio autenticado tiene cero permisos de tabla.** Su JWT contra
> PostgREST directo (`/rest/v1/socios`, `/rest/v1/cuotas`, …) devuelve `[]`.
> Lo único que puede hacer es ejecutar las funciones `mobile_*` que tienen
> `GRANT EXECUTE ... TO authenticated`.

Eso funciona porque el RBAC del ERP se resuelve por filas en `usuarios_roles`, y
una cuenta de socio **no tiene ninguna**. Las políticas RLS de `socios`, `cuotas`
y `ventas` piden `get_user_modulo_permission('socios'|'ventas', 'leer')`, que
para esa cuenta es `false`.

Consecuencias de diseño:

- **No se agregó ninguna política RLS nueva** sobre `socios`/`cuotas`/`ventas`.
  Las políticas se OR-ean entre sí; una permisiva nueva obligaría a re-verificar
  que no amplíe el acceso de nadie más.
- **Ninguna función acepta un `socio_id` por parámetro.** Todas lo derivan de
  `auth.uid()` vía `mobile_socio_actual()`. Sin parámetro no hay IDOR.
- **Auditar la seguridad de esta API = leer las funciones** de
  `supabase/migrations/20260813000001_app_movil_socios.sql`. No hay más superficie.

### El invariante socio ≠ staff

Si una cuenta móvil llegara a tener un rol del ERP, dejaría de ver "sólo lo suyo"
y pasaría a leer el padrón completo. Dos triggers lo hacen imposible a nivel de base:

| Trigger | Sobre | Impide |
|---|---|---|
| `trg_socios_usuarios_excluye_staff` | `socios_usuarios` | vincular como socio una cuenta que ya tiene rol del ERP |
| `trg_usuarios_roles_excluye_socios` | `usuarios_roles` | asignarle un rol del ERP a una cuenta vinculada a un socio |

El segundo es el que se olvida: sin él, la pantalla de Seguridad del ERP le
asignaría "Administrador" a la cuenta móvil de un socio sin que nada lo frene.

---

## Autenticación

La app usa **supabase-js directo** contra Supabase Auth para login y refresh
(`signInWithPassword`, rotación automática del refresh token). Esta API no
implementa `/login` ni `/refresh` a propósito: sería un lugar más por donde pasa
una contraseña, y una reimplementación del refresh.

Todos los endpoints bajo `/mi/*` requieren:

```
Authorization: Bearer <access_token>
```

| Situación | Respuesta |
|---|---|
| Sin header o mal formado | `401 no_autenticado` + `WWW-Authenticate: Bearer` |
| Token inválido o vencido | `401 no_autenticado` |
| Token válido, cuenta sin vincular | `403 cuenta_no_vinculada` |
| Vínculo revocado (desvinculado por el club) | `403 cuenta_no_vinculada` |

El token se valida en la misma llamada que resuelve la identidad
(`mobile_contexto_socio`): PostgREST verifica la firma antes de poblar
`auth.uid()`, así que no hace falta un round-trip extra a GoTrue.

---

## Envelope

Éxito:
```json
{ "data": { ... } }
{ "data": [ ... ], "meta": { "page": 1, "per_page": 50, "total": 137 } }
```

Error:
```json
{ "error": { "code": "no_es_titular", "message": "Sólo el titular..." },
  "request_id": "b3f1…" }
```

Toda respuesta lleva `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`
y `X-Request-Id`. **Nunca se propaga un mensaje crudo de Postgres**: lo no
mapeado es un `500 error_interno` y el detalle real va a los logs de Vercel
junto al `request_id`.

> **Contrato:** las funciones SQL levantan identificadores snake_case
> (`RAISE EXCEPTION 'no_es_titular'`), no frases en español. Son contrato de API
> y los mapea `src/lib/api/rpc-errors.ts`. Si se "mejora" el mensaje en la
> migración, el mapeo se rompe en silencio y todo pasa a ser 500.

---

## Endpoints

### Activación de la cuenta

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/validar-invitacion` | Valida un código **sin consumirlo** |
| `POST` | `/auth/canjear-invitacion` | Canjea el código, **crea** la cuenta y devuelve la sesión |

**`POST /auth/validar-invitacion`** — `{ "codigo": "K7M2P-QX9RT" }`

```json
{ "data": { "socio": { "nro_socio": 1234, "apellido": "PÉREZ", "nombre": "Juan" } } }
```

Permite mostrar "¿Sos JUAN PÉREZ, socio 1234?" antes de pedir email y contraseña.

| Código | Status |
|---|---|
| `codigo_invalido` | 400 |
| `codigo_ya_utilizado` | 409 |
| `codigo_expirado` | 410 |
| `demasiados_intentos` | 429 + `Retry-After` |

**`POST /auth/canjear-invitacion`** — `{ "codigo", "email", "password" }` → `201`

```json
{ "data": { "socio": {...},
            "session": { "access_token": "...", "refresh_token": "...",
                         "expires_at": 1234567890, "token_type": "bearer" } } }
```

El orden de las operaciones es parte del diseño: rate limit → validar sin
consumir → crear el usuario → canjear+vincular (atómico) → login. Validar
**antes** de crear evita consumir el código si la creación falla, y evita usar
el endpoint como oráculo de "¿este email ya tiene cuenta?" sin haber demostrado
tener un código. Si el canje falla después de crear el usuario, el usuario se
borra (compensación).

Extra: `email_en_uso` → 409.

### Datos del socio

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/mi/perfil` | Categoría, alta, antigüedad (calculada), activo, email |
| `GET` | `/mi/cuotas` | `?estado=todas\|impagas\|pagas&desde=&hasta=&page=&per_page=` |
| `GET` | `/mi/cuotas/resumen` | Cuántas debe, cuánto suma, último período pagado |
| `GET` | `/mi/compras` | `?desde=&hasta=&page=&per_page=` — excluye anuladas |
| `GET` | `/mi/compras/{id}` | Cabecera + ítems con precios congelados |
| `GET` | `/mi/grupo-familiar` | **Sólo el titular** |
| `GET` | `/mi/grupo-familiar/cuotas` | **Sólo el titular** |

`per_page` se clampea a 100 en el schema Zod **y** en SQL (`least(greatest(...))`),
porque las funciones son alcanzables por PostgREST directo sin pasar por el handler.

`GET /mi/compras/{id}` devuelve **404** tanto si la venta no existe como si es de
otro socio. Nunca 403: un 403 confirmaría que el uuid existe y es de otra persona.

### Grupo familiar

Regla: **sólo el titular** (`grupos_familiares.titular_id`) ve las cuotas del grupo.

| Situación | Código | Status |
|---|---|---|
| El socio no pertenece a un grupo | `sin_grupo_familiar` | 403 |
| El grupo no tiene titular designado | `grupo_sin_titular` | 403 |
| El socio es miembro pero no titular | `no_es_titular` | 403 |

`titular_id IS NULL` **deniega**, no infiere. En los datos migrados del legacy
puede haber grupos sin titular, y adivinarlo (el más antiguo, el de menor
`nro_socio`) sería inventar una regla de autorización cuyo costo de error es
mostrarle a alguien la deuda de un tercero.

Para que eso no sea un ticket irresoluble, `/socios/grupos-familiares` muestra un
aviso con el conteo de grupos sin titular y un filtro para encontrarlos.

De los demás miembros se expone sólo `nro_socio`, `apellido`, `nombre`,
`categoria`, `cuotas_impagas` y `monto_adeudado`. **No** se expone DNI, fecha de
nacimiento ni localidad: es PII de otra persona y no hace falta para el caso de uso.

---

## Códigos de invitación

Los emite el club desde **`/socios/app-movil`** (módulo SOCIOS del ERP). No hay
auto-registro: el padrón no tiene emails, así que no hay a qué mandarle nada.

- **Formato:** Crockford base32 (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`, sin I/L/O/U),
  10 caracteres, presentados como `XXXXX-XXXXX`. Espacio: 2^50 ≈ 1,1×10^15.
- **Al canjear** se aplica el mapeo Crockford (`O→0`, `I→1`, `L→1`), así que un
  socio que tipea `l` en vez de `1` entra igual.
- **En la base sólo vive `sha256(codigo_normalizado || INVITACIONES_PEPPER)`**,
  calculado en Node (`src/lib/invitaciones.ts`). El pepper nunca toca la base:
  un dump de Postgres no alcanza para fuerza bruta offline.
- **Un solo uso**, garantizado por `UPDATE ... WHERE usado_at IS NULL ... RETURNING`
  en una sola sentencia (no SELECT-después-UPDATE). Bajo concurrencia, el segundo
  canje espera el lock, reevalúa la condición y no matchea.
- **Un solo código vivo por socio**, garantizado por un índice único parcial.
  Reemitir revoca el anterior.
- **Vigencia** por defecto 14 días (1–90).
- **Emisión masiva:** tope de 1.000 por tanda (`listar_socios_para_emision`), con
  el total real de candidatos visible en pantalla para saber cuántos quedan para
  la tanda siguiente. Entran los socios sin cuenta activa y sin código vigente
  —los de código **vencido** también, porque reemitir revoca el anterior— y se
  excluyen los que tienen `fecha_baja`. El filtro por categoría y el tope se
  resuelven en SQL: aplicarlos en JS sobre una consulta ya paginada devolvía
  "los de esa categoría que además caen en la primera página".

### Cuentas de socios y el módulo Seguridad

Cada activación crea un usuario en `auth.users` (hasta ~8.400). La pantalla
**Seguridad → Usuarios** las excluye explícitamente y pagina hasta agotar: sin
eso, el staff —que son un puñado y se crearon primero— se caía del listado.
Las cuentas de socios se administran desde `/socios/app-movil`.

### Rate limit

10 intentos por IP cada 15 minutos; al pasarse, 1 hora de bloqueo. El contador
vive en la tabla `canje_rate_limit` y no en memoria porque Vercel corre lambdas
sin estado compartido.

La IP se toma de **`x-vercel-forwarded-for`** (o `x-real-ip` detrás de un proxy
propio), nunca de `x-forwarded-for` a secas: el cliente le puede anteponer
entradas y mandar una IP distinta por request, con lo que el limiter se vuelve
decorativo.

**Cuando no hay ninguna cabecera confiable** —básicamente desarrollo local— la
clave del bucket pasa a derivarse del código intentado, y se emite un `warn` en
los logs. La tentación es usar un bucket fijo tipo `"desconocida"`, pero eso
significa que 11 requests de cualquiera bloquean **todas** las activaciones
durante una hora: un DoS trivial contra la funcionalidad entera. Es una
degradación consciente — sin un identificador de cliente confiable no se puede
limitar por cliente — y en Vercel, que es el despliegue real, la cabecera
siempre está.

`registrar_intento_canje`, `limpiar_intento_canje`, `mobile_validar_invitacion` y
`mobile_canjear_invitacion` están revocadas de `anon` **y** de `authenticated`:
sólo se llegan con service_role, o sea sólo desde los route handlers. Por eso el
limiter no se puede saltear yendo directo a PostgREST.

---

## Configuración

| Variable | Dónde | Notas |
|---|---|---|
| `INVITACIONES_PEPPER` | Vercel (Production + Preview) y `.env.local` | ≥32 caracteres. `openssl rand -base64 48`. **Nunca** con prefijo `NEXT_PUBLIC_` |
| `SUPABASE_SERVICE_ROLE_KEY` | ya existente | Usado sólo por los endpoints de `/auth/*` |

**Rotar `INVITACIONES_PEPPER` invalida todos los códigos pendientes de golpe.**
No rotarlo con una emisión masiva en la calle.

### Supabase Auth

- `enable_signup = false` — la anon key es pública; con signup abierto cualquiera
  crea cuentas. Ya está en `supabase/config.toml`, pero **hay que aplicarlo también
  en el Dashboard del proyecto cloud**: `config.toml` sólo gobierna el stack local.
- **SMTP es prerequisito de lanzamiento.** Con signup cerrado, el único camino de
  recuperación de contraseña es `resetPasswordForEmail`, que necesita SMTP. Sin
  eso, un socio que olvida la clave se convierte en trabajo manual del club.
- `enable_confirmations` está en `false` y las cuentas se crean con
  `email_confirm: true`. Conviene activarlo una vez que haya SMTP: hoy, si el
  socio se equivoca al tipear el mail, queda sin forma de recuperar la cuenta.

---

## CORS

Si la app es nativa (React Native / Expo) no hace falta nada. Si es una PWA en
otro origen, agregar `OPTIONS` y una allowlist de orígenes.

La auth va por header `Authorization` y **no por cookies**, así que **no hay
superficie CSRF**. Queda escrito para que a nadie se le ocurra agregar auth por
cookie más adelante sin darse cuenta de lo que cambia.
