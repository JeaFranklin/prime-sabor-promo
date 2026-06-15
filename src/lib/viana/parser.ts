/**
 * parser.ts — Keyword matcher PT-BR (Bot Viana)
 *
 * Detecta a intenção da mensagem usando regex + sinônimos. Sem IA externa
 * (sem custo recorrente — decisão estratégica de 15/06/2026).
 *
 * Entrada: texto bruto (ex.: "Bot quem vem amanhã?")
 * Saída: { intent: 'amanha' } | { intent: 'data', data } | ...
 */
import type { IntentParams } from './tipos'

const DIAS_SEMANA: Record<string, number> = {
  'segunda': 0, 'segunda-feira': 0,
  'terca': 1, 'terça': 1, 'terca-feira': 1, 'terça-feira': 1,
  'quarta': 2, 'quarta-feira': 2,
  'quinta': 3, 'quinta-feira': 3,
  'sexta': 4, 'sexta-feira': 4,
  'sabado': 5, 'sábado': 5,
  'domingo': 6,
}

export function detectarIntencao(textoOriginal: string): IntentParams {
  let msg = textoOriginal.toLowerCase().trim()
  // Remove o prefixo "bot" (acionador)
  msg = msg.replace(/^bot\b\s*/, '').trim()

  if (!msg || /\bajuda\b|\bhelp\b|\bcomando/.test(msg) || msg === '?') {
    return { intent: 'ajuda' }
  }
  if (/\bhoje\b|\bdo dia\b|\bagora\b/.test(msg)) {
    return { intent: 'hoje' }
  }
  if (/\bamanh[aã]\b/.test(msg)) {
    return { intent: 'amanha' }
  }
  if (/\bpendent|\bfalta(ndo)?\b|\bdigit(ar|ando)?\b|\bvazi[oa]\b/.test(msg)) {
    return { intent: 'pendentes' }
  }
  if (/\bsemana\b|\bsemanal\b|\bresumo\b/.test(msg)) {
    return { intent: 'semana' }
  }

  // Data DD/MM ou DD/MM/AAAA
  const m = msg.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (m) {
    const d = parseInt(m[1], 10)
    const mm = parseInt(m[2], 10)
    let a = m[3] ? parseInt(m[3], 10) : new Date().getFullYear()
    if (a < 100) a += 2000
    const data = new Date(a, mm - 1, d)
    if (!isNaN(data.getTime()) && data.getMonth() === mm - 1) {
      return { intent: 'data', data }
    }
  }

  // Dia da semana (próxima ocorrência)
  for (const [nome, idx] of Object.entries(DIAS_SEMANA)) {
    const regex = new RegExp(`\\b${nome}\\b`)
    if (regex.test(msg)) {
      return { intent: 'dia_semana', dia: idx }
    }
  }

  // Resto = busca por fornecedor (texto livre)
  // Remove palavras comuns que não fazem parte do nome
  const query = msg
    .replace(/\b(fornecedor(es)?|cnpj|c[oó]digo|cod|pra|do|da|o|a|de|me|liste|mostra|manda)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (query.length >= 2) {
    return { intent: 'fornecedor', query }
  }

  return { intent: 'desconhecido' }
}
