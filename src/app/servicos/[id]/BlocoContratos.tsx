/**
 * Bloco "Contratos e Propostas" no detalhe do serviço.
 *
 * Fluxo de gestão por etapas:
 *   1) Gerar contrato do CLIENTE (independente)
 *   2) Enviar PROPOSTA para cada promotora escalada
 *   3) Quando a promotora ACEITA → JFS clica em "Gerar contrato"
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type Props = {
  servicoId: string
  dataInicio: string | null
  dataFim: string | null
}

type Escalada = {
  promotora_id: string
  promotora_nome: string
  promotora_whatsapp: string | null
  proposta_status?: string | null
  proposta_id?: string | null
  contrato_promotora_id?: string | null
  contrato_promotora_numero?: string | null
  contrato_promotora_status?: string | null
}

type Contrato = {
  id: string
  numero: string
  status: string
}

const MIN_DIAS = 5

function calcDias(inicio: string, fim: string): number {
  const d1 = new Date(inicio + 'T00:00:00').getTime()
  const d2 = new Date(fim + 'T00:00:00').getTime()
  return Math.max(1, Math.round((d2 - d1) / 86400000) + 1)
}

const STATUS_PROPOSTA: Record<string, { cor: string; texto: string }> = {
  enviada:        { cor: 'bg-blue-100 text-blue-700',     texto: '📲 Proposta enviada' },
  aceita:         { cor: 'bg-green-100 text-green-700',   texto: '✅ Aceita — gere o contrato' },
  recusada:       { cor: 'bg-red-100 text-red-700',       texto: '❌ Recusada' },
  expirada:       { cor: 'bg-yellow-100 text-yellow-700', texto: '⏰ Expirada' },
  cancelada:      { cor: 'bg-gray-100 text-gray-500',     texto: '🚫 Cancelada' },
  gerou_contrato: { cor: 'bg-purple-100 text-purple-700', texto: '📄 Contrato gerado' },
}

export function BlocoContratos({ servicoId, dataInicio, dataFim }: Props) {
  const [contratoCliente, setContratoCliente] = useState<Contrato | null>(null)
  const [escaladas, setEscaladas] = useState<Escalada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const supa = createSupabaseBrowser()
    // Contrato do cliente do serviço
    const { data: contratoC } = await supa
      .from('contratos').select('id, numero, status')
      .eq('servico_id', servicoId).eq('tipo', 'cliente').maybeSingle()
    setContratoCliente(contratoC as Contrato | null)

    // Promotoras escaladas + propostas + contratos
    const { data: esc } = await supa
      .from('escala')
      .select('promotora_id, promotoras:promotora_id(id, nome, whatsapp)')
      .eq('servico_id', servicoId)

    const { data: props } = await supa
      .from('propostas').select('id, promotora_id, status').eq('servico_id', servicoId)
    const { data: contsProm } = await supa
      .from('contratos').select('id, numero, status, promotora_id')
      .eq('servico_id', servicoId).eq('tipo', 'promotora')

    const lista: Escalada[] = (esc || []).map(e => {
      const p = e.promotoras as unknown as { id: string; nome: string; whatsapp: string | null } | null
      const proposta = props?.find(pr => pr.promotora_id === e.promotora_id)
      const contrato = contsProm?.find(c => c.promotora_id === e.promotora_id)
      return {
        promotora_id: e.promotora_id,
        promotora_nome: p?.nome || '—',
        promotora_whatsapp: p?.whatsapp || null,
        proposta_status: proposta?.status,
        proposta_id: proposta?.id,
        contrato_promotora_id: contrato?.id,
        contrato_promotora_numero: contrato?.numero,
        contrato_promotora_status: contrato?.status,
      }
    })
    setEscaladas(lista)
    setCarregando(false)
  }, [servicoId])

  useEffect(() => { carregar() }, [carregar])

  async function gerarContratoCliente() {
    setAcaoEmAndamento('cliente')
    setMsg(null)
    try {
      const r = await fetch('/api/contratos/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servico_id: servicoId }),
      })
      const d = await r.json()
      if (!r.ok) setMsg(`❌ ${d.error || 'Erro'}`)
      else setMsg(`✅ ${d.gerados} novo(s) • ${d.pulados} já existente(s)`)
      await carregar()
    } finally { setAcaoEmAndamento(null) }
  }

  async function enviarProposta(promotoraId: string) {
    setAcaoEmAndamento(`prop-${promotoraId}`)
    setMsg(null)
    try {
      const r = await fetch('/api/propostas/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servico_id: servicoId, promotora_id: promotoraId }),
      })
      const d = await r.json()
      if (!r.ok) setMsg(`❌ ${d.error || 'Erro'}`)
      else setMsg(`✅ ${d.enviadas} proposta(s) enviada(s)`)
      await carregar()
    } finally { setAcaoEmAndamento(null) }
  }

  async function gerarContratoPromotora(promotoraId: string) {
    setAcaoEmAndamento(`ct-${promotoraId}`)
    setMsg(null)
    try {
      const r = await fetch('/api/contratos/gerar-promotora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servico_id: servicoId, promotora_id: promotoraId }),
      })
      const d = await r.json()
      if (!r.ok) setMsg(`❌ ${d.error || 'Erro'}`)
      else setMsg(`✅ Contrato gerado`)
      await carregar()
    } finally { setAcaoEmAndamento(null) }
  }

  if (!dataInicio || !dataFim) return null
  const dias = calcDias(dataInicio, dataFim)
  const elegivel = dias >= MIN_DIAS
  if (!elegivel) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-bold text-gray-700">📄 Contratos</h3>
        <p className="text-sm text-gray-500 mt-1">
          Duração: <strong>{dias} dia{dias > 1 ? 's' : ''}</strong> — mínimo de {MIN_DIAS} dias para gerar contratos.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-700">📄 Contratos e Propostas</h3>
        <span className="text-xs text-gray-500">{dias} dias • elegível</span>
      </div>

      {/* CONTRATO DO CLIENTE */}
      <div className="border border-gray-100 rounded-xl p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">🏢 Contrato do Cliente</p>
            {contratoCliente ? (
              <Link href={`/contratos/${contratoCliente.id}`} className="text-xs text-purple-700 hover:underline">
                {contratoCliente.numero} · <span className="capitalize">{contratoCliente.status}</span>
              </Link>
            ) : (
              <p className="text-xs text-gray-500">Ainda não gerado</p>
            )}
          </div>
          {!contratoCliente && (
            <button onClick={gerarContratoCliente}
              disabled={acaoEmAndamento === 'cliente'}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-bold px-3 py-1.5 rounded-lg">
              {acaoEmAndamento === 'cliente' ? 'Gerando…' : 'Gerar contrato'}
            </button>
          )}
        </div>
      </div>

      {/* CONTRATOS DAS PROMOTORAS — fluxo: proposta → aceite → contrato */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">👩 Propostas e contratos das promotoras</p>
        {carregando ? (
          <p className="text-xs text-gray-400">Carregando…</p>
        ) : escaladas.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Nenhuma promotora escalada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {escaladas.map(e => {
              const stProp = e.proposta_status ? STATUS_PROPOSTA[e.proposta_status] : null
              return (
                <li key={e.promotora_id} className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-700 text-sm truncate">{e.promotora_nome}</p>
                    {stProp && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stProp.cor}`}>{stProp.texto}</span>}
                    {!stProp && <span className="text-xs text-gray-400">Sem proposta enviada</span>}
                    {e.contrato_promotora_numero && (
                      <Link href={`/contratos/${e.contrato_promotora_id}`}
                        className="block text-xs text-purple-700 hover:underline mt-1">
                        📄 {e.contrato_promotora_numero}
                      </Link>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {!e.proposta_status && (
                      <button onClick={() => enviarProposta(e.promotora_id)}
                        disabled={acaoEmAndamento === `prop-${e.promotora_id}`}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap">
                        {acaoEmAndamento === `prop-${e.promotora_id}` ? '…' : 'Enviar proposta'}
                      </button>
                    )}
                    {e.proposta_status === 'aceita' && !e.contrato_promotora_id && (
                      <button onClick={() => gerarContratoPromotora(e.promotora_id)}
                        disabled={acaoEmAndamento === `ct-${e.promotora_id}`}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap">
                        {acaoEmAndamento === `ct-${e.promotora_id}` ? '…' : 'Gerar contrato'}
                      </button>
                    )}
                    {(e.proposta_status === 'recusada' || e.proposta_status === 'expirada' || e.proposta_status === 'cancelada') && (
                      <button onClick={() => enviarProposta(e.promotora_id)}
                        disabled={acaoEmAndamento === `prop-${e.promotora_id}`}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap">
                        Reenviar
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {msg && <p className="text-sm bg-gray-50 rounded p-2">{msg}</p>}
    </div>
  )
}
