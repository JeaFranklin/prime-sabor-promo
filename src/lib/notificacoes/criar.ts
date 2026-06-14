/**
 * Helper para criar notificações in-app (sino do header).
 *
 * Server-side. Usa o cliente admin (service_role) pra que possa ser chamado
 * de webhooks e endpoints sem cookie (ex.: aceite público de contrato).
 *
 * Por design, ERROS NÃO PROPAGAM — uma falha aqui apenas loga, sem quebrar
 * o fluxo principal (webhook do WhatsApp, aceite de contrato, etc.).
 */
import 'server-only'
import { createClient } from '@supabase/supabase-js'

type TipoNotificacao =
  | 'proposta_aceita'
  | 'proposta_recusada'
  | 'contrato_aceito'
  | 'contrato_recusado'
  | 'pagamento_atrasado'
  | 'info'

export type NovaNotificacao = {
  tipo: TipoNotificacao
  titulo: string
  mensagem?: string
  icone?: string         // emoji custom; se omitir, usa o padrão por tipo
  link_para?: string     // rota interna pra ir ao clicar
  user_id?: string | null  // null/undef = pra todos os admins
  metadata?: Record<string, unknown>
}

// Emoji padrão por tipo — usado se a notificação não trouxer 'icone'
const ICONE_PADRAO: Record<TipoNotificacao, string> = {
  proposta_aceita: '✅',
  proposta_recusada: '❌',
  contrato_aceito: '📝',
  contrato_recusado: '🚫',
  pagamento_atrasado: '⚠️',
  info: 'ℹ️',
}

export const iconePadrao = (tipo: TipoNotificacao) => ICONE_PADRAO[tipo]

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function criarNotificacao(n: NovaNotificacao): Promise<void> {
  try {
    const supa = adminClient()
    const { error } = await supa.from('notificacoes').insert({
      tipo: n.tipo,
      titulo: n.titulo,
      mensagem: n.mensagem ?? null,
      icone: n.icone ?? ICONE_PADRAO[n.tipo],
      link_para: n.link_para ?? null,
      user_id: n.user_id ?? null,
      metadata: n.metadata ?? null,
    })
    if (error) {
      console.error('[notif] falhou ao criar:', error.message, '| dados:', n)
    } else {
      console.log(`[notif] criada: ${n.tipo} — "${n.titulo}"`)
    }
  } catch (e) {
    const msg = (e as { message?: string })?.message || JSON.stringify(e)
    console.error('[notif] exceção ao criar:', msg)
  }
}
