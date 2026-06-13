'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type Contrato = {
  id: string
  numero: string
  tipo: 'cliente' | 'promotora'
  status: string
  valor_total: number | null
  data_inicio_servico: string | null
  data_fim_servico: string | null
  qtd_dias: number | null
  aceito_em: string | null
  enviado_whatsapp_em: string | null
  created_at: string
  servicos: { nome: string } | null
  clientes: { nome_empresa: string } | null
  promotoras: { nome: string } | null
}

const STATUS_CORES: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-600',
  enviado: 'bg-blue-100 text-blue-700',
  aceito: 'bg-green-100 text-green-700',
  recusado: 'bg-red-100 text-red-700',
  expirado: 'bg-yellow-100 text-yellow-700',
  cancelado: 'bg-gray-200 text-gray-500',
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [carregando, setCarregando] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supa = createSupabaseBrowser()
    supa.from('contratos').select(`
      id, numero, tipo, status, valor_total,
      data_inicio_servico, data_fim_servico, qtd_dias,
      aceito_em, enviado_whatsapp_em, created_at,
      servicos:servico_id ( nome ),
      clientes:cliente_id ( nome_empresa ),
      promotoras:promotora_id ( nome )
    `).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) console.error('[contratos] erro ao listar:', error)
      setContratos((data || []) as unknown as Contrato[])
      setCarregando(false)
    })
  }, [])

  const filtrados = contratos.filter(c =>
    (filtroStatus === 'todos' || c.status === filtroStatus) &&
    (filtroTipo === 'todos' || c.tipo === filtroTipo),
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <Link href="/" className="text-sm text-gray-500">← Início</Link>
            <h1 className="text-2xl font-black text-purple-700 mt-1">📄 Contratos</h1>
            <p className="text-sm text-gray-600">Gerados automaticamente para serviços de 5+ dias.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="flex gap-2 flex-wrap mb-3">
            <span className="text-xs font-semibold text-gray-500 self-center">Tipo:</span>
            {['todos', 'cliente', 'promotora'].map(t => (
              <button key={t} onClick={() => setFiltroTipo(t)}
                className={`text-xs px-3 py-1 rounded-full font-semibold ${
                  filtroTipo === t ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}>{t}</button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 self-center">Status:</span>
            {['todos', 'enviado', 'aceito', 'recusado', 'expirado'].map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)}
                className={`text-xs px-3 py-1 rounded-full font-semibold ${
                  filtroStatus === s ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}>{s}</button>
            ))}
          </div>
        </div>

        {carregando ? (
          <p className="text-center py-8 text-gray-500">Carregando…</p>
        ) : filtrados.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
            Nenhum contrato encontrado.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Número</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Parte</th>
                  <th className="px-3 py-2 text-left">Serviço</th>
                  <th className="px-3 py-2 text-left">Período</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => (
                  <tr key={c.id} onClick={() => router.push(`/contratos/${c.id}`)}
                      className="border-t hover:bg-purple-50 cursor-pointer">
                    <td className="px-3 py-2 font-mono text-purple-700 font-semibold">{c.numero}</td>
                    <td className="px-3 py-2 capitalize">{c.tipo}</td>
                    <td className="px-3 py-2">
                      {c.tipo === 'cliente'
                        ? (c.clientes?.nome_empresa || '—')
                        : (c.promotoras?.nome || '—')}
                    </td>
                    <td className="px-3 py-2">{c.servicos?.nome || '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {c.data_inicio_servico} → {c.data_fim_servico}
                      <span className="text-gray-400"> ({c.qtd_dias}d)</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {c.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CORES[c.status] || 'bg-gray-100'}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
