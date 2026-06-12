'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Servico = {
  id: string
  nome: string
  produto: string | null
  tipo_acao: string | null
  data_inicio: string | null
  data_fim: string | null
  status: string
  num_promotoras: number
  valor_cliente: number | null
  cidade: string | null
  estado: string | null
  clientes: { nome_empresa: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  proposta: 'Proposta',
  negociacao: 'Negociação',
  confirmado: 'Confirmado',
  briefing: 'Briefing',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  faturado: 'Faturado',
  pago: 'Pago',
}

const STATUS_CORES: Record<string, string> = {
  proposta: 'bg-gray-100 text-gray-600',
  negociacao: 'bg-yellow-100 text-yellow-700',
  confirmado: 'bg-blue-100 text-blue-700',
  briefing: 'bg-purple-100 text-purple-700',
  em_andamento: 'bg-orange-100 text-orange-700',
  concluido: 'bg-green-100 text-green-700',
  faturado: 'bg-teal-100 text-teal-700',
  pago: 'bg-emerald-100 text-emerald-700',
}

const TIPO_ICONES: Record<string, string> = {
  degustacao: '🍽️',
  demonstracao: '🎯',
  abordagem: '🗣️',
  sampling: '🎁',
}

export default function Servicos() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    buscarServicos()
  }, [])

  async function buscarServicos() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('servicos')
      .select('id, nome, produto, tipo_acao, data_inicio, data_fim, status, num_promotoras, valor_cliente, cidade, estado, clientes(nome_empresa)')
      .order('created_at', { ascending: false })
    if (error) console.error('Erro ao buscar serviços:', error)
    else setServicos((data as Servico[]) || [])
    setCarregando(false)
  }

  const filtrados = servicos.filter(s => {
    const buscaOk =
      s.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (s.produto || '').toLowerCase().includes(busca.toLowerCase()) ||
      (s.clientes?.nome_empresa || '').toLowerCase().includes(busca.toLowerCase())
    const statusOk = filtroStatus === 'todos' || s.status === filtroStatus
    return buscaOk && statusOk
  })

  function formatarData(d: string | null) {
    if (!d) return '—'
    const [y, m, dia] = d.split('-')
    return `${dia}/${m}/${y}`
  }

  const statuses = ['todos', 'proposta', 'negociacao', 'confirmado', 'briefing', 'em_andamento', 'concluido', 'faturado', 'pago']

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-violet-600 to-purple-500 text-white px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/80 hover:text-white text-sm">← Início</Link>
            <span className="text-white/40">|</span>
            <h1 className="font-black text-lg">🗂️ Serviços</h1>
          </div>
          <Link href="/servicos/novo" className="bg-white text-violet-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-violet-50 transition">
            + Novo
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 space-y-3">
          <input
            type="text"
            placeholder="🔍 Buscar por serviço, produto ou cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-400"
          />
          <div className="flex gap-2 flex-wrap">
            {statuses.map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${filtroStatus === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                {s === 'todos' ? 'Todos' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {carregando ? 'Carregando...' : `${filtrados.length} serviço${filtrados.length !== 1 ? 's' : ''} encontrado${filtrados.length !== 1 ? 's' : ''}`}
        </p>

        {carregando ? (
          <div className="text-center py-12 text-gray-400">⏳ Carregando serviços...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">🗂️</div>
            <p>Nenhum serviço encontrado.</p>
            <Link href="/servicos/novo" className="text-violet-600 font-semibold text-sm mt-2 inline-block">+ Cadastrar novo serviço</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtrados.map(s => (
              <Link key={s.id} href={`/servicos/${s.id}`}
                className="block bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-lg flex-shrink-0">
                      {TIPO_ICONES[s.tipo_acao || ''] || '🗂️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 truncate">{s.nome}</p>
                      <p className="text-xs text-gray-500">
                        {s.clientes?.nome_empresa || 'Sem cliente'}{s.produto ? ` · ${s.produto}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatarData(s.data_inicio)}{s.data_fim ? ` até ${formatarData(s.data_fim)}` : ''}
                        {s.cidade ? ` · ${s.cidade}${s.estado ? `/${s.estado}` : ''}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CORES[s.status] || 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      👥 {s.num_promotoras} promotora{s.num_promotoras !== 1 ? 's' : ''}
                    </span>
                    {s.valor_cliente != null && (
                      <span className="text-xs font-semibold text-emerald-700">
                        R$ {Number(s.valor_cliente).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
