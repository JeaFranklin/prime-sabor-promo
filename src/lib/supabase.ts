// Cliente Supabase SSR-aware: lê a sessão do COOKIE (não do localStorage).
// Necessário pra que as policies de RLS reconheçam o usuário logado como
// `authenticated` em chamadas feitas a partir de componentes 'use client'.
//
// Antes usávamos `createClient` do @supabase/supabase-js — esse é "vanilla"
// (não enxerga cookies), então as chamadas iam como `anon` e o RLS recusava.
//
// As 12 telas antigas (promotoras/, clientes/, servicos/) que importam
// { supabase } daqui continuam funcionando sem nenhuma alteração — só o
// motor por trás trocou.

import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
