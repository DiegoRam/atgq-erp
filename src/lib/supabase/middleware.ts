import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Los route handlers de /api se autentican con `Authorization: Bearer`, no
  // con cookies, y tienen que contestar 401 JSON. El redirect 307 a /login de
  // más abajo le devolvería HTML de la pantalla de login a un cliente que
  // espera JSON, que es indistinguible de un bug del endpoint.
  //
  // Esto está duplicado con la exclusión de `api/` en el matcher de
  // src/middleware.ts a propósito: el matcher es la optimización (evita un
  // round-trip a GoTrue por request), este guard es la corrección, y sobrevive
  // a que alguien edite el matcher sin acordarse de por qué estaba así.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and supabase.auth.getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If no session and not on /login, redirect to /login
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If authenticated and on /login, redirect to /
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
