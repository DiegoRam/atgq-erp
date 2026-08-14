// Guard de build: este módulo usa SUPABASE_SERVICE_ROLE_KEY y bypassea RLS.
// Importarlo desde un Client Component pasa a ser un error de compilación en
// vez de un `undefined` silencioso en runtime.
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
