/**
 * sessao.ts — Estado de conversa por número (Bot Viana)
 *
 * Persiste no Supabase (tabela viana_sessao_conversa) porque Vercel é
 * serverless — memória local não sobrevive entre requisições.
 *
 * Usado para saber se um número está aguardando SIM/NÃO de uma alteração.
 */
import 'server-only'
import { createClient } from '@supabase/supabase-js'

export type Sessao = {
  numero_whatsapp: string
  ultimo_intent:   string | null
  aguardando:      'confirmacao' | null
  fila_id:         string | null
  atualizado_em:   string
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function lerSessao(numero: string): Promise<Sessao | null> {
  const { data } = await adminClient()
    .from('viana_sessao_conversa')
    .select('*')
    .eq('numero_whatsapp', numero)
    .maybeSingle()
  return (data as Sessao) || null
}

export async function salvarSessao(
  numero: string,
  dados: Partial<Omit<Sessao, 'numero_whatsapp' | 'atualizado_em'>>
) {
  await adminClient()
    .from('viana_sessao_conversa')
    .upsert(
      { numero_whatsapp: numero, ...dados, atualizado_em: new Date().toISOString() },
      { onConflict: 'numero_whatsapp' }
    )
}

export async function limparSessao(numero: string) {
  await adminClient()
    .from('viana_sessao_conversa')
    .upsert(
      { numero_whatsapp: numero, aguardando: null, fila_id: null, atualizado_em: new Date().toISOString() },
      { onConflict: 'numero_whatsapp' }
    )
}
