/**
 * /api/cron/lembretes — Lembrete D-1 (véspera do serviço).
 *
 * Roda 1x por dia via Vercel Cron (ver vercel.json). Busca as promotoras
 * CONFIRMADAS em serviços que acontecem AMANHÃ e manda um lembrete no WhatsApp.
 *
 * Segurança: a Vercel envia o header Authorization: Bearer <CRON_SECRET> nas
 * chamadas de cron (quando a env CRON_SECRET está definida). Conferimos isso
 * para ninguém disparar a rota de fora.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarVarios, montarMensagem } from '@/lib/whatsapp'

// Data de "amanhã" no horário do Brasil (UTC-3), no formato YYYY-MM-DD.
function amanhaBR(): string {
  const agoraBR = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const amanha = new Date(agoraBR.getTime() + 24 * 60 * 60 * 1000)
  const y = amanha.getUTCFullYear()
  const m = String(amanha.getUTCMonth() + 1).padStart(2, '0')
  const d = String(amanha.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function GET(req: Request) {
  // 1) Autorização (Vercel Cron)
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, erro: 'nao_autorizado' }, { status: 401 })
    }
  }

  const data = amanhaBR()
  console.log(`[cron/lembretes] Buscando serviços de amanhã (${data})…`)

  // 2) Cliente Supabase server-side (anon key — mesmas envs do app)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // 3) Escalas confirmadas cujo serviço começa amanhã (!inner = filtra pelo join)
  const { data: escalas, error } = await supabase
    .from('escala')
    .select('promotoras(nome, whatsapp), servicos!inner(nome, data_inicio, horario_inicio, cidade, bairro)')
    .eq('status_confirmacao', 'confirmada')
    .eq('servicos.data_inicio', data)

  if (error) {
    console.error('[cron/lembretes] Erro na consulta:', error)
    return NextResponse.json({ ok: false, erro: 'consulta' }, { status: 500 })
  }

  // 4) Monta e dispara os lembretes
  const fila = (escalas || [])
    .filter((e: any) => e.promotoras?.whatsapp && e.servicos)
    .map((e: any) => ({
      numero: e.promotoras.whatsapp as string,
      mensagem: montarMensagem(
        'lembrete',
        {
          nome: e.servicos.nome,
          data_inicio: e.servicos.data_inicio,
          horario_inicio: e.servicos.horario_inicio,
          cidade: e.servicos.cidade,
          bairro: e.servicos.bairro,
        },
        { nome: e.promotoras.nome },
      ),
    }))

  console.log(`[cron/lembretes] ${fila.length} lembrete(s) a enviar.`)
  const resultados = await enviarVarios(fila)
  const enviadas = resultados.filter((r) => r.ok).length

  return NextResponse.json({ ok: true, data, enviadas, total: fila.length })
}
