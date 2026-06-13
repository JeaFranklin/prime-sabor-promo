/**
 * Envio de PROPOSTAS para promotoras (passo antes do contrato).
 *
 * Fluxo: JFS adiciona promotoras na escala → clica "Enviar proposta" →
 * sistema cria registro em `propostas` + envia WhatsApp com link público.
 * A promotora abre o link, aceita/recusa.
 */
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { enviarWhatsApp } from '@/lib/whatsapp'
import { calcDiasCorridos } from '@/lib/contratos/formatar'
import {
  calcularDataPagamentoCliente, calcularDataPagamentoPromotora, proximoDiaUtil, somarDias,
} from '@/lib/contratos/datas-uteis'

const EXPIRA_HORAS = 2

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

function gerarToken(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, '')
}

function dataBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function horaBR(h: string | null | undefined): string {
  return h ? h.substring(0, 5) : ''
}

function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export type ResumoEnvio = {
  enviadas: number
  pulados: number
  erros: string[]
  propostas_ids: string[]
}

/**
 * Envia proposta para UMA promotora específica do serviço.
 * Se já existir proposta ativa pra essa (servico, promotora), não duplica.
 */
export async function enviarPropostaParaPromotora(
  servicoId: string,
  promotoraId: string,
): Promise<ResumoEnvio> {
  const resumo: ResumoEnvio = { enviadas: 0, pulados: 0, erros: [], propostas_ids: [] }
  const supa = adminClient()

  console.log(`[propostas] enviando proposta — servico=${servicoId} promotora=${promotoraId}`)

  // 1. Carrega serviço com cliente
  const { data: srv, error: errSrv } = await supa
    .from('servicos')
    .select('*, clientes(nome_empresa)')
    .eq('id', servicoId)
    .single()
  if (errSrv || !srv) {
    resumo.erros.push(`Serviço não encontrado: ${errSrv?.message}`)
    return resumo
  }
  if (!srv.data_inicio || !srv.data_fim) {
    resumo.erros.push('Serviço sem datas — informe início/fim antes.')
    return resumo
  }

  // 2. Carrega promotora
  const { data: prom, error: errProm } = await supa
    .from('promotoras').select('id, nome, whatsapp').eq('id', promotoraId).single()
  if (errProm || !prom) {
    resumo.erros.push(`Promotora não encontrada: ${errProm?.message}`)
    return resumo
  }

  // 3. Já existe proposta ativa? (status != cancelada/recusada/expirada)
  const { data: existente } = await supa
    .from('propostas')
    .select('id, status')
    .eq('servico_id', servicoId).eq('promotora_id', promotoraId)
    .maybeSingle()
  if (existente && ['enviada', 'aceita', 'gerou_contrato'].includes(existente.status)) {
    console.log(`[propostas] já existe proposta ativa (${existente.status}) — pulando`)
    resumo.pulados++
    return resumo
  }

  // 4. Cálculos
  const qtdDias = calcDiasCorridos(srv.data_inicio, srv.data_fim)
  const diaria = srv.valor_diaria || 0
  const valorTotal = diaria * qtdDias
  const dataEmissaoNF = srv.data_emissao_nf || proximoDiaUtil(somarDias(srv.data_fim, 1))
  const prazoCliente = srv.prazo_pagamento_dias ?? 30
  const dataPagCliente = calcularDataPagamentoCliente(dataEmissaoNF, prazoCliente)
  const dataPagPromotora = calcularDataPagamentoPromotora(dataPagCliente)

  // 5. Insere proposta
  const token = gerarToken()
  const expiraEm = new Date(Date.now() + EXPIRA_HORAS * 3600000).toISOString()
  const payload = {
    servico_id: servicoId,
    promotora_id: promotoraId,
    status: 'enviada' as const,
    valor_diaria: diaria,
    valor_total: valorTotal,
    qtd_dias: qtdDias,
    data_inicio_servico: srv.data_inicio,
    data_fim_servico: srv.data_fim,
    horario_inicio: srv.horario_inicio,
    horario_fim: srv.horario_fim,
    data_pagamento_promotora: dataPagPromotora,
    local_completo: srv.local_completo
      || [srv.rua, srv.numero, srv.bairro, srv.cidade, srv.estado].filter(Boolean).join(', '),
    servico_nome: srv.nome,
    cliente_nome: srv.clientes?.nome_empresa || '—',
    token,
    expira_em: expiraEm,
    enviada_whatsapp_numero: prom.whatsapp,
  }

  // Se já existia (cancelada/recusada/expirada), faz upsert
  const { data: inserida, error: errIns } = await supa
    .from('propostas').upsert(payload, { onConflict: 'servico_id,promotora_id' })
    .select('id').single()

  if (errIns || !inserida) {
    resumo.erros.push(`Erro ao gravar proposta: ${errIns?.message}`)
    return resumo
  }

  // 6. Envia WhatsApp
  if (prom.whatsapp) {
    const baseUrl = process.env.APP_URL || ''
    const link = `${baseUrl}/propostas/${token}`
    const hrIni = horaBR(srv.horario_inicio)
    const hrFim = horaBR(srv.horario_fim)
    const linhaHorario = hrIni || hrFim
      ? `🕐 Horário: ${hrIni}${hrFim ? ` às ${hrFim}` : ''}\n`
      : ''
    const msg =
      `🎯 *Nova proposta de serviço — ${srv.nome}*\n\n` +
      `Olá *${prom.nome.split(' ')[0]}*! A JFS Consultoria tem uma oportunidade para você:\n\n` +
      `🏢 Cliente: ${payload.cliente_nome}\n` +
      `📅 Período: ${dataBR(srv.data_inicio)} a ${dataBR(srv.data_fim)} (${qtdDias} dias)\n` +
      linhaHorario +
      `📍 Local: ${payload.local_completo}\n` +
      `💰 Diária: ${moeda(diaria)} • Total: *${moeda(valorTotal)}*\n` +
      `📆 Pagamento previsto: ${dataBR(dataPagPromotora)}\n\n` +
      `⏰ *Validade: ${EXPIRA_HORAS} horas*\n\n` +
      `✅ Para *ACEITAR* esta proposta, responda *SIM*\n` +
      `❌ Para *RECUSAR*, responda *NÃO*\n\n` +
      `🔗 Ou veja os detalhes completos no link:\n${link}\n\n` +
      `💜 Aguardamos seu retorno!`

    const r = await enviarWhatsApp(prom.whatsapp, msg)
    if (r.ok) {
      await supa.from('propostas')
        .update({ enviada_whatsapp_em: new Date().toISOString() })
        .eq('id', inserida.id)
    } else {
      resumo.erros.push(`WhatsApp: ${r.erro}`)
    }
  } else {
    resumo.erros.push('Promotora sem WhatsApp cadastrado — proposta criada mas não enviada')
  }

  resumo.enviadas++
  resumo.propostas_ids.push(inserida.id)
  console.log(`[propostas] proposta ${inserida.id} criada e enviada`)
  return resumo
}

/**
 * Envia propostas em lote para todas as promotoras escaladas no serviço.
 */
export async function enviarPropostasDoServico(servicoId: string): Promise<ResumoEnvio> {
  const supa = adminClient()
  const { data: escala } = await supa.from('escala').select('promotora_id').eq('servico_id', servicoId)

  const acumulado: ResumoEnvio = { enviadas: 0, pulados: 0, erros: [], propostas_ids: [] }
  for (const e of escala || []) {
    const r = await enviarPropostaParaPromotora(servicoId, e.promotora_id)
    acumulado.enviadas += r.enviadas
    acumulado.pulados += r.pulados
    acumulado.erros.push(...r.erros)
    acumulado.propostas_ids.push(...r.propostas_ids)
  }
  return acumulado
}
