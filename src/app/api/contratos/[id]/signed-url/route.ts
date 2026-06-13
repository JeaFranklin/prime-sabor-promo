/**
 * GET /api/contratos/[id]/signed-url
 *   → devolve uma Signed URL fresh do PDF do contrato (válida por 7 dias).
 *   Uso: a tela /contratos/[id] chama isto pra exibir o PDF num iframe.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { reassinarUrl } from '@/lib/contratos/gerar-pdf'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supa = adminClient()
  const { data, error } = await supa.from('contratos').select('pdf_path').eq('id', id).maybeSingle()
  if (error || !data?.pdf_path) {
    return NextResponse.json({ error: 'Contrato ou PDF não encontrado' }, { status: 404 })
  }
  try {
    const url = await reassinarUrl(data.pdf_path)
    return NextResponse.json({ url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
