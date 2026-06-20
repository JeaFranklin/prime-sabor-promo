/**
 * confirmacao.ts — Fluxo de confirmação SIM/NÃO (Bot Viana)
 *
 * Quando admin pede uma alteração:
 *   1. criarPendencia() → insere em viana_fila_alteracoes + salva sessão aguardando
 *   2. Bot pergunta "Bot SIM para confirmar ou Bot NÃO para cancelar"
 *   3. processarConfirmacao() → detecta SIM/NÃO, muda status da fila, limpa sessão
 *   4. VPS cron (viana_aplicar.py) pega status='confirmado' e edita o Excel
 */
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { lerSessao, limparSessao } from './sessao'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const CAMPO_LABEL: Record<string, string> = {
  status: 'STATUS', prazo: 'PRAZO', fluxo: 'FLUXO', comprador: 'COMPRADOR', pedido: 'PEDIDO',
}

export async function criarPendencia(params: {
  numero:          string
  nome:            string
  campo:           string
  codigoFornec:    string
  valorNovo:       string
  dataAgenda:      string | null
  descricaoFornec: string
}): Promise<string> {
  const { numero, nome, campo, codigoFornec, valorNovo, dataAgenda, descricaoFornec } = params
  const supa = adminClient()

  // Cancela pendência anterior deste número (evita fila suja)
  await supa
    .from('viana_fila_alteracoes')
    .update({ status_fila: 'cancelado' })
    .eq('numero_whatsapp', numero)
    .eq('status_fila', 'aguardando_confirmacao')

  const { data, error } = await supa
    .from('viana_fila_alteracoes')
    .insert({
      numero_whatsapp: numero,
      nome_remetente:  nome,
      campo,
      codigo_fornec:   codigoFornec,
      valor_novo:      valorNovo,
      data_agenda:     dataAgenda,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Falha ao criar pendência: ${error?.message}`)

  await supa
    .from('viana_sessao_conversa')
    .upsert(
      { numero_whatsapp: numero, aguardando: 'confirmacao', fila_id: data.id,
        ultimo_intent: campo, atualizado_em: new Date().toISOString() },
      { onConflict: 'numero_whatsapp' }
    )

  const dataStr = dataAgenda
    ? new Date(dataAgenda + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null

  return [
    `⚠️ *CONFIRMAR ALTERAÇÃO*\n`,
    `Fornecedor: *${codigoFornec}* — ${descricaoFornec}`,
    dataStr ? `Data: ${dataStr}` : null,
    `Campo: *${CAMPO_LABEL[campo] || campo}*`,
    `Novo valor: *${valorNovo}*\n`,
    `Responda *Bot SIM* para confirmar ou *Bot NÃO* para cancelar.`,
    `_(expira em 5 min)_\n\n— Viana`,
  ].filter(Boolean).join('\n')
}

export async function processarConfirmacao(
  numero: string,
  texto: string
): Promise<{ tratado: boolean; resposta: string }> {
  const sessao = await lerSessao(numero)
  if (!sessao?.aguardando || !sessao.fila_id) {
    return { tratado: false, resposta: '' }
  }

  const supa = adminClient()
  const { data: fila } = await supa
    .from('viana_fila_alteracoes')
    .select('*')
    .eq('id', sessao.fila_id)
    .eq('status_fila', 'aguardando_confirmacao')
    .maybeSingle()

  if (!fila) {
    await limparSessao(numero)
    return { tratado: false, resposta: '' }
  }

  // Verifica expiração
  if (new Date(fila.expira_em) < new Date()) {
    await Promise.all([
      limparSessao(numero),
      supa.from('viana_fila_alteracoes').update({ status_fila: 'cancelado' }).eq('id', fila.id),
    ])
    return {
      tratado: true,
      resposta: '⏰ Tempo expirado. Alteração cancelada.\n\nEnvie o comando novamente.\n\n— Viana',
    }
  }

  const msg = texto.toLowerCase().replace(/^bot\b\s*/i, '').trim()
  const confirmou = /^(sim|s|yes|confirma|confirmo|ok)\b/.test(msg)
  const cancelou  = /^(n[aã]o|n|no|cancela|cancelar)\b/.test(msg)

  if (confirmou) {
    await Promise.all([
      limparSessao(numero),
      supa.from('viana_fila_alteracoes').update({ status_fila: 'confirmado' }).eq('id', fila.id),
    ])
    return {
      tratado: true,
      resposta: '✅ *Alteração confirmada!*\n\nA planilha será atualizada em até 2 minutos.\n\n— Viana',
    }
  }

  if (cancelou) {
    await Promise.all([
      limparSessao(numero),
      supa.from('viana_fila_alteracoes').update({ status_fila: 'cancelado' }).eq('id', fila.id),
    ])
    return {
      tratado: true,
      resposta: '❌ Alteração cancelada.\n\n— Viana',
    }
  }

  return {
    tratado: true,
    resposta: '❓ Não entendi. Responda *Bot SIM* para confirmar ou *Bot NÃO* para cancelar.\n\n— Viana',
  }
}
