/**
 * POST /api/propostas/enviar
 *   body: { servico_id: string, promotora_id?: string }
 *
 * Se vier promotora_id, envia só para essa promotora.
 * Sem promotora_id, envia para TODAS as promotoras escaladas no serviço.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  enviarPropostaParaPromotora, enviarPropostasDoServico,
} from '@/lib/propostas/envio'

export async function POST(req: NextRequest) {
  try {
    const { servico_id, promotora_id } = await req.json()
    if (!servico_id) {
      return NextResponse.json({ error: 'servico_id é obrigatório' }, { status: 400 })
    }
    const resumo = promotora_id
      ? await enviarPropostaParaPromotora(servico_id, promotora_id)
      : await enviarPropostasDoServico(servico_id)
    return NextResponse.json(resumo)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/propostas/enviar] erro:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
