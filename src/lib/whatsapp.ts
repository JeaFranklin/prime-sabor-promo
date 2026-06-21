/**
 * whatsapp.ts — Envio de mensagens via Evolution API (WhatsApp do GustPro)
 *
 * ⚠️ ARQUIVO SERVER-SIDE. Nunca importe isto em componentes 'use client' —
 * ele usa a apikey secreta (EVOLUTION_API_KEY), que NÃO pode ir pro navegador.
 * Use-o apenas dentro de rotas /api (route handlers) ou Server Actions.
 *
 * Provedor: Evolution API v1.8.7 (auto-hospedada na VPS).
 * Endpoint de envio (v1): POST {URL}/message/sendText/{instancia}
 *   body: { number, options:{delay,presence}, textMessage:{ text } }
 *   header: apikey
 */

const API_URL = process.env.EVOLUTION_API_URL // ex.: http://2.25.202.44:8080
const API_KEY = process.env.EVOLUTION_API_KEY // chave secreta (apikey)
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'gustpro'

// Trava anti-spam: espaço mínimo (ms) entre envios consecutivos. Sem isso, um
// disparo em massa (ex.: lembrete pra várias promotoras) é barrado pelo
// anti-spam do WhatsApp e só as primeiras chegam. (Lição do projeto Salescope.)
const MIN_GAP_MS = 3500
let ultimoEnvio = 0

/**
 * Normaliza um telefone para o formato que a Evolution espera:
 * só dígitos, com DDI do Brasil (55) na frente. Sem +, espaços ou traços.
 * Ex.: "(63) 99225-3618" -> "5563992253618"
 */
export function normalizarNumero(raw: string | null | undefined): string | null {
  if (!raw) return null
  // JID @lid: Evolution v1.8.7 não envia pra @lid diretamente.
  // Resolve via VIANA_LID_MAP (env var com formato "lidId:telefone,lidId2:telefone2").
  if (raw.endsWith('@lid')) {
    const lidId = raw.replace(/@lid$/, '')
    const mapa: Record<string, string> = {}
    for (const par of (process.env.VIANA_LID_MAP || '').split(',')) {
      const [lid, num] = par.split(':')
      if (lid && num) mapa[lid.trim()] = num.trim()
    }
    const telefone = mapa[lidId]
    if (!telefone) {
      console.warn(`[whatsapp] @lid sem mapeamento em VIANA_LID_MAP: "${lidId}" — configure VIANA_LID_MAP no Vercel`)
      return null
    }
    raw = telefone  // usa o telefone real para enviar
  }
  let n = raw.replace(/\D/g, '') // remove tudo que não for dígito
  if (!n) return null
  // Se não começar com 55 e tiver 10 ou 11 dígitos (DDD + número), prefixa o 55.
  if (!n.startsWith('55') && (n.length === 10 || n.length === 11)) {
    n = '55' + n
  }
  // Validação básica: Brasil = 55 + DDD(2) + número(8 ou 9) = 12 ou 13 dígitos.
  if (n.length < 12 || n.length > 13) return null
  return n
}

export type ResultadoEnvio = { ok: boolean; numero: string; id?: string; erro?: string }

/**
 * Envia UMA mensagem de texto para um número via Evolution.
 * Retorna {ok, id?} em caso de sucesso, ou {ok:false, erro} em caso de falha.
 * Nunca lança exceção — sempre devolve um resultado (pra não derrubar o fluxo).
 */
export async function enviarWhatsApp(
  numeroRaw: string | null | undefined,
  mensagem: string,
): Promise<ResultadoEnvio> {
  const numero = normalizarNumero(numeroRaw)
  if (!API_URL || !API_KEY) {
    console.error('[whatsapp] Config ausente: defina EVOLUTION_API_URL e EVOLUTION_API_KEY no .env')
    return { ok: false, numero: numero || '', erro: 'config_ausente' }
  }
  if (!numero) {
    console.warn(`[whatsapp] Número inválido, envio ignorado: "${numeroRaw}"`)
    return { ok: false, numero: numeroRaw || '', erro: 'numero_invalido' }
  }

  // Respeita a trava anti-spam entre envios consecutivos.
  const espera = MIN_GAP_MS - (Date.now() - ultimoEnvio)
  if (espera > 0) await new Promise((r) => setTimeout(r, espera))
  ultimoEnvio = Date.now()

  const url = `${API_URL}/message/sendText/${INSTANCE}`
  const payload = {
    number: numero,
    options: { delay: 800, presence: 'composing' },
    textMessage: { text: mensagem },
  }

  console.log(`[whatsapp] Enviando para ${numero} via instância ${INSTANCE}…`)
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY },
      body: JSON.stringify(payload),
    })
    const texto = await resp.text()
    if (!resp.ok) {
      console.error(`[whatsapp] Falha ao enviar para ${numero}: HTTP ${resp.status} — ${texto.slice(0, 300)}`)
      return { ok: false, numero, erro: `http_${resp.status}` }
    }
    let id: string | undefined
    try {
      id = JSON.parse(texto)?.key?.id
    } catch {
      /* resposta sem JSON — ok, segue sem id */
    }
    console.log(`[whatsapp] ✅ Enviado para ${numero} (id: ${id || 'n/d'})`)
    return { ok: true, numero, id }
  } catch (e) {
    console.error(`[whatsapp] Erro de rede ao enviar para ${numero}:`, e)
    return { ok: false, numero, erro: 'rede' }
  }
}

/**
 * Envia a MESMA mensagem (ou uma mensagem por destinatário) para vários números,
 * em sequência (respeitando a trava anti-spam). Bom para broadcasts (lembrete D-1).
 */
export async function enviarVarios(
  destinatarios: { numero: string | null | undefined; mensagem: string }[],
): Promise<ResultadoEnvio[]> {
  const resultados: ResultadoEnvio[] = []
  for (const d of destinatarios) {
    resultados.push(await enviarWhatsApp(d.numero, d.mensagem))
  }
  const ok = resultados.filter((r) => r.ok).length
  console.log(`[whatsapp] Broadcast concluído: ${ok}/${resultados.length} enviadas.`)
  return resultados
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES DAS MENSAGENS (texto livre — fácil de editar)
// Use *texto* para negrito no WhatsApp. {nome} = primeiro nome da promotora.
// ─────────────────────────────────────────────────────────────────────────────

export type TipoFluxo =
  | 'escalacao'
  | 'lembrete'
  | 'briefing'
  | 'confirmacao'
  | 'checkin'
  | 'relatorio'
  | 'pagamento'

export type DadosServico = {
  nome: string
  data_inicio?: string | null // 'YYYY-MM-DD'
  horario_inicio?: string | null // 'HH:MM[:SS]'
  cidade?: string | null
  bairro?: string | null
  local?: string | null // texto livre de endereço, se preferir
}

export type DadosDestinatario = {
  nome: string
  valor?: number | null // usado no fluxo de pagamento
}

function primeiroNome(nome: string): string {
  return (nome || '').trim().split(/\s+/)[0] || nome
}

function dataBR(d?: string | null): string {
  if (!d) return ''
  const [y, m, dia] = d.split('-')
  if (!y || !m || !dia) return d
  return `${dia}/${m}/${y}`
}

function hora(h?: string | null): string {
  return h ? h.substring(0, 5) : ''
}

function localServico(s: DadosServico): string {
  if (s.local) return s.local
  return [s.bairro, s.cidade].filter(Boolean).join(', ')
}

function moeda(v?: number | null): string {
  if (v == null) return ''
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Monta o texto da mensagem para um fluxo + serviço + destinatário.
 * É aqui que você ajusta o "jeitão" das mensagens do GustPro.
 */
export function montarMensagem(
  tipo: TipoFluxo,
  servico: DadosServico,
  dest: DadosDestinatario,
): string {
  const nome = primeiroNome(dest.nome)
  const data = dataBR(servico.data_inicio)
  const hr = hora(servico.horario_inicio)
  const local = localServico(servico)

  switch (tipo) {
    case 'escalacao':
      return (
        `Olá *${nome}*! 🎉\n\n` +
        `Você foi escalada para o serviço *${servico.nome}*.\n` +
        (data ? `📅 Data: ${data}\n` : '') +
        (hr ? `🕐 Início: ${hr}\n` : '') +
        (local ? `📍 Local: ${local}\n` : '') +
        `\nEm breve enviaremos o briefing. Por favor, *confirme sua presença* respondendo a esta mensagem. 💜`
      )

    case 'lembrete':
      return (
        `Oi *${nome}*! ⏰\n\n` +
        `Lembrete: *amanhã* (${data}) você tem o serviço *${servico.nome}*.\n` +
        (hr ? `🕐 Início: ${hr}\n` : '') +
        (local ? `📍 Local: ${local}\n` : '') +
        `\nEstá tudo certo pra você? Qualquer imprevisto, avise a gente o quanto antes. Te esperamos! 💪`
      )

    case 'briefing':
      return (
        `📋 *${nome}*, o briefing do serviço *${servico.nome}* já está disponível!\n` +
        (data ? `📅 ${data}${hr ? ` às ${hr}` : ''}\n` : '') +
        `\nAcesse os detalhes com a coordenação e chegue preparada. Qualquer dúvida, fale com a gente! 😊`
      )

    case 'confirmacao':
      return (
        `✅ *${nome}*, sua presença no serviço *${servico.nome}*` +
        (data ? ` (${data})` : '') +
        ` está *confirmada*!\n\nObrigado pelo retorno. Em breve mandamos os detalhes finais. 💜`
      )

    case 'checkin':
      return (
        `🟢 *${nome}*, o serviço *${servico.nome}* está *começando agora*!\n` +
        (local ? `📍 ${local}\n` : '') +
        `\nFaça seu check-in no local com a liderança. Bom trabalho! 🚀`
      )

    case 'relatorio':
      return (
        `🏁 *${nome}*, o serviço *${servico.nome}* foi *concluído*. Muito obrigado pela dedicação! 🙌\n\n` +
        `Por favor, nos envie seu *relatório pós-serviço* (fotos, observações e resultados). Isso ajuda demais a melhorar nosso trabalho! 📊`
      )

    case 'pagamento':
      return (
        `💰 *${nome}*, boa notícia!\n\n` +
        `O pagamento do serviço *${servico.nome}*` +
        (dest.valor != null ? ` no valor de *${moeda(dest.valor)}*` : '') +
        ` foi *realizado*. ✅\n\nObrigado por fazer parte do time GustPro! 💜`
      )
  }
}
