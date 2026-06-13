'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Cliente = { id: string; nome_empresa: string }

const TIPOS_ACAO = [
  { value: 'degustacao', label: '🍽️ Degustação' },
  { value: 'demonstracao', label: '🎯 Demonstração' },
  { value: 'abordagem', label: '🗣️ Abordagem' },
  { value: 'sampling', label: '🎁 Sampling' },
]

const STATUSES = [
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'faturado', label: 'Faturado' },
  { value: 'pago', label: 'Pago' },
]

export default function EditarServico() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    nome: '',
    cliente_id: '',
    produto: '',
    tipo_acao: 'degustacao',
    data_inicio: '',
    data_fim: '',
    horario_inicio: '',
    horario_fim: '',
    cep: '',
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    responsavel_local_nome: '',
    responsavel_local_contato: '',
    num_promotoras: 1,
    valor_cliente: '',
    valor_diaria: '',
    tem_sinal: false,
    sinal_pct: '50',
    prazo_pagamento_dias: '30',
    data_emissao_nf: '',
    status: 'proposta',
    observacoes: '',
  })

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('id, nome_empresa').order('nome_empresa'),
      supabase.from('servicos').select('*').eq('id', id).single(),
    ]).then(([{ data: c }, { data: s }]) => {
      setClientes(c || [])
      if (s) {
        setForm({
          nome: s.nome || '',
          cliente_id: s.cliente_id || '',
          produto: s.produto || '',
          tipo_acao: s.tipo_acao || 'degustacao',
          data_inicio: s.data_inicio || '',
          data_fim: s.data_fim || '',
          horario_inicio: s.horario_inicio || '',
          horario_fim: s.horario_fim || '',
          cep: s.cep || '',
          rua: s.rua || '',
          numero: s.numero || '',
          bairro: s.bairro || '',
          cidade: s.cidade || '',
          estado: s.estado || '',
          responsavel_local_nome: s.responsavel_local_nome || '',
          responsavel_local_contato: s.responsavel_local_contato || '',
          num_promotoras: s.num_promotoras || 1,
          valor_cliente: s.valor_cliente != null ? String(s.valor_cliente) : '',
          valor_diaria: s.valor_diaria != null ? String(s.valor_diaria) : '',
          tem_sinal: s.tem_sinal ?? false,
          sinal_pct: s.sinal_pct != null ? String(s.sinal_pct) : '50',
          prazo_pagamento_dias: s.prazo_pagamento_dias != null ? String(s.prazo_pagamento_dias) : '30',
          data_emissao_nf: s.data_emissao_nf || '',
          status: s.status || 'proposta',
          observacoes: s.observacoes || '',
        })
      }
      setCarregando(false)
    })
  }, [id])

  function set(field: string, value: string | number | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function buscarCEP(cep: string) {
    const n = cep.replace(/\D/g, '')
    if (n.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${n}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setForm(f => ({ ...f, rua: data.logradouro || f.rua, bairro: data.bairro || f.bairro, cidade: data.localidade || f.cidade, estado: data.uf || f.estado }))
      }
    } catch { /* ignora */ }
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('O nome do serviço é obrigatório.'); return }
    setSalvando(true)
    setErro('')
    try {
      const payload = {
        nome: form.nome.trim(),
        cliente_id: form.cliente_id || null,
        produto: form.produto.trim() || null,
        tipo_acao: form.tipo_acao || null,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        horario_inicio: form.horario_inicio || null,
        horario_fim: form.horario_fim || null,
        cep: form.cep.trim() || null,
        rua: form.rua.trim() || null,
        numero: form.numero.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado.trim() || null,
        responsavel_local_nome: form.responsavel_local_nome.trim() || null,
        responsavel_local_contato: form.responsavel_local_contato.trim() || null,
        num_promotoras: Number(form.num_promotoras) || 1,
        valor_cliente: form.valor_cliente ? Number(form.valor_cliente) : null,
        valor_diaria: form.valor_diaria ? Number(form.valor_diaria) : null,
        tem_sinal: form.tem_sinal,
        sinal_pct: form.tem_sinal && form.sinal_pct ? Number(form.sinal_pct) : 0,
        prazo_pagamento_dias: form.prazo_pagamento_dias ? Number(form.prazo_pagamento_dias) : 30,
        data_emissao_nf: form.data_emissao_nf || null,
        status: form.status,
        observacoes: form.observacoes.trim() || null,
      }

      const { error } = await supabase.from('servicos').update(payload).eq('id', id)
      if (error) throw error
      router.push(`/servicos/${id}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setErro('Erro ao salvar: ' + msg)
      console.error(e)
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">⏳ Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-violet-600 to-purple-500 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/servicos/${id}`} className="text-white/80 hover:text-white text-sm">← Voltar</Link>
            <span className="text-white/40">|</span>
            <h1 className="font-black text-lg">✏️ Editar Serviço</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Dados principais */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-700">📋 Dados do Serviço</h2>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Nome do Serviço *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Cliente</label>
            <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 bg-white">
              <option value="">— Selecionar —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_empresa}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Produto / Marca</label>
            <input value={form.produto} onChange={e => set('produto', e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Tipo de Ação</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {TIPOS_ACAO.map(t => (
                <button key={t.value} onClick={() => set('tipo_acao', t.value)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition ${form.tipo_acao === t.value ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Data Início</label>
              <input type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)}
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Data Fim</label>
              <input type="date" value={form.data_fim} onChange={e => set('data_fim', e.target.value)}
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Horário Início</label>
              <input type="time" value={form.horario_inicio} onChange={e => set('horario_inicio', e.target.value)}
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Horário Fim</label>
              <input type="time" value={form.horario_fim} onChange={e => set('horario_fim', e.target.value)}
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 bg-white">
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Local */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-700">📍 Local</h2>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">CEP</label>
            <input value={form.cep} onChange={e => { set('cep', e.target.value); buscarCEP(e.target.value) }}
              placeholder='00000-000'
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">Rua / Avenida</label>
              <input value={form.rua} onChange={e => set('rua', e.target.value)}
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Número</label>
              <input value={form.numero} onChange={e => set('numero', e.target.value)}
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">Cidade</label>
              <input value={form.cidade} onChange={e => set('cidade', e.target.value)}
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Estado</label>
              <input value={form.estado} onChange={e => set('estado', e.target.value)} maxLength={2}
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 uppercase" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Responsável no Local</label>
            <input value={form.responsavel_local_nome} onChange={e => set('responsavel_local_nome', e.target.value)}
              placeholder='Nome'
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Contato do Responsável</label>
            <input value={form.responsavel_local_contato} onChange={e => set('responsavel_local_contato', e.target.value)}
              placeholder='WhatsApp / Telefone'
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
          </div>
        </div>

        {/* Financeiro */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-700">💰 Financeiro</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Valor do Cliente (R$)</label>
              <input type="number" step="0.01" min="0" value={form.valor_cliente}
                onChange={e => set('valor_cliente', e.target.value)}
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Diária por Promotora (R$)</label>
              <input type="number" step="0.01" min="0" value={form.valor_diaria}
                onChange={e => set('valor_diaria', e.target.value)}
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Nº de Promotoras</label>
            <input type="number" min={1} value={form.num_promotoras}
              onChange={e => set('num_promotoras', parseInt(e.target.value) || 1)}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
          </div>

          {/* FORMA DE PAGAMENTO */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-700">💳 Forma de Pagamento</h3>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.tem_sinal}
                onChange={e => set('tem_sinal', e.target.checked)}
                className="w-4 h-4" />
              <span>Cliente paga <strong>sinal</strong> na assinatura do contrato</span>
            </label>

            {form.tem_sinal && (
              <div className="ml-6">
                <label className="text-xs font-semibold text-gray-500 uppercase">% do Sinal</label>
                <input type="number" min="0" max="100" step="1" value={form.sinal_pct}
                  onChange={e => set('sinal_pct', e.target.value)}
                  className="w-32 mt-1 border border-gray-200 rounded-xl px-4 py-2 text-sm" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Prazo Cliente (dias após NF)</label>
                <input type="number" min="0" step="1" value={form.prazo_pagamento_dias}
                  onChange={e => set('prazo_pagamento_dias', e.target.value)}
                  placeholder="30"
                  className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Data Prevista Emissão NF</label>
                <input type="date" value={form.data_emissao_nf}
                  onChange={e => set('data_emissao_nf', e.target.value)}
                  className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2 text-sm" />
              </div>
            </div>

            <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs text-violet-700">
              💡 A promotora recebe automaticamente <strong>5 dias após o vencimento do cliente</strong> (ajustado para o próximo dia útil).
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Observações</label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
              rows={3}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 resize-none" />
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{erro}</div>
        )}

        <div className="flex gap-3 pb-8">
          <Link href={`/servicos/${id}`}
            className="flex-1 text-center border border-gray-300 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition">
            Cancelar
          </Link>
          <button onClick={salvar} disabled={salvando}
            className="flex-1 bg-violet-600 text-white font-bold py-3 rounded-xl hover:bg-violet-700 transition disabled:opacity-50">
            {salvando ? '⏳ Salvando...' : '💾 Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
