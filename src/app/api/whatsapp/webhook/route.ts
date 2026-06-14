/**
 * POST /api/whatsapp/webhook
 *
 * Webhook do Evolution API. Recebe TODAS as mensagens enviadas e recebidas
 * pela instância 'gustpro'. A gente filtra só RESPOSTAS de promotoras
 * (fromMe=false) e processa SIM/NÃO em propostas pendentes.
 *
 * Configuração no Evolution Manager:
 *   Webhook URL: https://SEU_DOMINIO/api/whatsapp/webhook
 *   Eventos: MESSAGES_UPSERT
 *
 * Payload típico que o Evolution envia:
 * {
 *   "event": "messages.upsert",
 *   "instance": "gustpro",
 *   "data": {
 *     "key": { "remoteJid": "5563992253618@s.whatsapp.net", "fromMe": false, "id": "..." },
 *     "message": { "conversation": "SIM" },
 *     "messageType": "conversation",
 *     "messageTimestamp": 1718284800
 *   }
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarWhatsApp } from '@/lib/whatsapp'
import { criarNotificacao } from '@/lib/notificacoes/criar'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

type WebhookData = {
  event?: string
  instance?: string
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string }
    pushName?: string | null
    message?: {
      conversation?: string
      extendedTextMessage?: { text?: string }
      buttonsResponseMessage?: { selectedButtonId?: string }
    }
    messageType?: string
    messageTimestamp?: number
  }
}

/** Detecta se a resposta da promotora é um SIM (aceitar). */
function ehAceite(texto: string): boolean {
  const t = texto.trim().toLowerCase()
  return ['sim', 's', '1', 'aceito', 'aceitar', 'aceita', 'ok', 'confirmo', 'confirmar'].includes(t)
}

/** Detecta se a resposta da promotora é um NÃO (recusar). */
function ehRecusa(texto: string): boolean {
  const t = texto.trim().toLowerCase().replace(/ã/g, 'a').replace(/[^a-z0-9]/g, '')
  return ['nao', 'n', '2', 'recuso', 'recusar', 'recusa', 'negar'].includes(t)
}

/** Extrai o texto da mensagem do payload do Evolution. */
function extrairTexto(d: WebhookData['data']): string {
  return (
    d?.message?.conversation
    || d?.message?.extendedTextMessage?.text
    || d?.message?.buttonsResponseMessage?.selectedButtonId
    || ''
  ).toString().trim()
}

/** Extrai o número de telefone (só dígitos) do JID. */
function extrairNumero(jid: string | undefined): string | null {
  if (!jid) return null
  // JID vem como "5563992253618@s.whatsapp.net" ou similar
  const match = jid.match(/^(\d+)@/)
  return match ? match[1] : null
}

export async function POST(req: NextRequest) {
  let body: WebhookData
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  // Loga pra debug — útil quando configurar o webhook
  console.log(`[webhook] PAYLOAD COMPLETO:`, JSON.stringify(body))
  console.log(`[webhook] evento=${body.event} instance=${body.instance} fromMe=${body.data?.key?.fromMe}`)

  // Normaliza o nome do evento — Evolution pode mandar 'messages.upsert',
  // 'MESSAGES_UPSERT', 'messages-upsert' dependendo da versão/config.
  const eventoNormalizado = (body.event || '').toLowerCase().replace(/[._-]/g, '')
  if (eventoNormalizado !== 'messagesupsert') {
    console.log(`[webhook] ignorado — evento ${body.event} não é messages.upsert`)
    return NextResponse.json({ ok: true, ignored: 'evento não relevante' })
  }

  // 🚨 Critério ANTIGO (não confiável): body.data.key.fromMe
  // Em testes onde o número da promotora é igual ao da instância (admin testando),
  // a Evolution marca TUDO com fromMe=true. Trocamos pra usar `pushName`:
  //   - mensagem RECEBIDA → pushName preenchido (nome do remetente)
  //   - mensagem ENVIADA pelo sistema → pushName null/vazio
  const pushName = (body.data?.pushName || '').trim()
  if (!pushName) {
    console.log(`[webhook] ignorado — sem pushName (provavelmente mensagem do próprio sistema)`)
    return NextResponse.json({ ok: true, ignored: 'sem pushName — mensagem do sistema' })
  }

  const numeroBruto = extrairNumero(body.data?.key?.remoteJid)
  const texto = extrairTexto(body.data)
  if (!texto) {
    return NextResponse.json({ ok: true, ignored: 'sem texto' })
  }

  console.log(`[webhook] mensagem recebida de "${pushName}" (jid=${body.data?.key?.remoteJid}): "${texto}"`)

  const aceitar = ehAceite(texto)
  const recusar = ehRecusa(texto)
  if (!aceitar && !recusar) {
    console.log(`[webhook] resposta não reconhecida ("${texto}") — ignorada`)
    return NextResponse.json({ ok: true, ignored: 'resposta não SIM/NAO' })
  }

  // 🔍 Busca proposta com flexibilidade — Evolution pode mandar:
  //   - remoteJid em formato @s.whatsapp.net (com número) → match por número
  //   - remoteJid em formato @lid (sem número usável) → match por pushName
  type PropostaMatch = {
    id: string; status: string; servico_nome: string;
    promotora_id: string; expira_em: string; servico_id: string;
    promotoras: { nome: string; whatsapp: string | null } | null
  }
  const supa = adminClient()
  let propostas: PropostaMatch[] | null = null

  if (numeroBruto) {
    const { data } = await supa
      .from('propostas')
      .select(`id, status, servico_nome, promotora_id, expira_em, servico_id,
               promotoras:promotora_id(nome, whatsapp)`)
      .eq('enviada_whatsapp_numero', numeroBruto)
      .eq('status', 'enviada')
      .order('created_at', { ascending: false })
      .limit(1)
    propostas = data as unknown as PropostaMatch[] | null
  }

  // Fallback: busca por nome da promotora (pushName)
  if (!propostas || propostas.length === 0) {
    console.log(`[webhook] sem match por número (${numeroBruto}). Tentando por pushName="${pushName}"...`)
    const { data } = await supa
      .from('propostas')
      .select(`id, status, servico_nome, promotora_id, expira_em, servico_id,
               promotoras:promotora_id!inner(nome, whatsapp)`)
      .eq('status', 'enviada')
      .ilike('promotoras.nome', `%${pushName}%`)
      .order('created_at', { ascending: false })
      .limit(1)
    propostas = data as unknown as PropostaMatch[] | null
  }

  if (!propostas || propostas.length === 0) {
    console.log(`[webhook] nenhuma proposta ativa achada — ignorando`)
    return NextResponse.json({ ok: true, ignored: 'sem proposta ativa' })
  }

  const prop = propostas[0]
  // Se Evolution mandou @lid (sem número), usa o whatsapp cadastrado da promotora
  const numero = numeroBruto || prop.promotoras?.whatsapp || ''
  console.log(`[webhook] proposta encontrada: ${prop.id} (promotora=${prop.promotoras?.nome})`)
  if (prop.expira_em && new Date(prop.expira_em) < new Date()) {
    // Marca como expirada e avisa
    await supa.from('propostas').update({ status: 'expirada' }).eq('id', prop.id)
    await enviarWhatsApp(numero,
      `⏰ A proposta do serviço *${prop.servico_nome}* expirou (validade de 2 horas). ` +
      `Entre em contato com a JFS para uma nova oportunidade.`)
    return NextResponse.json({ ok: true, status: 'expirada' })
  }

  // Atualiza status
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null
  const update = aceitar
    ? { status: 'aceita' as const, respondida_em: new Date().toISOString(), respondida_ip: ip, respondida_user_agent: 'whatsapp' }
    : { status: 'recusada' as const, respondida_em: new Date().toISOString(), respondida_ip: ip, respondida_user_agent: 'whatsapp', recusa_motivo: 'Respondido via WhatsApp' }

  const { error: upErr } = await supa.from('propostas').update(update).eq('id', prop.id)
  if (upErr) {
    console.error('[webhook] update falhou:', upErr.message)
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })
  }

  console.log(`[webhook] proposta ${prop.id} → ${update.status}`)

  // Cria notificação in-app pro admin (sino do header)
  await criarNotificacao({
    tipo: aceitar ? 'proposta_aceita' : 'proposta_recusada',
    titulo: `${prop.promotoras?.nome ?? 'Promotora'} ${aceitar ? 'aceitou' : 'recusou'} a proposta`,
    mensagem: `Serviço: ${prop.servico_nome}`,
    link_para: `/servicos/${prop.servico_id}`,
    metadata: { proposta_id: prop.id, servico_id: prop.servico_id, promotora_id: prop.promotora_id },
  })

  // Resposta automática para a promotora
  const prom = prop.promotoras as unknown as { nome: string } | null
  const promPrimeiroNome = (prom?.nome || '').split(' ')[0] || 'tudo bem'
  const respPromotora = aceitar
    ? `✅ Recebido, *${promPrimeiroNome}*! Sua aceitação foi registrada para o serviço *${prop.servico_nome}*.\n\nA JFS Consultoria vai gerar o contrato e te enviar em seguida pra assinatura. 💜`
    : `❌ Recebido, *${promPrimeiroNome}*. Registramos sua recusa para o serviço *${prop.servico_nome}*. Obrigado pelo retorno!`
  await enviarWhatsApp(numero, respPromotora).catch(e => console.error('[webhook] resposta automática falhou:', e))

  // Notifica admin JFS
  const adminWhats = process.env.JFS_ADMIN_WHATSAPP
  if (adminWhats) {
    const txt = aceitar
      ? `✅ *${prom?.nome || numero}* ACEITOU a proposta do serviço *${prop.servico_nome}* (via WhatsApp).\n\nAbra o sistema para gerar o contrato.`
      : `❌ *${prom?.nome || numero}* RECUSOU a proposta do serviço *${prop.servico_nome}* (via WhatsApp).`
    await enviarWhatsApp(adminWhats, txt).catch(e => console.error('[webhook] aviso admin falhou:', e))
  }

  return NextResponse.json({ ok: true, status: update.status, proposta_id: prop.id })
}

/** Health check do webhook — Evolution costuma validar com GET na URL antes de ativar. */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'whatsapp-webhook', ts: new Date().toISOString() })
}
