'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Cliente = {
  id: string
  nome_empresa: string
  rua: string | null
  numero: string | null
  bairro: string | null
  cep: string | null
  cidade: string | null
  estado: string | null
  lat: number | null
  lng: number | null
}

type Promotora = {
  id: string
  nome: string
  cidade: string | null
  avaliacao_media: number | null
  lat: number | null
  lng: number | null
  servicos: string[] | null
}

type PromotoraComDistancia = Promotora & { distancia_km: number | null; temExperiencia: boolean }

const TIPOS_ACAO = [
  { value: 'degustacao', label: '🍽️ Degustação' },
  { value: 'demonstracao', label: '🎯 Demonstração' },
  { value: 'abordagem', label: '🗣️ Abordagem' },
  { value: 'sampling', label: '🎁 Sampling' },
  { value: 'repositor', label: '📦 Repositor' },
]

const STATUS_INICIAL = [
  { value: 'proposta', label: 'Proposta' },
  { value: 'negociacao', label: 'Negociação' },
  { value: 'confirmado', label: 'Confirmado' },
]

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function geocodificar(endereco: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}&limit=1&countrycodes=br`
    const res = await fetch(url, { headers: { 'User-Agent': 'GustPro/1.0', 'Accept-Language': 'pt-BR' } })
    const data = await res.json()
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { /* ignora */ }
  return null
}

export default function NovoServico() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [promotoras, setPromotoras] = useState<Promotora[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [etapa, setEtapa] = useState(1)

  // Geolocalização do serviço
  const [servicoLat, setServicoLat] = useState<number | null>(null)
  const [servicoLng, setServicoLng] = useState<number | null>(null)
  const [geocodificando, setGeocodificando] = useState(false)

  const [form, setForm] = useState({
    nome: '',
    cliente_id: '',
    produto: '',
    tipo_acao: 'degustacao',
    data_inicio: '',
    data_fim: '',
    horario_inicio: '',
    horario_fim: '',
    horario_alternado: false,
    horario_inicio_2: '',
    horario_fim_2: '',
    descanso_duracao: '',
    descanso_inicio_min: '',
    mesmo_endereco_cliente: false,
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
    status: 'proposta',
    observacoes: '',
  })

  const [escala, setEscala] = useState<{ promotora_id: string; is_lider: boolean; is_reserva: boolean; valor_diaria: string }[]>([])
  const [promotoraFiltro, setPromotoraFiltro] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('id, nome_empresa, rua, numero, bairro, cep, cidade, estado, lat, lng').order('nome_empresa'),
      supabase.from('promotoras').select('id, nome, cidade, avaliacao_media, lat, lng, servicos').eq('status', 'ativa').order('nome'),
    ]).then(([c, p]) => {
      setClientes((c.data as Cliente[]) || [])
      setPromotoras(p.data || [])
    })
  }, [])

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

  function usarEnderecoCliente() {
    const cliente = clientes.find(c => c.id === form.cliente_id)
    if (!cliente) return
    setForm(f => ({
      ...f,
      rua: cliente.rua || '',
      numero: cliente.numero || '',
      bairro: cliente.bairro || '',
      cep: cliente.cep || '',
      cidade: cliente.cidade || '',
      estado: cliente.estado || '',
      mesmo_endereco_cliente: true,
    }))
    if (cliente.lat && cliente.lng) {
      setServicoLat(cliente.lat)
      setServicoLng(cliente.lng)
    }
  }

  async function obterGeolocalizacao() {
    const partes = [form.rua, form.numero, form.bairro, form.cidade, form.estado, 'Brasil'].filter(Boolean).join(', ')
    if (!partes.trim()) return
    setGeocodificando(true)
    const geo = await geocodificar(partes)
    if (geo) {
      setServicoLat(geo.lat)
      setServicoLng(geo.lng)
    }
    setGeocodificando(false)
  }

  // Promotoras ordenadas por distância ao serviço + match de tipo
  const promotorasOrdenadas: PromotoraComDistancia[] = promotoras.map(p => {
    const distancia_km = (servicoLat && servicoLng && p.lat && p.lng)
      ? haversineKm(servicoLat, servicoLng, p.lat, p.lng)
      : null
    const temExperiencia = (p.servicos || []).some(s => s.toLowerCase().includes(form.tipo_acao.toLowerCase())) ||
      (p.servicos || []).some(s => form.tipo_acao.toLowerCase().includes(s.toLowerCase()))
    return { ...p, distancia_km, temExperiencia }
  }).sort((a, b) => {
    // Com coordenadas: ordena por distância. Sem: mantém ordem original
    if (a.distancia_km !== null && b.distancia_km !== null) return a.distancia_km - b.distancia_km
    if (a.distancia_km !== null) return -1
    if (b.distancia_km !== null) return 1
    return 0
  })

  function adicionarPromotora(id: string) {
    if (escala.find(e => e.promotora_id === id)) return
    setEscala(prev => [...prev, { promotora_id: id, is_lider: false, is_reserva: false, valor_diaria: form.valor_diaria }])
  }

  function removerPromotora(id: string) {
    setEscala(prev => prev.filter(e => e.promotora_id !== id))
  }

  function toggleLider(id: string) {
    setEscala(prev => prev.map(e => ({ ...e, is_lider: e.promotora_id === id ? !e.is_lider : false })))
  }

  function toggleReserva(id: string) {
    setEscala(prev => prev.map(e => e.promotora_id === id ? { ...e, is_reserva: !e.is_reserva } : e))
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
        horario_alternado: form.horario_alternado,
        horario_inicio_2: form.horario_alternado ? (form.horario_inicio_2 || null) : null,
        horario_fim_2: form.horario_alternado ? (form.horario_fim_2 || null) : null,
        descanso_duracao: form.descanso_duracao ? Number(form.descanso_duracao) : null,
        descanso_inicio_min: form.descanso_inicio_min ? Number(form.descanso_inicio_min) : null,
        mesmo_endereco_cliente: form.mesmo_endereco_cliente,
        cep: form.cep.trim() || null,
        rua: form.rua.trim() || null,
        numero: form.numero.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado.trim() || null,
        lat: servicoLat,
        lng: servicoLng,
        responsavel_local_nome: form.responsavel_local_nome.trim() || null,
        responsavel_local_contato: form.responsavel_local_contato.trim() || null,
        num_promotoras: Number(form.num_promotoras) || 1,
        valor_cliente: form.valor_cliente ? Number(form.valor_cliente) : null,
        valor_diaria: form.valor_diaria ? Number(form.valor_diaria) : null,
        status: form.status,
        observacoes: form.observacoes.trim() || null,
      }

      const { data: novo, error } = await supabase.from('servicos').insert(payload).select('id').single()
      if (error) throw error

      if (escala.length > 0) {
        const escalaPayload = escala.map(e => ({
          servico_id: novo.id,
          promotora_id: e.promotora_id,
          is_lider: e.is_lider,
          is_reserva: e.is_reserva,
          valor_diaria: e.valor_diaria ? Number(e.valor_diaria) : null,
          status_confirmacao: 'pendente',
          status_pagamento: 'pendente',
        }))
        const { error: erroEscala } = await supabase.from('escala').insert(escalaPayload)
        if (erroEscala) console.error('Erro ao salvar escala:', erroEscala)
      }

      router.push(`/servicos/${novo.id}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setErro('Erro ao salvar: ' + msg)
      console.error(e)
    } finally {
      setSalvando(false)
    }
  }

  const promotorasNaoEscaladas = promotorasOrdenadas.filter(p =>
    !escala.find(e => e.promotora_id === p.id) &&
    (p.nome.toLowerCase().includes(promotoraFiltro.toLowerCase()) ||
      (p.cidade || '').toLowerCase().includes(promotoraFiltro.toLowerCase()))
  )

  const clienteSelecionado = clientes.find(c => c.id === form.cliente_id)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-violet-600 to-purple-500 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/servicos" className="text-white/80 hover:text-white text-sm">← Serviços</Link>
            <span className="text-white/40">|</span>
            <h1 className="font-black text-lg">🗂️ Novo Serviço</h1>
          </div>
        </div>
      </div>

      {/* Etapas */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex gap-2 mb-6">
          {[
            { n: 1, label: 'Dados' },
            { n: 2, label: 'Local' },
            { n: 3, label: 'Escala' },
            { n: 4, label: 'Financeiro' },
          ].map(e => (
            <button key={e.n} onClick={() => setEtapa(e.n)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${etapa === e.n ? 'bg-violet-600 text-white' : 'bg-white text-gray-400 border border-gray-200'}`}>
              {e.n}. {e.label}
            </button>
          ))}
        </div>

        {/* ETAPA 1 — Dados do serviço */}
        {etapa === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <h2 className="font-bold text-gray-700">📋 Dados do Serviço</h2>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Nome do Serviço *</label>
                <input value={form.nome} onChange={e => set('nome', e.target.value)}
                  placeholder='Ex: Ação Iogurte Nestlé — Supermercado Norte — Jun/2026'
                  className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Cliente</label>
                <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}
                  className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 bg-white">
                  <option value="">— Selecionar cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_empresa}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Produto / Marca</label>
                <input value={form.produto} onChange={e => set('produto', e.target.value)}
                  placeholder='Ex: Iogurte Nestlé Morango'
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

              {/* Horários — 1º turno */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  {form.horario_alternado ? '🕐 Turno 1' : '🕐 Horário do Serviço'}
                </label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <input type="time" value={form.horario_inicio} onChange={e => set('horario_inicio', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
                  <input type="time" value={form.horario_fim} onChange={e => set('horario_fim', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
                </div>
                <p className="text-xs text-gray-400 mt-1">Entrada · Saída</p>
              </div>

              {/* Toggle: horário alternado */}
              <button onClick={() => set('horario_alternado', !form.horario_alternado)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition text-sm font-semibold ${form.horario_alternado ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                <span>🔁 Serviço tem horário alternado (2 turnos)?</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${form.horario_alternado ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {form.horario_alternado ? 'SIM' : 'NÃO'}
                </span>
              </button>

              {/* Turno 2 */}
              {form.horario_alternado && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">🕐 Turno 2</label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <input type="time" value={form.horario_inicio_2} onChange={e => set('horario_inicio_2', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
                    <input type="time" value={form.horario_fim_2} onChange={e => set('horario_fim_2', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Entrada · Saída do 2º turno</p>
                </div>
              )}

              {/* Descanso */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-blue-700">☕ Tempo de Descanso</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Duração (minutos)</label>
                    <input type="number" min={0} value={form.descanso_duracao} onChange={e => set('descanso_duracao', e.target.value)}
                      placeholder='Ex: 60'
                      className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Começa após (min. de início)</label>
                    <input type="number" min={0} value={form.descanso_inicio_min} onChange={e => set('descanso_inicio_min', e.target.value)}
                      placeholder='Ex: 240'
                      className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400 bg-white" />
                  </div>
                </div>
                <p className="text-xs text-blue-500">
                  Ex: descanso de 60 min começando 240 min (4h) após o início do serviço.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Status Inicial</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {STATUS_INICIAL.map(s => (
                    <button key={s.value} onClick={() => set('status', s.value)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${form.status === s.value ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Observações</label>
                <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
                  rows={3} placeholder='Informações adicionais sobre o serviço...'
                  className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 resize-none" />
              </div>
            </div>

            <button onClick={() => setEtapa(2)}
              className="w-full bg-violet-600 text-white font-bold py-3 rounded-xl hover:bg-violet-700 transition">
              Próximo: Local →
            </button>
          </div>
        )}

        {/* ETAPA 2 — Local */}
        {etapa === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <h2 className="font-bold text-gray-700">📍 Local do Serviço</h2>

              {/* Toggle: mesmo endereço do cliente */}
              {clienteSelecionado && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🏢</div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-700">O serviço é no endereço do cliente?</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[clienteSelecionado.rua, clienteSelecionado.numero, clienteSelecionado.bairro, clienteSelecionado.cidade, clienteSelecionado.estado].filter(Boolean).join(', ') || 'Endereço não cadastrado no cliente'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={usarEnderecoCliente}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border transition ${form.mesmo_endereco_cliente ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-green-50'}`}>
                      ✅ Sim, usar o mesmo
                    </button>
                    <button
                      onClick={() => set('mesmo_endereco_cliente', false)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border transition ${!form.mesmo_endereco_cliente ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300 hover:bg-orange-50'}`}>
                      📍 Não, é outro local
                    </button>
                  </div>
                </div>
              )}

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

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Bairro</label>
                <input value={form.bairro} onChange={e => set('bairro', e.target.value)}
                  className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
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
                    placeholder='SP'
                    className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 uppercase" />
                </div>
              </div>

              {/* Geolocalização */}
              <div className="flex items-center gap-3">
                <button onClick={obterGeolocalizacao} disabled={geocodificando || !form.rua}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-40">
                  {geocodificando ? '⏳ Localizando...' : '🗺️ Obter Geolocalização'}
                </button>
                {servicoLat && servicoLng && (
                  <div className="text-xs text-green-600 font-semibold">
                    ✅ Localização obtida
                  </div>
                )}
              </div>
              {servicoLat && servicoLng && (
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xs text-green-700 font-semibold">📌 Coordenadas salvas: {servicoLat.toFixed(4)}, {servicoLng.toFixed(4)}</p>
                  <p className="text-xs text-green-600 mt-0.5">As promotoras serão ordenadas por distância a este ponto na etapa de escala.</p>
                </div>
              )}

              <hr className="border-gray-100" />
              <h3 className="font-bold text-gray-600 text-sm">👤 Responsável no Local</h3>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Nome do Responsável</label>
                <input value={form.responsavel_local_nome} onChange={e => set('responsavel_local_nome', e.target.value)}
                  placeholder='Ex: João — Gerente'
                  className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Contato (WhatsApp / Telefone)</label>
                <input value={form.responsavel_local_contato} onChange={e => set('responsavel_local_contato', e.target.value)}
                  placeholder='(00) 00000-0000'
                  className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEtapa(1)} className="flex-1 border border-gray-300 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition">
                ← Voltar
              </button>
              <button onClick={() => setEtapa(3)} className="flex-1 bg-violet-600 text-white font-bold py-3 rounded-xl hover:bg-violet-700 transition">
                Próximo: Escala →
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 3 — Escala */}
        {etapa === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-700">👥 Escala de Promotoras</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Nº:</span>
                  <input type="number" min={1} value={form.num_promotoras}
                    onChange={e => set('num_promotoras', parseInt(e.target.value) || 1)}
                    className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-violet-400" />
                </div>
              </div>

              {servicoLat ? (
                <div className="bg-violet-50 rounded-xl px-3 py-2">
                  <p className="text-xs text-violet-700 font-semibold">📍 Sugerindo por proximidade ao local do serviço · Tipo: {form.tipo_acao}</p>
                </div>
              ) : (
                <div className="bg-yellow-50 rounded-xl px-3 py-2">
                  <p className="text-xs text-yellow-700">💡 Obtenha a geolocalização no passo "Local" para ver as promotoras mais próximas em ordem de distância.</p>
                </div>
              )}

              {/* Promotoras já na escala */}
              {escala.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Escaladas ({escala.length}/{form.num_promotoras})</p>
                  {escala.map(e => {
                    const p = promotorasOrdenadas.find(x => x.id === e.promotora_id)
                    return (
                      <div key={e.promotora_id} className="flex items-center gap-2 bg-violet-50 rounded-xl p-3">
                        <div className="w-8 h-8 bg-violet-200 rounded-full flex items-center justify-center text-violet-700 font-bold text-sm flex-shrink-0">
                          {p?.nome.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-semibold text-gray-800 truncate">{p?.nome}</p>
                            {p?.temExperiencia && <span className="text-xs text-green-600">✔ experiência</span>}
                          </div>
                          <p className="text-xs text-gray-500">
                            {p?.cidade || '—'}
                            {p?.distancia_km != null ? ` · 📍 ${p.distancia_km.toFixed(1)} km` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleLider(e.promotora_id)}
                            className={`text-xs px-2 py-1 rounded-lg font-semibold transition ${e.is_lider ? 'bg-yellow-400 text-yellow-900' : 'bg-white border border-gray-200 text-gray-500'}`}>
                            👑
                          </button>
                          <button onClick={() => toggleReserva(e.promotora_id)}
                            className={`text-xs px-2 py-1 rounded-lg font-semibold transition ${e.is_reserva ? 'bg-orange-200 text-orange-800' : 'bg-white border border-gray-200 text-gray-500'}`}>
                            🔄
                          </button>
                          <button onClick={() => removerPromotora(e.promotora_id)}
                            className="text-xs px-2 py-1 rounded-lg bg-white border border-gray-200 text-red-400 hover:bg-red-50 transition">
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  <p className="text-xs text-gray-400">👑 = Líder &nbsp;|&nbsp; 🔄 = Reserva</p>
                </div>
              )}

              {/* Buscar promotoras */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  {servicoLat ? '📍 Mais próximas primeiro' : 'Adicionar Promotora'}
                </p>
                <input
                  value={promotoraFiltro}
                  onChange={e => setPromotoraFiltro(e.target.value)}
                  placeholder='🔍 Buscar por nome ou cidade...'
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-400 mb-2" />
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {promotorasNaoEscaladas.slice(0, 20).map(p => (
                    <button key={p.id} onClick={() => adicionarPromotora(p.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left ${p.temExperiencia ? 'hover:bg-green-50' : 'hover:bg-violet-50'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${p.temExperiencia ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.nome.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-semibold text-gray-700 truncate">{p.nome}</p>
                          {p.temExperiencia && <span className="text-xs text-green-600 flex-shrink-0">✔</span>}
                        </div>
                        <p className="text-xs text-gray-400">
                          {p.cidade || '—'}
                          {p.distancia_km != null ? ` · 📍 ${p.distancia_km.toFixed(1)} km` : ''}
                          {p.avaliacao_media ? ` · ⭐ ${p.avaliacao_media}` : ''}
                        </p>
                      </div>
                      <span className="text-violet-500 text-xs font-bold flex-shrink-0">+ Add</span>
                    </button>
                  ))}
                </div>
                {servicoLat && (
                  <p className="text-xs text-gray-400 mt-2">✔ verde = tem experiência com {form.tipo_acao}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setEtapa(2)} className="flex-1 border border-gray-300 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition">
                ← Voltar
              </button>
              <button onClick={() => setEtapa(4)} className="flex-1 bg-violet-600 text-white font-bold py-3 rounded-xl hover:bg-violet-700 transition">
                Próximo: Financeiro →
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 4 — Financeiro */}
        {etapa === 4 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <h2 className="font-bold text-gray-700">💰 Dados Financeiros</h2>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Valor Total cobrado do Cliente (R$)</label>
                <input type="number" step="0.01" min="0" value={form.valor_cliente}
                  onChange={e => set('valor_cliente', e.target.value)}
                  placeholder='0,00'
                  className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Valor da Diária por Promotora (R$)</label>
                <input type="number" step="0.01" min="0" value={form.valor_diaria}
                  onChange={e => set('valor_diaria', e.target.value)}
                  placeholder='0,00'
                  className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400" />
              </div>

              {form.valor_cliente && form.valor_diaria && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Resumo estimado</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Valor do cliente</span>
                    <span className="font-semibold text-gray-800">R$ {Number(form.valor_cliente).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {escala.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Custo promotoras ({escala.length} × R$ {Number(form.valor_diaria).toFixed(2)})</span>
                      <span className="font-semibold text-red-600">- R$ {(escala.length * Number(form.valor_diaria)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {escala.length > 0 && (
                    <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                      <span className="font-bold text-gray-700">Margem estimada</span>
                      <span className={`font-bold ${Number(form.valor_cliente) - escala.length * Number(form.valor_diaria) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        R$ {(Number(form.valor_cliente) - escala.length * Number(form.valor_diaria)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        {' '}({Math.round((Number(form.valor_cliente) - escala.length * Number(form.valor_diaria)) / Number(form.valor_cliente) * 100)}%)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{erro}</div>
            )}

            <div className="flex gap-3 pb-8">
              <button onClick={() => setEtapa(3)} className="flex-1 border border-gray-300 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition">
                ← Voltar
              </button>
              <button onClick={salvar} disabled={salvando}
                className="flex-1 bg-violet-600 text-white font-bold py-3 rounded-xl hover:bg-violet-700 transition disabled:opacity-50">
                {salvando ? '⏳ Salvando...' : '✅ Salvar Serviço'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
