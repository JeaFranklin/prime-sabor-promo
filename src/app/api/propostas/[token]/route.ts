/**
 * GET  /api/propostas/[token]
 *   → devolve dados da proposta pra promotora ver
 *
 * POST /api/propostas/[token]
 *   body: { acao: 'aceitar' | 'recusar', motivo?: string }
 *   → registra resposta com IP, UA, data/hora.
 *   Se ACEITAR, dispara notificação interna pra JFS (Jeã).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarWhatsApp } from '@/lib/whatsapp'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const supa = adminClient()
  const { data, error } = await supa
    .from('propostas')
    .select(`id, status, valor_diaria, valor_total, qtd_dias,
             data_inicio_servico, data_fim_servico,
             horario_inicio, horario_fim,
             data_pagamento_promotora,
             local_completo, servico_nome, cliente_nome,
             expira_em, respondida_em, recusa_motivo,
             promotoras:promotora_id(nome)`)
    .eq('token', token)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
  }
  const expirado = data.expira_em ? new Date(data.expira_em) < new Date() : false
  return NextResponse.json({ ...data, expirado })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const acao = body.acao as 'aceitar' | 'recusar' | undefined
  if (!acao || !['aceitar', 'recusar'].includes(acao)) {
    return NextResponse.json({ error: 'acao inválida' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null
  const ua = req.headers.get('user-agent') || null

  const supa = adminClient()
  const { data: prop, error } = await supa
    .from('propostas')
    .select(`id, status, expira_em, servico_nome,
             promotoras:promotora_id(nome)`)
    .eq('token', token).maybeSingle()

  if (error || !prop) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
  if (prop.status !== 'enviada') {
    return NextResponse.json({ error: `Proposta já está ${prop.status}` }, { status: 409 })
  }
  if (prop.expira_em && new Date(prop.expira_em) < new Date()) {
    return NextResponse.json({ error: 'Link expirado' }, { status: 410 })
  }

  const update = acao === 'aceitar'
    ? {
        status: 'aceita' as const,
        respondida_em: new Date().toISOString(),
        respondida_ip: ip, respondida_user_agent: ua,
      }
    : {
        status: 'recusada' as const,
        respondida_em: new Date().toISOString(),
        respondida_ip: ip, respondida_user_agent: ua,
        recusa_motivo: (body.motivo || '').trim() || null,
      }

  const { error: upErr } = await supa.from('propostas').update(update).eq('id', prop.id)
  if (upErr) {
    console.error('[api/propostas] update falhou:', upErr.message)
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  console.log(`[api/propostas] proposta ${prop.id} → ${update.status} (IP ${ip})`)

  // Notifica a JFS por WhatsApp interno
  const adminWhats = process.env.JFS_ADMIN_WHATSAPP // ex: '5563992253618'
  if (adminWhats) {
    const prom = prop.promotoras as unknown as { nome: string } | null
    const promNome = prom?.nome || 'promotora'
    const txt = acao === 'aceitar'
      ? `✅ *${promNome}* ACEITOU a proposta do serviço *${prop.servico_nome}*.\n\nAbra o sistema para gerar o contrato (ou ignorar).`
      : `❌ *${promNome}* RECUSOU a proposta do serviço *${prop.servico_nome}*.\n${update.recusa_motivo ? `Motivo: ${update.recusa_motivo}` : ''}`
    await enviarWhatsApp(adminWhats, txt).catch(e => console.error('[api/propostas] aviso JFS falhou:', e))
  }

  return NextResponse.json({ ok: true, status: update.status })
}
