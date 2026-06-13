/**
 * Tipos compartilhados pelo módulo de Relatórios.
 *
 * Cada tipo de relatório tem:
 *   - um "input" (filtros) — geralmente período [inicio, fim]
 *   - um "resultado" (output da agregação) — números pra cards + linhas pra tabela + séries pra gráfico
 */

export type PeriodoFiltro = {
  inicio: string  // ISO date (YYYY-MM-DD)
  fim: string     // ISO date (YYYY-MM-DD)
}

export type TipoRelatorio =
  | 'financeiro'
  | 'operacional'
  | 'promotoras'
  | 'clientes'
  | 'pendencias'

// ─────────────────────────────────────────────────────
// FINANCEIRO
// ─────────────────────────────────────────────────────
export type LinhaFinanceiro = {
  servico_id: string
  servico_nome: string
  cliente_nome: string
  data_inicio: string
  data_fim: string
  qtd_dias: number
  receita: number
  custo: number
  margem: number
  margem_pct: number
  status: string
}

export type SerieFinanceiro = {
  mes: string         // "2026-06"
  mes_label: string   // "Jun/26"
  receita: number
  custo: number
  margem: number
}

export type ResultadoFinanceiro = {
  cards: {
    receita_total: number
    custo_total: number
    margem_total: number
    margem_pct: number
    qtd_servicos: number
  }
  serie: SerieFinanceiro[]   // pro gráfico
  linhas: LinhaFinanceiro[]  // pra tabela
}

// ─────────────────────────────────────────────────────
// OPERACIONAL
// ─────────────────────────────────────────────────────
export type LinhaOperacional = {
  servico_id: string
  servico_nome: string
  cliente_nome: string
  data_inicio: string
  data_fim: string
  status: string
  num_promotoras: number
}

export type DistribuicaoStatus = {
  status: string
  status_label: string
  qtd: number
  cor: string  // hex
}

export type ResultadoOperacional = {
  cards: {
    total: number
    confirmado: number
    em_andamento: number
    concluido: number
    cancelado: number
  }
  distribuicao: DistribuicaoStatus[]
  linhas: LinhaOperacional[]
}

// ─────────────────────────────────────────────────────
// PROMOTORAS (Performance)
// ─────────────────────────────────────────────────────
export type LinhaPromotora = {
  promotora_id: string
  promotora_nome: string
  foto_url: string | null
  qtd_servicos: number
  total_recebido: number
  avaliacao_media: number | null
}

export type ResultadoPromotoras = {
  cards: {
    total_promotoras_ativas: number
    qtd_servicos_periodo: number
    total_pago: number
    avaliacao_media_geral: number
  }
  linhas: LinhaPromotora[]  // ordenadas por total_recebido desc
}

// ─────────────────────────────────────────────────────
// CLIENTES
// ─────────────────────────────────────────────────────
export type LinhaCliente = {
  cliente_id: string
  cliente_nome: string
  qtd_servicos: number
  faturamento: number
  ticket_medio: number
}

export type DistribuicaoTipoAcao = {
  tipo_acao: string
  qtd: number
  faturamento: number
}

export type ResultadoClientes = {
  cards: {
    qtd_clientes_ativos: number
    faturamento_total: number
    ticket_medio_geral: number
  }
  top_clientes: LinhaCliente[]       // top 10 por faturamento
  por_tipo_acao: DistribuicaoTipoAcao[]
}

// ─────────────────────────────────────────────────────
// PENDÊNCIAS
// ─────────────────────────────────────────────────────
export type LinhaPendencia = {
  servico_id: string
  servico_nome: string
  cliente_nome: string
  data_inicio: string
  data_fim: string
  problema: 'pagamento_pendente' | 'confirmacao_pendente'
  detalhe: string  // ex.: "3 promotoras sem confirmar" ou "R$ 1.500 em atraso há 12 dias"
  dias_atraso?: number
  valor?: number
}

export type ResultadoPendencias = {
  cards: {
    total_pendencias: number
    pagamentos_atrasados: number
    confirmacoes_pendentes: number
    valor_em_atraso: number
  }
  linhas: LinhaPendencia[]
}

// ─────────────────────────────────────────────────────
// Status do serviço — labels e cores
// ─────────────────────────────────────────────────────
export const STATUS_SERVICO_LABEL: Record<string, string> = {
  proposta: 'Proposta',
  negociacao: 'Em negociação',
  confirmado: 'Confirmado',
  briefing: 'Briefing',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  faturado: 'Faturado',
  pago: 'Pago',
  cancelado: 'Cancelado',
}

// Cores em hex pra Recharts (Tailwind classes não funcionam no SVG do Recharts)
export const STATUS_SERVICO_COR: Record<string, string> = {
  proposta: '#9ca3af',       // gray-400
  negociacao: '#facc15',     // yellow-400
  confirmado: '#3b82f6',     // blue-500
  briefing: '#a855f7',       // purple-500
  em_andamento: '#f97316',   // orange-500
  concluido: '#10b981',      // emerald-500
  faturado: '#14b8a6',       // teal-500
  pago: '#22c55e',           // green-500
  cancelado: '#ef4444',      // red-500
}
