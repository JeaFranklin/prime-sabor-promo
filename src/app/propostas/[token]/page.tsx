/**
 * Página pública da PROPOSTA — sem login, abre pelo link do WhatsApp.
 * É o passo ANTES do contrato. A promotora vê os termos e aceita/recusa.
 */
'use client'

import { useEffect, useState, use } from 'react'

type Proposta = {
  id: string
  status: 'enviada' | 'aceita' | 'recusada' | 'cancelada' | 'expirada' | 'gerou_contrato'
  valor_diaria: number
  valor_total: number
  qtd_dias: number
  data_inicio_servico: string
  data_fim_servico: string
  horario_inicio: string | null
  horario_fim: string | null
  data_pagamento_promotora: string
  local_completo: string
  servico_nome: string
  cliente_nome: string
  expira_em: string | null
  expirado: boolean
  respondida_em: string | null
  recusa_motivo: string | null
  promotoras: { nome: string } | null
}

function dataBR(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function moeda(v: number): string {
  return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'
}

export default function PaginaProposta({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/propostas/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setErro(d.error)
        else setProposta(d)
      })
      .catch(e => setErro(String(e)))
      .finally(() => setCarregando(false))
  }, [token])

  async function responder(acao: 'aceitar' | 'recusar') {
    if (acao === 'recusar' && !confirm('Confirma que deseja RECUSAR esta proposta?')) return
    setEnviando(true)
    setFeedback(null)
    try {
      const r = await fetch(`/api/propostas/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, motivo: motivo.trim() || undefined }),
      })
      const d = await r.json()
      if (!r.ok) {
        setFeedback(`❌ ${d.error || 'Erro ao responder'}`)
      } else {
        setFeedback(
          acao === 'aceitar'
            ? '✅ Proposta aceita! A JFS Consultoria vai te contatar em breve para enviar o contrato formal.'
            : '❌ Proposta recusada. Agradecemos o retorno!'
        )
        if (proposta) {
          setProposta({
            ...proposta,
            status: acao === 'aceitar' ? 'aceita' : 'recusada',
            respondida_em: new Date().toISOString(),
          })
        }
      }
    } finally { setEnviando(false) }
  }

  if (carregando) return <div className="p-8 text-center">Carregando proposta…</div>
  if (erro) return <div className="p-8 text-center text-red-600">{erro}</div>
  if (!proposta) return <div className="p-8 text-center">Não encontrada.</div>

  const jaRespondeu = proposta.status === 'aceita' || proposta.status === 'recusada'
  const expirou = proposta.expirado

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-gradient-to-br from-purple-600 to-pink-500 rounded-2xl shadow-lg p-6 text-white mb-4">
        <p className="text-xs uppercase opacity-80">Proposta de serviço</p>
        <h1 className="text-2xl font-black mt-1">{proposta.servico_nome}</h1>
        <p className="opacity-90 mt-1">Cliente: <strong>{proposta.cliente_nome}</strong></p>
      </div>

      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <h2 className="font-bold text-gray-700 mb-3">📋 Detalhes</h2>
        <dl className="space-y-2 text-sm">
          <Linha label="Promotora convidada" valor={proposta.promotoras?.nome || '—'} bold />
          <Linha label="Período" valor={`${dataBR(proposta.data_inicio_servico)} a ${dataBR(proposta.data_fim_servico)}`} />
          <Linha label="Duração" valor={`${proposta.qtd_dias} dia${proposta.qtd_dias > 1 ? 's' : ''}`} />
          {(proposta.horario_inicio || proposta.horario_fim) && (
            <Linha label="Horário"
              valor={`${(proposta.horario_inicio || '').substring(0, 5)}${proposta.horario_fim ? ` às ${proposta.horario_fim.substring(0, 5)}` : ''}`} />
          )}
          <Linha label="Local" valor={proposta.local_completo} />
          <Linha label="Valor da diária" valor={moeda(proposta.valor_diaria)} />
          <Linha label="Valor TOTAL" valor={moeda(proposta.valor_total)} bold highlight />
          <Linha label="Pagamento previsto" valor={dataBR(proposta.data_pagamento_promotora)} />
        </dl>
        <p className="text-xs text-gray-500 mt-3 italic">
          ⚠️ Esta é uma <strong>proposta</strong>. O contrato formal será enviado caso você aceite.
        </p>
      </div>

      {!jaRespondeu && !expirou && (
        <div className="bg-white rounded-2xl shadow p-5 space-y-3">
          <h2 className="font-bold text-gray-700">Sua resposta</h2>
          <button
            onClick={() => responder('aceitar')} disabled={enviando}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl">
            ✅ Aceitar proposta
          </button>

          <div className="pt-2 border-t border-gray-100">
            <label className="text-xs text-gray-500">Motivo da recusa (opcional):</label>
            <input value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: tenho outro compromisso na data"
              className="w-full border rounded px-3 py-2 mt-1 text-sm" />
            <button
              onClick={() => responder('recusar')} disabled={enviando}
              className="w-full mt-2 text-red-600 border border-red-300 hover:bg-red-50 py-2 rounded-xl text-sm">
              ❌ Recusar proposta
            </button>
          </div>

          {feedback && <p className="mt-3 text-sm p-3 bg-gray-50 rounded">{feedback}</p>}
        </div>
      )}

      {jaRespondeu && (
        <div className={`rounded-2xl p-6 text-center ${
          proposta.status === 'aceita' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          <p className="font-bold text-lg">
            {proposta.status === 'aceita' ? '✅ Proposta aceita' : '❌ Proposta recusada'}
          </p>
          {proposta.respondida_em && (
            <p className="text-xs mt-1">
              em {proposta.respondida_em.slice(0, 19).replace('T', ' às ')}
            </p>
          )}
          {proposta.recusa_motivo && (
            <p className="text-sm mt-2 italic">Motivo: {proposta.recusa_motivo}</p>
          )}
        </div>
      )}

      {expirou && !jaRespondeu && (
        <div className="bg-yellow-50 text-yellow-800 rounded-2xl p-6 text-center">
          ⏰ Esta proposta expirou. Se ainda tiver interesse, entre em contato com a JFS Consultoria.
        </div>
      )}
    </div>
  )
}

function Linha({ label, valor, bold, highlight }: { label: string; valor: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`text-right ${bold ? 'font-bold' : ''} ${highlight ? 'text-lg text-purple-700' : 'text-gray-800'}`}>{valor}</dd>
    </div>
  )
}
