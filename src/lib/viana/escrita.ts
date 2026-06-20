/**
 * escrita.ts — Handlers de comandos de escrita (Bot Viana)
 *
 * Cada handler:
 *   1. Valida o valor informado
 *   2. Busca a próxima ocorrência do fornecedor na agenda
 *   3. Chama criarPendencia() → bot responde com pedido de confirmação
 *
 * Só é chamado após verificação de permissão em index.ts (isAdmin).
 */
import 'server-only'
import { criarPendencia } from './confirmacao'
import type { LinhaAgenda } from './tipos'

const STATUS_VALIDOS = ['COTACAO', 'COTAÇÃO', 'PEDIDO DIGITADO', 'PEDIDO PENDENTE', 'TERMO ESTOQUE']

function proximaOcorrencia(linhas: LinhaAgenda[], codigo: string): LinhaAgenda | null {
  const hoje = new Date().toISOString().slice(0, 10)
  return (
    linhas
      .filter((l) => {
        const cod  = String(l.cod ?? '').trim()
        const data = l.data ? new Date(l.data).toISOString().slice(0, 10) : ''
        return cod === codigo.trim() && data >= hoje
      })
      .sort((a, b) => {
        const da = a.data ? new Date(a.data).getTime() : Infinity
        const db = b.data ? new Date(b.data).getTime() : Infinity
        return da - db
      })[0] || null
  )
}

async function base(
  linhas: LinhaAgenda[],
  numero: string,
  nome: string,
  campo: string,
  codigo: string,
  valor: string,
): Promise<string> {
  const linha = proximaOcorrencia(linhas, codigo)
  if (!linha) {
    return `🔍 Fornecedor *${codigo}* não encontrado na agenda.\n\nVerifique o código e tente novamente.\n\n— Viana`
  }
  const desc      = (linha.descricao || '').trim() || '?'
  const dataAgenda = linha.data ? new Date(linha.data).toISOString().slice(0, 10) : null
  try {
    return await criarPendencia({ numero, nome, campo, codigoFornec: codigo, valorNovo: valor, dataAgenda, descricaoFornec: desc })
  } catch (e) {
    console.error('[viana] erro ao criar pendência:', e)
    return '⚠️ Erro ao processar. Tenta de novo em instantes.\n\n— Viana'
  }
}

export async function handlerSetStatus(
  linhas: LinhaAgenda[], numero: string, nome: string, codigo: string, valor: string
): Promise<string> {
  const v = valor.toUpperCase().trim()
  if (!STATUS_VALIDOS.includes(v)) {
    return (
      `❌ Status inválido: *${valor}*\n\nValores aceitos:\n` +
      STATUS_VALIDOS.map((s) => `• ${s}`).join('\n') +
      '\n\n— Viana'
    )
  }
  return base(linhas, numero, nome, 'status', codigo, v)
}

export async function handlerSetPrazo(
  linhas: LinhaAgenda[], numero: string, nome: string, codigo: string, valor: string
): Promise<string> {
  if (!/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(valor.trim())) {
    return `❌ Formato inválido: *${valor}*\n\nUse: *Bot prazo ${codigo} DD/MM*\nEx: *Bot prazo ${codigo} 25/06*\n\n— Viana`
  }
  return base(linhas, numero, nome, 'prazo', codigo, valor.trim())
}

export async function handlerSetFluxo(
  linhas: LinhaAgenda[], numero: string, nome: string, codigo: string, valor: string
): Promise<string> {
  return base(linhas, numero, nome, 'fluxo', codigo, valor.trim())
}

export async function handlerSetComprador(
  linhas: LinhaAgenda[], numero: string, nome: string, codigo: string, valor: string
): Promise<string> {
  return base(linhas, numero, nome, 'comprador', codigo, valor.trim())
}

export async function handlerSetPedido(
  linhas: LinhaAgenda[], numero: string, nome: string, codigo: string, valor: string
): Promise<string> {
  return base(linhas, numero, nome, 'pedido', codigo, valor.trim())
}
