import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const isPublic = isPublicPath(pathname)

  // Rotas públicas (webhook do Evolution + páginas/APIs de aceite por token)
  // não exigem login — quem garante a segurança aí é o token aleatório na URL.
  if (!user && !isLoginPage && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

/**
 * Caminhos que NÃO exigem login.
 * - Webhook do Evolution (chamada externa, sem cookie de sessão)
 * - Páginas públicas acessadas pelo link no WhatsApp (aceite/recusa de proposta e contrato)
 * - APIs correspondentes a essas páginas (autenticação por TOKEN no path)
 */
function isPublicPath(pathname: string): boolean {
  if (pathname === '/api/whatsapp/webhook') return true
  if (pathname.startsWith('/propostas/')) return true
  if (pathname.startsWith('/contratos/aceite/')) return true
  if (pathname.startsWith('/api/contratos/aceite/')) return true
  // /api/propostas/[token] é público (GET dados + POST resposta).
  // /api/propostas/enviar requer login (NÃO entra aqui).
  if (pathname.startsWith('/api/propostas/') && pathname !== '/api/propostas/enviar') return true
  return false
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
