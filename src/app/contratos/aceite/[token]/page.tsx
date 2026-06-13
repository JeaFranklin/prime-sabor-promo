/**
 * Página pública de aceite eletrônico de contrato.
 * Acessada por link no WhatsApp — sem login.
 * A segurança vem do token aleatório (URL não-adivinhável).
 */
'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'

type ContratoView = {
  id: string
  numero: string
  tipo: 'cliente' | 'promotora'
  status: string
  qtd_dias: number
  valor_total: number
  data_inicio_servico: string
  data_fim_servico: string
  signed_url: string | null
  expirado: boolean
  aceito_em: string | null
  recusado_em: string | null
  conteudo_json: { servico?: { nome?: string } }
}

export default function PaginaAceite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [contrato, setContrato] = useState<ContratoView | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [concordo, setConcordo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [motivoRecusa, setMotivoRecusa] = useState('')

  useEffect(() => {
    fetch(`/api/contratos/aceite/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setErro(d.error)
        else setContrato(d)
      })
      .catch(e => setErro(String(e)))
      .finally(() => setCarregando(false))
  }, [token])

  async function aceitar() {
    if (!concordo || !nome.trim()) {
      setFeedback('Preencha seu nome e marque a caixa de concordância.')
      return
    }
    setEnviando(true)
    setFeedback(null)
    try {
      const r = await fetch(`/api/contratos/aceite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'aceitar', nome_digitado: nome.trim() }),
      })
      const d = await r.json()
      if (!r.ok) setFeedback(`Erro: ${d.error}`)
      else {
        setFeedback('✅ Contrato aceito com sucesso! Você receberá uma confirmação por WhatsApp.')
        if (contrato) setContrato({ ...contrato, status: 'aceito', aceito_em: new Date().toISOString() })
      }
    } finally { setEnviando(false) }
  }

  async function recusar() {
    if (!confirm('Tem certeza que deseja recusar este contrato?')) return
    setEnviando(true)
    try {
      const r = await fetch(`/api/contratos/aceite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'recusar', motivo: motivoRecusa.trim() }),
      })
      const d = await r.json()
      if (!r.ok) setFeedback(`Erro: ${d.error}`)
      else {
        setFeedback('Contrato recusado. Entraremos em contato.')
        if (contrato) setContrato({ ...contrato, status: 'recusado', recusado_em: new Date().toISOString() })
      }
    } finally { setEnviando(false) }
  }

  if (carregando) return <div className="p-8 text-center">Carregando contrato…</div>
  if (erro) return <div className="p-8 text-center text-red-600">{erro}</div>
  if (!contrato) return <div className="p-8 text-center">Não encontrado.</div>

  const valor = contrato.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const jaFinalizado = contrato.status === 'aceito' || contrato.status === 'recusado'

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs uppercase text-gray-500">Contrato</p>
            <h1 className="text-2xl font-bold">{contrato.numero}</h1>
            <p className="text-gray-600 mt-1">
              {contrato.tipo === 'promotora' ? 'Prestação de serviços autônoma' : 'Serviços de promoção'}
            </p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
            contrato.status === 'aceito' ? 'bg-green-100 text-green-700' :
            contrato.status === 'recusado' ? 'bg-red-100 text-red-700' :
            contrato.expirado ? 'bg-gray-100 text-gray-600' :
            'bg-blue-100 text-blue-700'
          }`}>
            {contrato.expirado ? 'Expirado' : contrato.status}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div><strong>Serviço:</strong> {contrato.conteudo_json?.servico?.nome || '—'}</div>
          <div><strong>Valor:</strong> {valor}</div>
          <div><strong>Início:</strong> {contrato.data_inicio_servico}</div>
          <div><strong>Fim:</strong> {contrato.data_fim_servico} ({contrato.qtd_dias} dias)</div>
        </div>
      </div>

      {contrato.signed_url && (
        <div className="bg-white rounded-lg shadow mb-4 overflow-hidden">
          <iframe
            src={contrato.signed_url}
            className="w-full"
            style={{ height: '70vh' }}
            title={`Contrato ${contrato.numero}`}
          />
          <div className="p-3 text-center">
            <a
              href={contrato.signed_url}
              download
              className="text-sm text-blue-600 underline"
            >
              📥 Baixar PDF
            </a>
          </div>
        </div>
      )}

      {!jaFinalizado && !contrato.expirado && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-bold text-lg mb-3">Aceite eletrônico</h2>
          <p className="text-sm text-gray-600 mb-4">
            Ao aceitar este contrato, ele passa a ter validade jurídica nos termos da
            <strong> Medida Provisória nº 2.200-2/2001</strong>. Registraremos seu nome, IP e data/hora.
          </p>

          <label className="block text-sm font-medium mb-1">Seu nome completo:</label>
          <input
            type="text" value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Digite seu nome completo"
            className="w-full border rounded px-3 py-2 mb-3"
          />

          <label className="flex items-start gap-2 text-sm mb-4">
            <input
              type="checkbox" checked={concordo} onChange={e => setConcordo(e.target.checked)}
              className="mt-1"
            />
            <span>Li o contrato acima e <strong>concordo</strong> com todas as suas cláusulas.</span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={aceitar} disabled={enviando}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded"
            >
              {enviando ? 'Enviando…' : '✅ Aceitar contrato'}
            </button>
          </div>

          <div className="mt-4 pt-4 border-t">
            <label className="block text-sm font-medium mb-1">Quer recusar?</label>
            <input
              type="text" value={motivoRecusa} onChange={e => setMotivoRecusa(e.target.value)}
              placeholder="Motivo (opcional)"
              className="w-full border rounded px-3 py-2 mb-2 text-sm"
            />
            <button
              onClick={recusar} disabled={enviando}
              className="w-full text-red-600 border border-red-300 hover:bg-red-50 py-2 rounded text-sm"
            >
              Recusar contrato
            </button>
          </div>

          {feedback && <p className="mt-3 text-sm">{feedback}</p>}
        </div>
      )}

      {jaFinalizado && (
        <div className={`rounded-lg p-6 text-center ${
          contrato.status === 'aceito' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          <p className="font-bold text-lg">
            {contrato.status === 'aceito' ? '✅ Contrato aceito' : '❌ Contrato recusado'}
          </p>
          <p className="text-sm mt-1">
            em {(contrato.aceito_em || contrato.recusado_em || '').slice(0, 19).replace('T', ' às ')}
          </p>
        </div>
      )}

      {contrato.expirado && (
        <div className="bg-yellow-50 text-yellow-800 rounded-lg p-6 text-center">
          ⏰ Este link expirou. Entre em contato com a GustPro para reenvio.
        </div>
      )}
    </div>
  )
}
