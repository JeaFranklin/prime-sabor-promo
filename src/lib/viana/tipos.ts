/**
 * tipos.ts — Tipos compartilhados do Bot Viana
 * Cliente: Viana Supermercado (não confundir com Prime Sabor Promo).
 */

export type LinhaAgenda = {
  mes: string | null
  data: string | null         // ISO string (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss)
  diaSemana: string | null
  cod: string | number | null
  descricao: string | null
  secao: string | null
  fluxo: string | null
  prazo: string | null
  status: string | null
  comprador: string | null
  pedido: string | null
}

export type AgendaJson = {
  gerada_em: string           // ISO timestamp do upload pelo cron na VPS
  total_linhas: number
  linhas: LinhaAgenda[]
}

export type IntentParams =
  | { intent: 'hoje' }
  | { intent: 'amanha' }
  | { intent: 'data'; data: Date }
  | { intent: 'dia_semana'; dia: number }   // 0=segunda ... 6=domingo
  | { intent: 'pendentes' }
  | { intent: 'semana' }
  | { intent: 'fornecedor'; query: string }
  | { intent: 'ajuda' }
  | { intent: 'desconhecido' }
  // Comandos de escrita (somente admins)
  | { intent: 'set_status';    codigo: string; valor: string }
  | { intent: 'set_prazo';     codigo: string; valor: string }
  | { intent: 'set_fluxo';     codigo: string; valor: string }
  | { intent: 'set_comprador'; codigo: string; valor: string }
  | { intent: 'set_pedido';    codigo: string; valor: string }

export type BotContext = {
  numero: string
  nome: string
  texto: string
}
