/**
 * viana-envio-manha — Edge Function | Bot Viana
 * Envia agenda do DIA DE HOJE para Kênia às 9h (BRT)
 * Substitui: /opt/viana/scripts/viana_envio.py
 * Agendado via pg_cron: 0 12 * * * (12h UTC = 9h BRT)
 *
 * TODO (amanhã): confirmar com Jeã se viana_envio.py envia hoje ou outra coisa.
 * Se for diferente, ajustar formatarMensagem() abaixo.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EVOLUTION_URL        = Deno.env.get('VIANA_EVOLUTION_URL')!
const EVOLUTION_INST       = Deno.env.get('VIANA_EVOLUTION_INSTANCE')!
const EVOLUTION_KEY        = Deno.env.get('VIANA_EVOLUTION_KEY')!
const KENIA                = Deno.env.get('VIANA_WHATSAPP_KENIA') ?? '556392197949'

const BUCKET  = 'viana-agenda'
const ARQUIVO = 'agenda-atual.json'

// Nomes dos dias conforme aparecem no Excel (sem acento, para comparação robusta)
const DIAS_SEMANA_FMT = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo']
const DIAS_SEMANA_SEM_ACENTO = ['domingo','segunda','terca','quarta','quinta','sexta','sabado']

const STATUS_EMOJI: Record<string, string> = {
  'COTACAO':         '🟢',
  'COTAÇÃO':         '🟢',
  'PEDIDO DIGITADO': '🔵',
  'PEDIDO PENDENTE': '🟡',
  'TERMO ESTOQUE':   '🔴',
}

function log(msg: string) {
  console.log(`[viana-envio-manha] ${msg}`)
}

function fmtLinha(l: Record<string, unknown>): string {
  const cod       = (l.cod as string) ?? '?'
  const desc      = ((l.descricao as string) ?? '').trim() || 'Sem descrição'
  const status    = ((l.status as string) ?? '').trim()
  const comprador = ((l.comprador as string) ?? '').trim()
  const emoji     = STATUS_EMOJI[status.toUpperCase()] ?? '⚪'
  let txt = `${emoji} *${cod}* — ${desc}`
  if (status)     txt += `\n    status: ${status}`
  if (comprador)  txt += `\n    comprador: ${comprador}`
  return txt
}

function formatarMensagem(linhas: Record<string, unknown>[], hoje: Date): string {
  const hojeStr = hoje.toISOString().slice(0, 10)
  const matches = linhas.filter(l => ((l.data as string) ?? '').slice(0, 10) === hojeStr)
  const diaFmt  = `${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}`
  const idxJS   = hoje.getDay()
  const diaNome = DIAS_SEMANA_FMT[idxJS === 0 ? 6 : idxJS - 1]
  const titulo  = `BOM DIA ☀️ — ${diaNome} ${diaFmt}`

  if (!matches.length) {
    return `📋 *${titulo}*\n\nNenhum fornecedor agendado para hoje. 🎉\n\n— Viana`
  }
  const plural = matches.length > 1 ? 'fornecedores' : 'fornecedor'
  return `📋 *${titulo}* (${matches.length} ${plural})\n\n${matches.map(fmtLinha).join('\n\n')}\n\n— Viana`
}

async function enviarWhatsapp(numero: string, texto: string) {
  const res = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INST}`, {
    method:  'POST',
    headers: { 'apikey': EVOLUTION_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number:      numero,
      options:     { delay: 1200 },
      textMessage: { text: texto },
    }),
  })
  if (!res.ok) throw new Error(`Evolution API erro ${res.status}: ${await res.text()}`)
}

Deno.serve(async () => {
  try {
    log('iniciando...')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(ARQUIVO)
    if (error || !blob) throw new Error(`Storage erro: ${error?.message}`)
    const agenda = JSON.parse(await blob.text())
    const linhas = agenda.linhas as Record<string, unknown>[]
    log(`agenda carregada: ${linhas.length} linhas`)

    // Hoje em horário de Brasília (UTC-3)
    const hoje = new Date(Date.now() - 3 * 60 * 60 * 1000)
    log(`enviando agenda de hoje: ${hoje.toISOString().slice(0,10)}`)

    const mensagem = formatarMensagem(linhas, hoje)
    log(`mensagem: ${mensagem.length} chars`)

    await enviarWhatsapp(KENIA, mensagem)
    log(`mensagem enviada para ...${KENIA.slice(-4)} OK`)
    log('concluído')

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    log(`ERRO: ${err.message}`)
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
