/**
 * Geração automática de contratos para um serviço.
 *
 * Regra de disparo: serviço com duração >= 5 DIAS CORRIDOS.
 * Gera:
 *   • 1 contrato CLIENTE
 *   • N contratos PROMOTORA (1 por promotora escalada)
 * Faz upload do PDF e envia o link + mensagem por WhatsApp.
 *
 * Idempotente: se um contrato com mesmo serviço+parte já existir e
 * estiver em status != 'cancelado', não gera duplicado.
 */
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { calcDiasCorridos } from './formatar'
import {
  calcularDataPagamentoCliente, calcularDataPagamentoPromotora, proximoDiaUtil, somarDias,
} from './datas-uteis'
import { proximoNumeroContrato, gerarTokenAceite } from './numeracao'
import { gerarPdfCliente, gerarPdfPromotora } from './gerar-pdf'
import { enviarWhatsApp } from '@/lib/whatsapp'
import type {
  ConteudoContratoCliente, ConteudoContratoPromotora,
  DadosCliente, DadosEmpresa, DadosPromotora, DadosServico,
} from './tipos'

export const DURACAO_MINIMA_DIAS = 5
const EXPIRA_DIAS = 7

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

export type ResumoGeracao = {
  gerados: number
  pulados: number
  erros: string[]
  contratos_ids: string[]
}

/**
 * Roda o fluxo completo para um servico_id. Seguro chamar várias vezes.
 */
export async function gerarContratosDoServico(servicoId: string): Promise<ResumoGeracao> {
  const log: string[] = []
  const resumo: ResumoGeracao = { gerados: 0, pulados: 0, erros: [], contratos_ids: [] }
  const supa = adminClient()

  // 1) Buscar serviço, cliente e escala
  console.log(`[contratos] iniciando geração para servico_id=${servicoId}`)
  const { data: srv, error: errSrv } = await supa
    .from('servicos')
    .select('*, clientes(*)')
    .eq('id', servicoId)
    .single()
  if (errSrv || !srv) {
    resumo.erros.push(`Serviço não encontrado: ${errSrv?.message}`)
    return resumo
  }

  if (!srv.data_inicio || !srv.data_fim) {
    resumo.erros.push('Serviço sem datas — não dá pra calcular duração.')
    return resumo
  }

  const qtdDias = calcDiasCorridos(srv.data_inicio, srv.data_fim)
  console.log(`[contratos] duração: ${qtdDias} dia(s) (mínimo p/ gerar: ${DURACAO_MINIMA_DIAS})`)
  if (qtdDias < DURACAO_MINIMA_DIAS) {
    log.push(`Serviço tem ${qtdDias} dias — abaixo do mínimo de ${DURACAO_MINIMA_DIAS}. Nada a gerar.`)
    return resumo
  }

  // 2) Carregar empresa + escala
  const [{ data: emp }, { data: escala, error: errEsc }] = await Promise.all([
    supa.from('empresa_config').select('*').eq('id', 1).single(),
    supa.from('escala').select('*, promotoras(*)').eq('servico_id', servicoId),
  ])
  if (!emp) {
    resumo.erros.push('empresa_config não configurada — rode a migration e preencha os dados da empresa.')
    return resumo
  }
  if (errEsc) {
    resumo.erros.push(`Falha na escala: ${errEsc.message}`)
    return resumo
  }

  const empresa: DadosEmpresa = emp as DadosEmpresa
  const cliente: DadosCliente = srv.clientes as DadosCliente

  // Calcula datas de pagamento (forma de pagamento).
  // Se a data_emissao_nf não foi informada, assume = dia útil seguinte ao fim do serviço.
  const dataEmissaoNF = srv.data_emissao_nf || proximoDiaUtil(somarDias(srv.data_fim, 1))
  const prazoCliente = srv.prazo_pagamento_dias ?? 30
  const dataPagamentoCliente = calcularDataPagamentoCliente(dataEmissaoNF, prazoCliente)
  const dataPagamentoPromotora = calcularDataPagamentoPromotora(dataPagamentoCliente)
  console.log(`[contratos] NF=${dataEmissaoNF} prazo=${prazoCliente}d → cliente paga em ${dataPagamentoCliente} → promotora recebe em ${dataPagamentoPromotora}`)

  const dadosServico: DadosServico = {
    id: srv.id,
    nome: srv.nome,
    descricao: srv.descricao,
    data_inicio: srv.data_inicio,
    data_fim: srv.data_fim,
    horario_inicio: srv.horario_inicio,
    horario_fim: srv.horario_fim,
    local_completo: srv.local_completo || `${srv.endereco_rua || ''} ${srv.endereco_numero || ''}, ${srv.endereco_cidade || ''}`.trim(),
    qtd_dias: qtdDias,
    valor_diaria: srv.valor_diaria,
    valor_total_cliente: srv.valor_total_cliente,
    briefing: srv.briefing,
    tem_sinal: srv.tem_sinal ?? false,
    sinal_pct: srv.sinal_pct ?? 50,
    prazo_pagamento_dias: prazoCliente,
    data_emissao_nf: dataEmissaoNF,
    data_pagamento_cliente: dataPagamentoCliente,
    data_pagamento_promotora: dataPagamentoPromotora,
  }

  // 3) Contrato do CLIENTE
  await gerarSeNaoExiste(
    supa, 'cliente', servicoId, cliente.id, null,
    async () => {
      const numero = await proximoNumeroContrato(supa)
      const token = gerarTokenAceite()
      const qtdProm = (escala || []).length
      const valorTotal = srv.valor_total_cliente || 0
      const conteudo: ConteudoContratoCliente = {
        numero, empresa, cliente, servico: dadosServico,
        qtd_promotoras: qtdProm, valor_total: valorTotal,
        gerado_em: new Date().toISOString(),
      }
      const pdf = await gerarPdfCliente(conteudo)
      return { numero, token, conteudo, pdf, valor_total: valorTotal }
    },
    resumo, log,
  )

  // 🚫 OBS DESACOPLAMENTO (Fase 2B):
  // O contrato da PROMOTORA não é mais gerado aqui em lote.
  // O fluxo correto é: JFS envia PROPOSTA → promotora aceita → JFS confirma
  // → aí sim chama `gerarContratoDePromotora(servicoId, promotoraId)` abaixo.

  console.log(`[contratos] geração CLIENTE concluída — gerados=${resumo.gerados} pulados=${resumo.pulados} erros=${resumo.erros.length}`)
  return resumo
}

/**
 * Gera contrato de UMA promotora específica para o serviço.
 * Chamado depois que a proposta for ACEITA e a JFS confirmar.
 * Marca a proposta correspondente como 'gerou_contrato' + linka contrato_id.
 */
export async function gerarContratoDePromotora(
  servicoId: string,
  promotoraId: string,
): Promise<ResumoGeracao> {
  const resumo: ResumoGeracao = { gerados: 0, pulados: 0, erros: [], contratos_ids: [] }
  const log: string[] = []
  const supa = adminClient()

  console.log(`[contratos] gerar contrato individual — servico=${servicoId} promotora=${promotoraId}`)

  const { data: srv, error: errSrv } = await supa
    .from('servicos').select('*, clientes(*)').eq('id', servicoId).single()
  if (errSrv || !srv) { resumo.erros.push(`Serviço: ${errSrv?.message}`); return resumo }

  const qtdDias = calcDiasCorridos(srv.data_inicio, srv.data_fim)
  if (qtdDias < DURACAO_MINIMA_DIAS) {
    resumo.erros.push(`Serviço tem ${qtdDias} dias — abaixo do mínimo de ${DURACAO_MINIMA_DIAS}`)
    return resumo
  }

  const [{ data: emp }, { data: prom, error: errProm }] = await Promise.all([
    supa.from('empresa_config').select('*').eq('id', 1).single(),
    supa.from('promotoras').select('*').eq('id', promotoraId).single(),
  ])
  if (!emp) { resumo.erros.push('empresa_config não configurada'); return resumo }
  if (errProm || !prom) { resumo.erros.push(`Promotora: ${errProm?.message}`); return resumo }

  const dataEmissaoNF = srv.data_emissao_nf || proximoDiaUtil(somarDias(srv.data_fim, 1))
  const prazoCliente = srv.prazo_pagamento_dias ?? 30
  const dataPagamentoCliente = calcularDataPagamentoCliente(dataEmissaoNF, prazoCliente)
  const dataPagamentoPromotora = calcularDataPagamentoPromotora(dataPagamentoCliente)

  const dadosServico: DadosServico = {
    id: srv.id, nome: srv.nome, descricao: srv.descricao,
    data_inicio: srv.data_inicio, data_fim: srv.data_fim,
    horario_inicio: srv.horario_inicio, horario_fim: srv.horario_fim,
    local_completo: srv.local_completo || [srv.rua, srv.numero, srv.bairro, srv.cidade, srv.estado].filter(Boolean).join(', '),
    qtd_dias: qtdDias, valor_diaria: srv.valor_diaria, valor_total_cliente: srv.valor_total_cliente,
    briefing: srv.briefing,
    tem_sinal: srv.tem_sinal ?? false, sinal_pct: srv.sinal_pct ?? 50,
    prazo_pagamento_dias: prazoCliente, data_emissao_nf: dataEmissaoNF,
    data_pagamento_cliente: dataPagamentoCliente, data_pagamento_promotora: dataPagamentoPromotora,
  }

  await gerarSeNaoExiste(
    supa, 'promotora', servicoId, null, promotoraId,
    async () => {
      const numero = await proximoNumeroContrato(supa)
      const token = gerarTokenAceite()
      const diaria = srv.valor_diaria || 0
      const valorTotal = diaria * qtdDias
      const conteudo: ConteudoContratoPromotora = {
        numero, empresa: emp, promotora: prom, servico: dadosServico,
        cliente_nome: (srv.clientes as { nome_empresa?: string })?.nome_empresa || '—',
        valor_total_promotora: valorTotal,
        gerado_em: new Date().toISOString(),
      }
      const pdf = await gerarPdfPromotora(conteudo)
      return { numero, token, conteudo, pdf, valor_total: valorTotal, whatsapp: prom.whatsapp }
    },
    resumo, log,
  )

  // Linka contrato ↔ proposta e marca proposta como concluída
  if (resumo.gerados > 0 && resumo.contratos_ids.length > 0) {
    await supa.from('propostas')
      .update({ status: 'gerou_contrato', contrato_id: resumo.contratos_ids[0] })
      .eq('servico_id', servicoId).eq('promotora_id', promotoraId)
      .eq('status', 'aceita')
  }

  return resumo
}

async function gerarSeNaoExiste(
  supa: ReturnType<typeof adminClient>,
  tipo: 'cliente' | 'promotora',
  servicoId: string,
  clienteId: string | null,
  promotoraId: string | null,
  gerador: () => Promise<{
    numero: string; token: string;
    conteudo: ConteudoContratoCliente | ConteudoContratoPromotora;
    pdf: { storagePath: string; hash: string; signedUrl: string };
    valor_total: number;
    whatsapp?: string | null;
  }>,
  resumo: ResumoGeracao,
  log: string[],
) {
  // Já existe?
  const filtro = supa.from('contratos').select('id, status').eq('servico_id', servicoId).eq('tipo', tipo)
  if (clienteId) filtro.eq('cliente_id', clienteId)
  if (promotoraId) filtro.eq('promotora_id', promotoraId)
  const { data: existentes } = await filtro
  const ativo = existentes?.find(c => c.status !== 'cancelado')
  if (ativo) {
    console.log(`[contratos] já existe contrato ${tipo} (id=${ativo.id}) — pulando`)
    resumo.pulados++
    return
  }

  try {
    const g = await gerador()
    const conteudoServ = (g.conteudo as ConteudoContratoCliente | ConteudoContratoPromotora).servico
    const { data: inserido, error } = await supa.from('contratos').insert({
      numero: g.numero,
      tipo,
      servico_id: servicoId,
      cliente_id: clienteId,
      promotora_id: promotoraId,
      status: 'enviado',
      valor_total: g.valor_total,
      data_inicio_servico: conteudoServ.data_inicio,
      data_fim_servico: conteudoServ.data_fim,
      qtd_dias: conteudoServ.qtd_dias,
      conteudo_json: g.conteudo,
      template_versao: tipo === 'cliente' ? 'cliente-v1' : 'promotora-v1',
      pdf_path: g.pdf.storagePath,
      pdf_hash: g.pdf.hash,
      token_aceite: g.token,
      expira_em: new Date(Date.now() + EXPIRA_DIAS * 86400000).toISOString(),
      enviado_whatsapp_numero: g.whatsapp || null,
    }).select('id').single()

    if (error || !inserido) throw new Error(error?.message || 'insert sem retorno')

    resumo.gerados++
    resumo.contratos_ids.push(inserido.id)

    // Envio por WhatsApp da promotora (se aplicável)
    if (tipo === 'promotora' && g.whatsapp) {
      const baseUrl = process.env.APP_URL || ''
      const linkAceite = `${baseUrl}/contratos/aceite/${g.token}`
      const msg =
        `📄 *Contrato de serviço — ${g.numero}*\n\n` +
        `Olá! Como o serviço tem duração de ${conteudoServ.qtd_dias} dias, preparamos um contrato formal pra você.\n\n` +
        `👉 Leia e aceite por aqui (link válido por ${EXPIRA_DIAS} dias):\n${linkAceite}\n\n` +
        `Qualquer dúvida, é só responder esta mensagem. 💜`
      const r = await enviarWhatsApp(g.whatsapp, msg)
      if (r.ok) {
        await supa.from('contratos').update({ enviado_whatsapp_em: new Date().toISOString() }).eq('id', inserido.id)
        console.log(`[contratos] enviado WhatsApp → ${r.numero}`)
      } else {
        log.push(`Falha WhatsApp contrato ${g.numero}: ${r.erro}`)
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[contratos] erro ao gerar ${tipo}:`, msg)
    resumo.erros.push(`${tipo}: ${msg}`)
  }
}
