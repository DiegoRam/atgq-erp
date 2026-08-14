import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase atado al access token de un socio de la app móvil.
 *
 * Es el cuarto cliente del proyecto, junto a server.ts (cookies), client.ts
 * (browser) y admin.ts (service-role). Existe porque la app mobile manda el
 * token por header `Authorization: Bearer`, no por cookie: ni el cliente de
 * cookies ni el de browser sirven.
 *
 * Usa la anon key, así que las peticiones corren con los permisos del socio —
 * que son deliberadamente ninguno sobre las tablas. Lo único que puede hacer
 * este cliente es llamar a las funciones `mobile_*` con GRANT a `authenticated`.
 */
export function createBearerClient(accessToken: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      // No hay nada que persistir ni refrescar: el cliente vive lo que dura el
      // request. El refresh del token lo maneja supabase-js en el teléfono.
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
