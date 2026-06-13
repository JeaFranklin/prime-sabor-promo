/**
 * Funções de agregação puras (JS, sem rede).
 *
 * Recebem dados crus do Supabase e devolvem os resultados tipados em `tipos.ts`.
 * Fica fácil testar e dá pra reusar entre tela (cliente) e PDF (servidor).
 */
import { calcDiasCorridos } from '@/lib/contratos/formatar'
import type {
  PeriodoFiltro,
  LinhaFinanceiro,
  SerieFinanceiro,
  ResultadoFinanceiro,
  LinhaOperacional,
  DistribuicaoStatus,
  ResultadoOperacional,
  LinhaPromotora,
  ResultadoPromotoras,
  LinhaCliente,
  DistribuicaoTipoAcao,
  ResultadoClientes,
  LinhaPendencia,
  ResultadoPendencias,
} from './tipos'
import { STATUS_SERVICO_LABEL, STATUS_SERVICO_COR } from './tipos'

// ─────────────────────────────────────────────────────
// Helpers genéricos
// ─────────────────────────────────────────────────────

/** Período padrão: últimos 30 dias até hoje (ISO YYYY-MM-DD). */
export function periodoPadrao(): PeriodoFiltro {
  const hoje = new Date()
  const trintaAtras = new Date(hoje.getTime() - 30 * 86_400_000)
  return {
    inicio: trintaAtras.toISOString().slice(0, 10),
    fim: hoje.toISOString().slice(0, 10),
  }
}

function mesISO(iso: string): string {
  return iso.slice(0, 7)  // "2026-06"
}

function mesLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-')
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${meses[Number(m) - 1]}/${y.slice(2)}`
}

// ─────────────────────────────────────────────────────
// Tipos crus que vêm do Supabase (relaxados)
// ─────────────────────────────────────────────────────
type ServicoCru = {
  id: string
  nome: string | null
  status: string | null
  data_inicio: string | null
  data_fim: string | null
  valor_cliente: number | null
  valor_total_cliente: number | null
  valor_diaria: number | null
  num_promotoras: number | null
  tipo_acao: string | null
  cliente_id: string | null
  clientes?: { id: string; nome_empresa: string | null } | null
  escala?: Array<{ valor_diaria: number | null; promotora_id: string | null; status_pagamento?: string | null; status_confirmacao?: string | null }> | null
}

// ─────────────────────────────────────────────────────
// FINANCEIRO
// ─────────────────────────────────────────────────────
export function agregarFinanceiro(servicos: ServicoCru[]): ResultadoFinanceiro {
  const linhas: LinhaFinanceiro[] = servicos.map(s => {
    const qtdDias = s.data_inicio && s.data_fim
      ? calcDiasCorridos(s.data_inicio, s.data_fim)
      : 1
    const receita = s.valor_total_cliente ?? s.valor_cliente ?? 0
    const custo = (s.escala ?? []).reduce((sum, e) =>
      sum + (e.valor_diaria ?? s.valor_diaria ?? 0) * qtdDias, 0)
    const margem = receita - custo
    return {
      servico_id: s.id,
      servico_nome: s.nome ?? 'Sem nome',
      cliente_nome: s.clientes?.nome_empresa ?? '—',
      data_inicio: s.data_inicio ?? '',
      data_fim: s.data_fim ?? '',
      qtd_dias: qtdDias,
      receita,
      custo,
      margem,
      margem_pct: receita > 0 ? (margem / receita) * 100 : 0,
      status: s.status ?? 'proposta',
    }
  })

  // Série temporal por mês
  const porMes = new Map<string, SerieFinanceiro>()
  linhas.forEach(l => {
    if (!l.data_inicio) return
    const mes = mesISO(l.data_inicio)
    const atual = porMes.get(mes) ?? { mes, mes_label: mesLabel(mes), receita: 0, custo: 0, margem: 0 }
    atual.receita += l.receita
    atual.custo += l.custo
    atual.margem += l.margem
    porMes.set(mes, atual)
  })
  const serie = Array.from(porMes.values()).sort((a, b) => a.mes.localeCompare(b.mes))

  const receitaTotal = linhas.reduce((s, l) => s + l.receita, 0)
  const custoTotal = linhas.reduce((s, l) => s + l.custo, 0)
  const margemTotal = receitaTotal - custoTotal

  return {
    cards: {
      receita_total: receitaTotal,
      custo_total: custoTotal,
      margem_total: margemTotal,
      margem_pct: receitaTotal > 0 ? (margemTotal / receitaTotal) * 100 : 0,
      qtd_servicos: linhas.length,
    },
    serie,
    linhas: linhas.sort((a, b) => (b.data_inicio ?? '').localeCompare(a.data_inicio ?? '')),
  }
}

// ─────────────────────────────────────────────────────
// OPERACIONAL
// ─────────────────────────────────────────────────────
export function agregarOperacional(servicos: ServicoCru[]): ResultadoOperacional {
  const linhas: LinhaOperacional[] = servicos.map(s => ({
    servico_id: s.id,
    servico_nome: s.nome ?? 'Sem nome',
    cliente_nome: s.clientes?.nome_empresa ?? '—',
    data_inicio: s.data_inicio ?? '',
    data_fim: s.data_fim ?? '',
    status: s.status ?? 'proposta',
    num_promotoras: s.num_promotoras ?? 0,
  }))

  // Distribuição por status
  const contagem = new Map<string, number>()
  linhas.forEach(l => contagem.set(l.status, (contagem.get(l.status) ?? 0) + 1))
  const distribuicao: DistribuicaoStatus[] = Array.from(contagem.entries())
    .map(([status, qtd]) => ({
      status,
      status_label: STATUS_SERVICO_LABEL[status] ?? status,
      qtd,
      cor: STATUS_SERVICO_COR[status] ?? '#9ca3af',
    }))
    .sort((a, b) => b.qtd - a.qtd)

  return {
    cards: {
      total: linhas.length,
      confirmado: contagem.get('confirmado') ?? 0,
      em_andamento: contagem.get('em_andamento') ?? 0,
      concluido: (contagem.get('concluido') ?? 0) + (contagem.get('faturado') ?? 0) + (contagem.get('pago') ?? 0),
      cancelado: contagem.get('cancelado') ?? 0,
    },
    distribuicao,
    linhas: linhas.sort((a, b) => (b.data_inicio ?? '').localeCompare(a.data_inicio ?? '')),
  }
}

// ─────────────────────────────────────────────────────
// PROMOTORAS (Performance)
// ─────────────────────────────────────────────────────
type EscalaPerformance = {
  promotora_id: string | null
  valor_diaria: number | null
  servico: {
    id: string
    data_inicio: string | null
    data_fim: string | null
    valor_diaria: number | null
  } | null
  promotora: {
    id: string
    nome: string | null
    status: string | null
    foto_url: string | null
    avaliacao_media: number | null
  } | null
}

export function agregarPromotoras(
  escala: EscalaPerformance[],
  totalAtivas: number,
): ResultadoPromotoras {
  const porPromotora = new Map<string, LinhaPromotora>()

  escala.forEach(e => {
    if (!e.promotora_id || !e.promotora) return
    const qtdDias = e.servico?.data_inicio && e.servico?.data_fim
      ? calcDiasCorridos(e.servico.data_inicio, e.servico.data_fim)
      : 1
    const valor = (e.valor_diaria ?? e.servico?.valor_diaria ?? 0) * qtdDias

    const atual = porPromotora.get(e.promotora_id) ?? {
      promotora_id: e.promotora_id,
      promotora_nome: e.promotora.nome ?? 'Sem nome',
      foto_url: e.promotora.foto_url,
      qtd_servicos: 0,
      total_recebido: 0,
      avaliacao_media: e.promotora.avaliacao_media,
    }
    atual.qtd_servicos += 1
    atual.total_recebido += valor
    porPromotora.set(e.promotora_id, atual)
  })

  const linhas = Array.from(porPromotora.values())
    .sort((a, b) => b.total_recebido - a.total_recebido)

  const totalPago = linhas.reduce((s, l) => s + l.total_recebido, 0)
  const avaliacoesValidas = linhas.filter(l => l.avaliacao_media != null && l.avaliacao_media > 0)
  const avaliacaoMediaGeral = avaliacoesValidas.length > 0
    ? avaliacoesValidas.reduce((s, l) => s + (l.avaliacao_media ?? 0), 0) / avaliacoesValidas.length
    : 0

  return {
    cards: {
      total_promotoras_ativas: totalAtivas,
      qtd_servicos_periodo: escala.length,
      total_pago: totalPago,
      avaliacao_media_geral: avaliacaoMediaGeral,
    },
    linhas,
  }
}

// ─────────────────────────────────────────────────────
// CLIENTES
// ─────────────────────────────────────────────────────
export function agregarClientes(servicos: ServicoCru[]): ResultadoClientes {
  const porCliente = new Map<string, LinhaCliente>()
  const porTipo = new Map<string, DistribuicaoTipoAcao>()

  servicos.forEach(s => {
    const receita = s.valor_total_cliente ?? s.valor_cliente ?? 0
    const clienteId = s.cliente_id ?? '__sem_cliente__'
    const clienteNome = s.clientes?.nome_empresa ?? 'Sem cliente'

    const atual = porCliente.get(clienteId) ?? {
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      qtd_servicos: 0,
      faturamento: 0,
      ticket_medio: 0,
    }
    atual.qtd_servicos += 1
    atual.faturamento += receita
    porCliente.set(clienteId, atual)

    // por tipo_acao
    const tipo = s.tipo_acao ?? 'outro'
    const tipoAtual = porTipo.get(tipo) ?? { tipo_acao: tipo, qtd: 0, faturamento: 0 }
    tipoAtual.qtd += 1
    tipoAtual.faturamento += receita
    porTipo.set(tipo, tipoAtual)
  })

  // Calcula ticket médio
  porCliente.forEach(c => {
    c.ticket_medio = c.qtd_servicos > 0 ? c.faturamento / c.qtd_servicos : 0
  })

  const top10 = Array.from(porCliente.values())
    .sort((a, b) => b.faturamento - a.faturamento)
    .slice(0, 10)

  const porTipoArr = Array.from(porTipo.values())
    .sort((a, b) => b.faturamento - a.faturamento)

  const faturamentoTotal = servicos.reduce((s, x) =>
    s + (x.valor_total_cliente ?? x.valor_cliente ?? 0), 0)

  return {
    cards: {
      qtd_clientes_ativos: porCliente.size,
      faturamento_total: faturamentoTotal,
      ticket_medio_geral: servicos.length > 0 ? faturamentoTotal / servicos.length : 0,
    },
    top_clientes: top10,
    por_tipo_acao: porTipoArr,
  }
}

// ─────────────────────────────────────────────────────
// PENDÊNCIAS
// ─────────────────────────────────────────────────────
type EscalaPendencia = {
  id: string
  servico_id: string
  promotora_id: string | null
  valor_diaria: number | null
  status_confirmacao: string | null
  status_pagamento: string | null
  servico: {
    id: string
    nome: string | null
    data_inicio: string | null
    data_fim: string | null
    valor_diaria: number | null
    data_emissao_nf?: string | null
    prazo_pagamento_dias?: number | null
    clientes?: { nome_empresa: string | null } | null
  } | null
}

export function agregarPendencias(escala: EscalaPendencia[]): ResultadoPendencias {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  // Agrupa por serviço
  const porServico = new Map<string, EscalaPendencia[]>()
  escala.forEach(e => {
    const lista = porServico.get(e.servico_id) ?? []
    lista.push(e)
    porServico.set(e.servico_id, lista)
  })

  const linhas: LinhaPendencia[] = []
  let valorEmAtraso = 0
  let qtdPagAtrasados = 0
  let qtdConfirmacoesPendentes = 0

  porServico.forEach((escalas, servicoId) => {
    const s = escalas[0].servico
    if (!s) return

    // 1) Confirmações pendentes
    const pendConf = escalas.filter(e => e.status_confirmacao === 'pendente')
    if (pendConf.length > 0) {
      qtdConfirmacoesPendentes += pendConf.length
      linhas.push({
        servico_id: servicoId,
        servico_nome: s.nome ?? 'Sem nome',
        cliente_nome: s.clientes?.nome_empresa ?? '—',
        data_inicio: s.data_inicio ?? '',
        data_fim: s.data_fim ?? '',
        problema: 'confirmacao_pendente',
        detalhe: `${pendConf.length} promotora(s) sem confirmar`,
      })
    }

    // 2) Pagamentos pendentes — em atraso se data_fim do serviço já passou
    const pendPag = escalas.filter(e => e.status_pagamento === 'pendente')
    if (pendPag.length > 0 && s.data_fim) {
      const dataFim = new Date(s.data_fim + 'T00:00:00')
      if (dataFim < hoje) {
        const qtdDias = s.data_inicio && s.data_fim ? calcDiasCorridos(s.data_inicio, s.data_fim) : 1
        const valor = pendPag.reduce((sum, e) =>
          sum + (e.valor_diaria ?? s.valor_diaria ?? 0) * qtdDias, 0)
        const diasAtraso = Math.floor((hoje.getTime() - dataFim.getTime()) / 86_400_000)
        qtdPagAtrasados += pendPag.length
        valorEmAtraso += valor
        linhas.push({
          servico_id: servicoId,
          servico_nome: s.nome ?? 'Sem nome',
          cliente_nome: s.clientes?.nome_empresa ?? '—',
          data_inicio: s.data_inicio ?? '',
          data_fim: s.data_fim ?? '',
          problema: 'pagamento_pendente',
          detalhe: `${pendPag.length} pgto(s) em atraso há ${diasAtraso}d`,
          dias_atraso: diasAtraso,
          valor,
        })
      }
    }
  })

  // Ordena: pagamentos atrasados primeiro (por dias_atraso desc), depois confirmações
  linhas.sort((a, b) => {
    if (a.problema !== b.problema) {
      return a.problema === 'pagamento_pendente' ? -1 : 1
    }
    return (b.dias_atraso ?? 0) - (a.dias_atraso ?? 0)
  })

  return {
    cards: {
      total_pendencias: linhas.length,
      pagamentos_atrasados: qtdPagAtrasados,
      confirmacoes_pendentes: qtdConfirmacoesPendentes,
      valor_em_atraso: valorEmAtraso,
    },
    linhas,
  }
}
