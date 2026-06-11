'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Promotora = {
  id: string
  nome: string
  whatsapp: string
  cidade: string
  bairro: string
  servicos: string[]
  status: string
  avaliacao_media: number
  total_servicos: number
  instagram: string
}

const STATUS_CORES: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  inativo: 'bg-gray-100 text-gray-500',
  suspenso: 'bg-red-100 text-red-600',
}

export default function Promotoras() {
  const [promotoras, setPromotoras] = useState<Promotora[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroServico, setFiltroServico] = useState('todos')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    buscarPromotoras()
  }, [])

  async function buscarPromotoras() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('promotoras')
      .select('id, nome, whatsapp, cidade, bairro, servicos, status, avaliacao_media, total_servicos, instagram')
      .order('nome')

    if (error) console.error('Erro ao buscar promotoras:', error)
    else setPromotoras(data || [])
    setCarregando(false)
  }

  const filtradas = promotoras.filter(p => {
    const buscaOk = p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.cidade || '').toLowerCase().includes(busca.toLowerCase()) ||
      (p.bairro || '').toLowerCase().includes(busca.toLowerCase())
    const statusOk = filtroStatus === 'todos' || p.status === filtroStatus
    const servicoOk = filtroServico === 'todos' || (p.servicos || []).includes(filtroServico)
    return buscaOk && statusOk && servicoOk
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/80 hover:text-white text-sm">← Início</Link>
            <span className="text-white/40">|</span>
            <h1 className="font-black text-lg">👩 Promotoras</h1>
          </div>
          <Link href="/promotoras/nova" className="bg-white text-red-600 font-bold text-sm px-4 py-2 rounded-xl hover:bg-red-50 transition">
            + Nova
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Busca e filtros */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 space-y-3">
          <input
            type="text"
            placeholder="🔍 Buscar por nome, cidade ou bairro..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-400"
          />
          <div className="flex gap-2 flex-wrap">
            {['todos', 'ativo', 'inativo', 'suspenso'].map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${filtroStatus === s ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                {s === 'todos' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <span className="text-gray-300 mx-1">|</span>
            {['todos', 'repositor', 'demonstrador', 'degustação'].map(s => (
              <button key={s} onClick={() => setFiltroServico(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${filtroServico === s ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200'}`}>
                {s === 'todos' ? 'Todos serviços' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Contador */}
        <p className="text-sm text-gray-500 mb-4">
          {carregando ? 'Carregando...' : `${filtradas.length} promotora${filtradas.length !== 1 ? 's' : ''} encontrada${filtradas.length !== 1 ? 's' : ''}`}
        </p>

        {/* Lista */}
        {carregando ? (
          <div className="text-center py-12 text-gray-400">⏳ Carregando promotoras...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">👩</div>
            <p>Nenhuma promotora encontrada.</p>
            <Link href="/promotoras/nova" className="text-red-600 font-semibold text-sm mt-2 inline-block">+ Cadastrar nova promotora</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtradas.map(p => (
              <Link key={p.id} href={`/promotoras/${p.id}`}
                className="block bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-black text-lg">
                      {p.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{p.nome}</p>
                      <p className="text-xs text-gray-500">{p.bairro ? `${p.bairro}, ` : ''}{p.cidade || '—'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CORES[p.status] || 'bg-gray-100 text-gray-500'}`}>
                      {p.status || 'ativo'}
                    </span>
                    {p.avaliacao_media > 0 && (
                      <span className="text-xs text-yellow-600">⭐ {p.avaliacao_media}</span>
                    )}
                  </div>
                </div>
                {(p.servicos || []).length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {p.servicos.map(s => (
                      <span key={s} className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
