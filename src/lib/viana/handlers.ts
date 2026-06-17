/**
 * handlers.ts — Handlers de cada intent do Bot Viana
 *
 * Formatam resposta como texto WhatsApp (com *negrito*, emojis e quebras).
 * Cada função recebe `linhas` (a lista da agenda) e devolve string.
 */
import type { LinhaAgenda } from './tipos'
import { mesmaData } from './agenda'

const STATUS_EMOJI: Record<string, string> = {
  'COTAÇÃO': '🟢',
  'COTACAO': '🟢',
  'PEDIDO DIGITADO': '🔵',
  'PEDIDO PENDENTE': '🟡',
  'TERMO ESTOQUE': '🔴',
}

function fmtLinha(l: LinhaAgenda): string {
  const cod = l.cod ?? '?'
  const desc = (l.descricao || '').trim() || 'Sem descrição'
  const status = (l.status || '').trim()
  const comprador = (l.comprador || '').trim()
  const emoji = STATUS_EMOJI[status.toUpperCase()] || '⚪'
  let txt = `${emoji} *${cod}* — ${desc}`
  if (status) txt += `\n    status: ${status}`
  if (comprador) txt += `\n    comprador: ${comprador}`
  return txt
}

function fmtDataBR(alvo: Date): string {
  return alvo.toLocaleDateString('pt-BR')
}

export function handlerData(linhas: LinhaAgenda[], alvo: Date, titulo = 'AGENDA'): string {
  const matches = linhas.filter((l) => mesmaData(l.data, alvo))
  const diaStr = fmtDataBR(alvo)
  if (matches.length === 0) {
    return `📋 *${titulo} ${diaStr}*\n\nNenhum fornecedor agendado. 🎉\n\n— Viana`
  }
  const plural = matches.length > 1 ? 'fornecedores' : 'fornecedor'
  return `📋 *${titulo} ${diaStr}* (${matches.length} ${plural})\n\n${matches.map(fmtLinha).join('\n\n')}\n\n— Viana`
}

export function handlerHoje(linhas: LinhaAgenda[]): string {
  return handlerData(linhas, new Date(), 'HOJE')
}

export function handlerAmanha(linhas: LinhaAgenda[]): string {
  const amanha = new Date()
  amanha.setDate(amanha.getDate() + 1)
  return handlerData(linhas, amanha, 'AMANHÃ')
}

export function handlerDiaSemana(linhas: LinhaAgenda[], diaIdx: number): string {
  // Convenção interna: 0=segunda ... 6=domingo (não confunde com getDay() do JS: 0=domingo).
  const hoje = new Date()
  const diaHojeJS = hoje.getDay()              // 0=domingo..6=sábado
  const diaHojeNosso = diaHojeJS === 0 ? 6 : diaHojeJS - 1  // 0=seg..6=dom
  const daysAhead = (diaIdx - diaHojeNosso + 7) % 7
  const alvo = new Date(hoje)
  if (daysAhead > 0) alvo.setDate(hoje.getDate() + daysAhead)
  const nomes = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO']
  return handlerData(linhas, alvo, nomes[diaIdx])
}

export function handlerPendentes(linhas: LinhaAgenda[]): string {
  // I (status) E J (comprador) AMBAS vazias = FALTA DIGITAR (alerta máximo)
  const hoje = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)
  const fim = new Date(hoje)
  fim.setDate(hoje.getDate() + 7)
  const fimStr = fim.toISOString().slice(0, 10)

  const matches = linhas.filter((l) => {
    if (!l.data) return false
    const dStr = new Date(l.data).toISOString().slice(0, 10)
    if (dStr < hojeStr || dStr > fimStr) return false
    const semStatus = !(l.status || '').trim()
    const semComp = !(l.comprador || '').trim()
    return semStatus && semComp
  })

  if (matches.length === 0) {
    return '✅ *PENDENTES*\n\nNenhum fornecedor sem responsabilidade nos próximos 7 dias. 🎉\n\n— Viana'
  }

  const grupos = new Map<string, LinhaAgenda[]>()
  for (const l of matches) {
    const d = new Date(l.data!)
    const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(l)
  }

  const plural = matches.length > 1 ? 'fornecedores' : 'fornecedor'
  let txt = `🚨 *FALTA DIGITAR* — ${matches.length} ${plural} nos próximos 7 dias:\n\n`
  for (const [data, ls] of grupos) {
    txt += `*${data}* — ${ls.length}\n`
    for (const l of ls) {
      const cod = l.cod ?? '?'
      const desc = (l.descricao || '').trim() || 'Sem descrição'
      txt += `  • ${cod} — ${desc}\n`
    }
    txt += '\n'
  }
  txt += '— Viana'
  return txt
}

export function handlerSemana(linhas: LinhaAgenda[]): string {
  // Mostra só os dias já passados da semana (seg até hoje) — formato tabela
  const hoje = new Date()
  const diaJS = hoje.getDay()
  const diaNosso = diaJS === 0 ? 6 : diaJS - 1  // 0=seg..6=dom

  const inicioSemana = new Date(hoje)
  inicioSemana.setDate(hoje.getDate() - diaNosso)

  const NOMES = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM']

  type Row = { label: string; total: number; cot: number; dig: number; pend: number }
  const rows: Row[] = []
  let totTotal = 0, totCot = 0, totDig = 0, totPend = 0

  for (let i = 0; i <= diaNosso; i++) {
    const d = new Date(inicioSemana)
    d.setDate(inicioSemana.getDate() + i)
    const dStr = d.toISOString().slice(0, 10)
    const dataFmt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

    const dodia = linhas.filter((l) => l.data && new Date(l.data).toISOString().slice(0, 10) === dStr)
    let cot = 0, dig = 0, pend = 0
    for (const l of dodia) {
      const st = (l.status || '').trim().toUpperCase()
      const comp = (l.comprador || '').trim()
      if (!st && !comp) pend++
      else if (st.includes('COTAÇÃO') || st.includes('COTACAO')) cot++
      else dig++
    }
    rows.push({ label: `${NOMES[i]} ${dataFmt}`, total: dodia.length, cot, dig, pend })
    totTotal += dodia.length; totCot += cot; totDig += dig; totPend += pend
  }

  if (rows.length === 0) {
    return '📊 *SEMANA ATÉ HOJE*\n\nNenhum dado disponível.\n\n— Viana'
  }

  const sep = '─────────────────────────────'
  let txt = '📊 *SEMANA ATÉ HOJE*\n\n'
  txt += '```\n'
  txt += 'Dia        |Tot| CO| DI| PE\n'
  txt += sep + '\n'
  for (const r of rows) {
    txt += `${r.label.padEnd(10)} |${String(r.total).padStart(3)}|${String(r.cot).padStart(3)}|${String(r.dig).padStart(3)}|${String(r.pend).padStart(3)}\n`
  }
  txt += sep + '\n'
  txt += `${'TOTAL'.padEnd(10)} |${String(totTotal).padStart(3)}|${String(totCot).padStart(3)}|${String(totDig).padStart(3)}|${String(totPend).padStart(3)}\n`
  txt += '```\n'
  txt += 'CO=Cotação  DI=Digitado  PE=Pendente\n'
  txt += '\n— Viana'
  return txt
}

export function handlerFornecedor(linhas: LinhaAgenda[], query: string): string {
  const q = query.toLowerCase().trim()
  const hojeStr = new Date().toISOString().slice(0, 10)

  const matches = linhas
    .filter((l) => {
      if (l.data) {
        const dStr = new Date(l.data).toISOString().slice(0, 10)
        if (!isNaN(new Date(l.data).getTime()) && dStr < hojeStr) return false
      }
      const desc = (l.descricao || '').toLowerCase()
      const cod = (l.cod?.toString() || '').toLowerCase()
      return desc.includes(q) || cod.includes(q)
    })
    .sort((a, b) => {
      const da = a.data ? new Date(a.data).getTime() : Infinity
      const db = b.data ? new Date(b.data).getTime() : Infinity
      return da - db
    })
    .slice(0, 10)

  if (matches.length === 0) {
    return `🔍 *BUSCA: "${query}"*\n\nNenhum fornecedor encontrado nos próximos atendimentos.\n\n— Viana`
  }

  const plural = matches.length > 1 ? 'resultados' : 'resultado'
  let txt = `🔍 *BUSCA: "${query}"* — ${matches.length} ${plural}\n\n`
  for (const l of matches) {
    const dataStr = l.data
      ? new Date(l.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      : '?'
    const cod = l.cod ?? '?'
    const desc = (l.descricao || '').trim()
    const status = (l.status || '').trim()
    const comprador = (l.comprador || '').trim()
    txt += `📅 *${dataStr}* — ${cod}\n   ${desc}\n`
    if (status) txt += `   status: ${status}\n`
    if (comprador) txt += `   comprador: ${comprador}\n`
    txt += '\n'
  }
  txt += '— Viana'
  return txt
}

export function handlerAjuda(): string {
  return (
    '🤖 *VIANA — Comandos disponíveis*\n\n' +
    'Sempre comece com a palavra *Bot*:\n\n' +
    '📅 *Bot hoje* — agenda de hoje\n' +
    '📅 *Bot amanhã* — agenda de amanhã\n' +
    '📅 *Bot quinta* (ou outro dia) — próxima ocorrência\n' +
    '📅 *Bot 20/06* — data específica\n' +
    '🚨 *Bot pendentes* — quem está faltando digitar\n' +
    '📊 *Bot semana* — resumo da semana\n' +
    '🔍 *Bot coca* — busca fornecedor pelo nome\n' +
    '🔍 *Bot 1234* — busca por código\n' +
    '❓ *Bot ajuda* — esta lista\n\n' +
    '— Viana'
  )
}

export function handlerDesconhecido(): string {
  return '🤔 Não entendi a pergunta.\n\nDigite *Bot ajuda* pra ver os comandos.\n\n— Viana'
}
