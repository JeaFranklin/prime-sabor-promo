/**
 * notificar.ts — Ajudante CLIENT-SIDE para disparar mensagens de WhatsApp.
 *
 * Pode ser importado em componentes 'use client' (NÃO contém segredos — apenas
 * chama a rota server-side /api/whatsapp, que é quem fala com a Evolution).
 *
 * É "best-effort": nunca lança exceção. Se o WhatsApp falhar, a operação
 * principal (salvar no banco) não é afetada — só logamos o erro no console.
 */

type TipoFluxo =
  | 'escalacao'
  | 'lembrete'
  | 'briefing'
  | 'confirmacao'
  | 'checkin'
  | 'relatorio'
  | 'pagamento'

type ServicoPayload = {
  nome: string
  data_inicio?: string | null
  horario_inicio?: string | null
  cidade?: string | null
  bairro?: string | null
}

type DestinatarioPayload = {
  numero?: string | null
  nome?: string | null
  valor?: number | null
}

export async function notificarWhatsApp(
  tipo: TipoFluxo,
  servico: ServicoPayload,
  destinatarios: DestinatarioPayload[],
): Promise<void> {
  // Sem ninguém com número válido → nem chama a rota.
  const validos = destinatarios.filter((d) => d && d.numero)
  if (validos.length === 0) return

  try {
    const resp = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, servico, destinatarios: validos }),
    })
    const json = await resp.json().catch(() => null)
    if (!resp.ok || !json?.ok) {
      console.error('[notificar] WhatsApp não enviado:', json)
    } else {
      console.log(`[notificar] WhatsApp "${tipo}": ${json.enviadas}/${json.total} enviadas`)
    }
  } catch (e) {
    console.error('[notificar] Erro ao chamar /api/whatsapp:', e)
  }
}
