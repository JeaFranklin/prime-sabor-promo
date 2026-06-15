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
  // Início da semana = segunda
  const hoje = new Date()
  const diaJS = hoje.getDay()
  const diaNosso = diaJS === 0 ? 6 : diaJS - 1
  const inicio = new Date(hoje)
  inicio.setDate(hoje.getDate() - diaNosso)
  const fim = new Date(inicio)
  fim.setDate(inicio.getDate() + 6)
  const inicioStr = inicio.toISOString().slice(0, 10)
  const fimStr = fim.toISOString().slice(0, 10)

  const semana = linhas.filter((l) => {
    if (!l.data) return false
    const dStr = new Date(l.data).toISOString().slice(0, 10)
    return dStr >= inicioStr && dStr <= fimStr
  })

  let txt = `📊 *RESUMO SEMANA ${inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${fim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}*\n\n`
  txt += `Total: *${semana.length}* fornecedor${semana.length === 1 ? '' : 'es'}\n\n`

  const porDia = new Map<string, number>()
  for (const l of semana) {
    const d = new Date(l.data!)
    const key = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    porDia.set(key, (porDia.get(key) || 0) + 1)
  }
  if (porDia.size > 0) {
    txt += '*Por dia:*\n'
    for (const [d, c] of porDia) txt += `  ${d}: ${c}\n`
  }

  const porStatus = new Map<string, number>()
  let pend = 0
  for (const l of semana) {
    const s = (l.status || '').trim()
    const c = (l.comprador || '').trim()
    if (!s && !c) {
      pend++
      continue
    }
    const key = s || '(sem status)'
    porStatus.set(key, (porStatus.get(key) || 0) + 1)
  }
  if (porStatus.size > 0 || pend > 0) {
    txt += '\n*Por status:*\n'
    for (const [s, c] of porStatus) txt += `  ${s}: ${c}\n`
    if (pend > 0) txt += `  🚨 *FALTA DIGITAR*: ${pend}\n`
  }

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
