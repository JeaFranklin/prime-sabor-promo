/**
 * POST /api/contratos/[id]/reenviar
 * Reenvia a mensagem com o link de aceite por WhatsApp para a promotora.
 * Só vale para contratos de promotora em status 'enviado'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarWhatsApp } from '@/lib/whatsapp'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supa = adminClient()

  const { data: c, error } = await supa
    .from('contratos')
    .select('id, numero, tipo, status, token_aceite, qtd_dias, enviado_whatsapp_numero, promotoras:promotora_id(whatsapp, nome)')
    .eq('id', id).maybeSingle()

  if (error || !c) return NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
  if (c.tipo !== 'promotora') return NextResponse.json({ error: 'Reenvio só para contratos de promotora' }, { status: 400 })
  if (c.status !== 'enviado') return NextResponse.json({ error: `Contrato está ${c.status}` }, { status: 400 })

  const prom = c.promotoras as unknown as { whatsapp: string | null; nome: string } | null
  const numero = prom?.whatsapp || c.enviado_whatsapp_numero
  if (!numero) return NextResponse.json({ error: 'Promotora sem WhatsApp cadastrado' }, { status: 400 })

  const link = `${process.env.APP_URL || ''}/contratos/aceite/${c.token_aceite}`
  const msg =
    `📄 *Contrato ${c.numero}* (reenvio)\n\n` +
    `Olá! Aqui está novamente o link do seu contrato de ${c.qtd_dias} dias.\n\n` +
    `👉 ${link}\n\nQualquer dúvida, é só responder. 💜`

  console.log(`[contratos] reenviando para ${numero} — contrato ${c.numero}`)
  const r = await enviarWhatsApp(numero, msg)
  if (!r.ok) return NextResponse.json({ error: `WhatsApp: ${r.erro}` }, { status: 500 })

  await supa.from('contratos').update({ enviado_whatsapp_em: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ ok: true })
}
