/**
 * index.ts — Entrypoint do Bot Viana
 *
 * Cliente: Viana Supermercado (consultoria NERESCO).
 * Hospedado dentro do prime-sabor-promo por compartilhamento de infra
 * (Next.js + Vercel + Supabase). NÃO confundir com Prime Sabor Promo:
 * todas as tabelas do Viana têm prefixo `viana_` e todo código vive
 * dentro deste submódulo `src/lib/viana/`.
 *
 * Ver: src/lib/viana/README.md e diretriz [[feedback-isolar-clientes]].
 */
import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarWhatsApp } from '@/lib/whatsapp'
import { detectarIntencao } from './parser'
import { carregarAgenda } from './agenda'
import {
  handlerHoje,
  handlerAmanha,
  handlerData,
  handlerDiaSemana,
  handlerPendentes,
  handlerSemana,
  handlerFornecedor,
  handlerAjuda,
  handlerDesconhecido,
} from './handlers'
import type { BotContext } from './tipos'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/**
 * Verifica se uma mensagem deve ser tratada pelo Bot Viana.
 *
 * Critérios (ambos têm que bater):
 *   1. número está na whitelist VIANA_NUMEROS_AUTORIZADOS (env var)
 *   2. texto começa com "Bot" (case-insensitive)
 *
 * Espelha a tabela `viana_usuarios_autorizados` em env var pra evitar query
 * ao banco a cada webhook (otimização). Tabela é a fonte de verdade pra UI.
 */
export function isVianaBotMessage(numero: string | null, texto: string): boolean {
  if (!numero) return false
  const whitelist = (process.env.VIANA_NUMEROS_AUTORIZADOS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (whitelist.length === 0 || !whitelist.includes(numero)) return false
  return /^bot\b/i.test(texto.trim())
}

/**
 * Processa uma mensagem do Bot Viana:
 *   1. detecta intent via regex PT-BR
 *   2. carrega agenda do Supabase Storage (cache 60s)
 *   3. roteia pro handler correspondente
 *   4. envia resposta via Evolution
 *   5. registra interação em viana_interacoes (fire-and-forget)
 */
export async function handleVianaBot(ctx: BotContext): Promise<NextResponse> {
  const inicio = Date.now()
  const { numero, nome, texto } = ctx
  const params = detectarIntencao(texto)
  let resposta = ''
  let erro: string | undefined

  try {
    const agenda = await carregarAgenda()
    if (!agenda) {
      resposta = '⚠️ Erro ao carregar a agenda. Tenta de novo em 1 minuto.\n\n— Viana'
    } else {
      const linhas = agenda.linhas
      switch (params.intent) {
        case 'hoje':       resposta = handlerHoje(linhas); break
        case 'amanha':     resposta = handlerAmanha(linhas); break
        case 'data':       resposta = handlerData(linhas, params.data); break
        case 'dia_semana': resposta = handlerDiaSemana(linhas, params.dia); break
        case 'pendentes':  resposta = handlerPendentes(linhas); break
        case 'semana':     resposta = handlerSemana(linhas); break
        case 'fornecedor': resposta = handlerFornecedor(linhas, params.query); break
        case 'ajuda':      resposta = handlerAjuda(); break
        default:           resposta = handlerDesconhecido(); break
      }
    }
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e)
    console.error(`[viana] erro no handler: ${erro}`)
    resposta = '⚠️ Erro interno. Avisa o Jeã.\n\n— Viana'
  }

  // Envia resposta via Evolution (não bloqueia em caso de erro)
  await enviarWhatsApp(numero, resposta).catch((e) =>
    console.error('[viana] envio falhou:', e)
  )

  // Log de auditoria (fire-and-forget — não esperamos resposta)
  const duracao = Date.now() - inicio
  adminClient()
    .from('viana_interacoes')
    .insert({
      numero_whatsapp: numero,
      nome_remetente: nome,
      pergunta: texto.slice(0, 500),
      intent: params.intent,
      resposta_resumo: resposta.slice(0, 300),
      duracao_ms: duracao,
      erro: erro || null,
    })
    .then(({ error }) => {
      if (error) console.error('[viana] falha log interação:', error.message)
    })

  return NextResponse.json({ ok: true, intent: params.intent, viana: true })
}
