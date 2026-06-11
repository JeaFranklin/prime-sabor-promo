'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Cliente = {
  id: string
  nome_empresa: string
  contato_nome: string
  whatsapp: string
  email: string
  categoria: string
  cidade: string
  estado: string
  status: string
}

const STATUS_CORES: Record<string, string> = {
  ativo: 'bg-green-100 text-green-700',
  inativo: 'bg-gray-100 text-gray-500',
  suspenso: 'bg-red-100 text-red-600',
}

const CATEGORIAS = ['indústria', 'distribuidor', 'varejo', 'evento', 'agência']

const CATEGORIA_ICONES: Record<string, string> = {
  'indústria': '🏭',
  'distribuidor': '🚚',
  'varejo': '🛒',
  'evento': '🎪',
  'agência': '📢',
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    buscarClientes()
  }, [])

  async function buscarClientes() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nome_empresa, contato_nome, whatsapp, email, categoria, cidade, estado, status')
      .order('nome_empresa')
    if (error) console.error('Erro ao buscar clientes:', error)
    else setClientes(data || [])
    setCarregando(false)
  }

  const filtrados = clientes.filter(c => {
    const buscaOk = c.nome_empresa.toLowerCase().includes(busca.toLowerCase()) ||
      (c.contato_nome || '').toLowerCase().includes(busca.toLowerCase()) ||
      (c.cidade || '').toLowerCase().includes(busca.toLowerCase())
    const statusOk = filtroStatus === 'todos' || c.status === filtroStatus
    const categoriaOk = filtroCategoria === 'todos' || c.categoria === filtroCategoria
    return buscaOk && statusOk && categoriaOk
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 text-white px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/80 hover:text-white text-sm">← Início</Link>
            <span className="text-white/40">|</span>
            <h1 className="font-black text-lg">🏢 Clientes</h1>
          </div>
          <Link href="/clientes/novo" className="bg-white text-green-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-green-50 transition">
            + Novo
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Busca e filtros */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 space-y-3">
          <input
            type="text"
            placeholder="🔍 Buscar por empresa, contato ou cidade..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
          />
          <div className="flex gap-2 flex-wrap">
            {['todos', 'ativo', 'inativo', 'suspenso'].map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${filtroStatus === s ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                {s === 'todos' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <span className="text-gray-300 mx-1">|</span>
            {['todos', ...CATEGORIAS].map(c => (
              <button key={c} onClick={() => setFiltroCategoria(c)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${filtroCategoria === c ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-500 border-gray-200'}`}>
                {c === 'todos' ? 'Todas categorias' : `${CATEGORIA_ICONES[c] || ''} ${c.charAt(0).toUpperCase() + c.slice(1)}`}
              </button>
            ))}
          </div>
        </div>

        {/* Contador */}
        <p className="text-sm text-gray-500 mb-4">
          {carregando ? 'Carregando...' : `${filtrados.length} cliente${filtrados.length !== 1 ? 's' : ''} encontrado${filtrados.length !== 1 ? 's' : ''}`}
        </p>

        {/* Lista */}
        {carregando ? (
          <div className="text-center py-12 text-gray-400">⏳ Carregando clientes...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">🏢</div>
            <p>Nenhum cliente encontrado.</p>
            <Link href="/clientes/novo" className="text-green-600 font-semibold text-sm mt-2 inline-block">+ Cadastrar novo cliente</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtrados.map(c => (
              <Link key={c.id} href={`/clientes/${c.id}`}
                className="block bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-black text-lg flex-shrink-0">
                      {CATEGORIA_ICONES[c.categoria] || c.nome_empresa.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{c.nome_empresa}</p>
                      <p className="text-xs text-gray-500">
                        {c.contato_nome ? `${c.contato_nome} · ` : ''}{c.cidade || '—'}{c.estado ? `, ${c.estado}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CORES[c.status] || 'bg-gray-100 text-gray-500'}`}>
                      {c.status || 'ativo'}
                    </span>
                    {c.categoria && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 capitalize">
                        {c.categoria}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
