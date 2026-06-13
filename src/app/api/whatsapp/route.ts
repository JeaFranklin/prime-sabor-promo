/**
 * /api/whatsapp — Rota server-side que dispara mensagens de WhatsApp.
 *
 * Por que server-side? A apikey da Evolution é secreta e a Evolution roda em
 * HTTP — o navegador bloquearia (mixed content) e exporia a chave. Então o
 * navegador chama ESTA rota (mesmo domínio, HTTPS) e o servidor fala com a Evolution.
 *
 * Como usar (do componente client), depois de salvar no Supabase:
 *   await fetch('/api/whatsapp', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       tipo: 'escalacao',
 *       servico: { nome, data_inicio, horario_inicio, cidade, bairro },
 *       destinatarios: [{ numero: '5563...', nome: 'Maria', valor: 150 }],
 *     }),
 *   })
 *
 * O envio é "best-effort": se falhar, NÃO quebra a operação principal. A resposta
 * traz o resumo de quantas mensagens foram enviadas.
 */
import { NextResponse } from 'next/server'
import {
  enviarVarios,
  montarMensagem,
  type TipoFluxo,
  type DadosServico,
} from '@/lib/whatsapp'

const TIPOS_VALIDOS: TipoFluxo[] = [
  'escalacao',
  'lembrete',
  'briefing',
  'confirmacao',
  'checkin',
  'relatorio',
  'pagamento',
]

type Destinatario = { numero?: string | null; nome?: string | null; valor?: number | null }

export async function POST(req: Request) {
  let body: {
    tipo?: string
    servico?: DadosServico
    destinatarios?: Destinatario[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, erro: 'json_invalido' }, { status: 400 })
  }

  const { tipo, servico, destinatarios } = body

  // Validação da entrada (regra: nunca confiar na entrada sem checar).
  if (!tipo || !TIPOS_VALIDOS.includes(tipo as TipoFluxo)) {
    return NextResponse.json({ ok: false, erro: 'tipo_invalido' }, { status: 400 })
  }
  if (!servico || !servico.nome) {
    return NextResponse.json({ ok: false, erro: 'servico_ausente' }, { status: 400 })
  }
  if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
    return NextResponse.json({ ok: false, erro: 'sem_destinatarios' }, { status: 400 })
  }

  console.log(
    `[api/whatsapp] Fluxo "${tipo}" para ${destinatarios.length} destinatário(s) — serviço "${servico.nome}"`,
  )

  // Monta uma mensagem por destinatário e dispara (com trava anti-spam no helper).
  const fila = destinatarios
    .filter((d) => d && d.numero)
    .map((d) => ({
      numero: d.numero,
      mensagem: montarMensagem(tipo as TipoFluxo, servico, {
        nome: d.nome || '',
        valor: d.valor ?? null,
      }),
    }))

  if (fila.length === 0) {
    return NextResponse.json({ ok: false, erro: 'destinatarios_sem_numero' }, { status: 400 })
  }

  const resultados = await enviarVarios(fila)
  const enviadas = resultados.filter((r) => r.ok).length

  return NextResponse.json({
    ok: enviadas > 0,
    enviadas,
    total: fila.length,
    resultados,
  })
}
