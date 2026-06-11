'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const CATEGORIAS = ['indústria', 'distribuidor', 'varejo', 'evento', 'agência']

type Contato = {
  nome: string
  cargo: string
  whatsapp: string
  email: string
  recebe_notificacao: boolean
}

function validarCNPJ(cnpj: string): boolean {
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  let soma = 0, peso = 2
  for (let i = 11; i >= 0; i--) { soma += parseInt(c[i]) * peso; peso = peso === 9 ? 2 : peso + 1 }
  let r = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  if (r !== parseInt(c[12])) return false
  soma = 0; peso = 2
  for (let i = 12; i >= 0; i--) { soma += parseInt(c[i]) * peso; peso = peso === 9 ? 2 : peso + 1 }
  r = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  return r === parseInt(c[13])
}

function formatarCNPJ(v: string): string {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

const contatoVazio = (): Contato => ({ nome: '', cargo: '', whatsapp: '', email: '', recebe_notificacao: true })

export default function NovoCliente() {
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [cnpjErro, setCnpjErro] = useState('')
  const [geocodificando, setGeocodificando] = useState(false)
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null)
  const [contatos, setContatos] = useState<Contato[]>([contatoVazio()])
  const [form, setForm] = useState({
    nome_empresa: '',
    cnpj: '',
    inscricao_estadual: '',
    categoria: '',
    site: '',
    instagram: '',
    linkedin: '',
    facebook: '',
    rua: '',
    numero: '',
    bairro: '',
    cep: '',
    cidade: '',
    estado: '',
    observacoes: '',
  })

  function atualizar(campo: string, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function handleCNPJ(v: string) {
    const f = formatarCNPJ(v)
    atualizar('cnpj', f)
    const n = f.replace(/\D/g, '')
    if (n.length === 14) setCnpjErro(validarCNPJ(n) ? '' : '❌ CNPJ inválido.')
    else setCnpjErro('')
  }

  function atualizarContato(idx: number, campo: keyof Contato, valor: string | boolean) {
    setContatos(prev => prev.map((c, i) => i === idx ? { ...c, [campo]: valor } : c))
  }

  function adicionarContato() {
    setContatos(prev => [...prev, contatoVazio()])
  }

  function removerContato(idx: number) {
    if (contatos.length === 1) return
    setContatos(prev => prev.filter((_, i) => i !== idx))
  }

  async function geocodificar() {
    const { rua, numero, bairro, cidade, estado } = form
    if (!rua || !cidade) { setErro('Preencha Rua e Cidade para buscar a localização.'); return }
    setGeocodificando(true)
    setErro('')
    const q = `${rua}, ${numero}, ${bairro}, ${cidade}, ${estado}, Brasil`
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, { headers: { 'Accept-Language': 'pt-BR' } })
      const data = await res.json()
      if (data.length > 0) setCoordenadas({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
      else setErro('⚠️ Endereço não encontrado. Verifique os dados.')
    } catch { setErro('Erro ao buscar localização.') }
    setGeocodificando(false)
  }

  async function salvar() {
    if (!form.nome_empresa.trim()) { setErro('Nome da empresa é obrigatório.'); return }
    if (form.cnpj && !validarCNPJ(form.cnpj.replace(/\D/g, ''))) { setErro('CNPJ inválido.'); return }
    if (!form.categoria) { setErro('Selecione uma categoria.'); return }
    if (contatos.some(c => !c.nome.trim())) { setErro('Preencha o nome de todos os contatos.'); return }

    setSalvando(true)
    setErro('')

    const { data, error } = await supabase.from('clientes').insert({
      ...form,
      lat: coordenadas?.lat || null,
      lng: coordenadas?.lng || null,
      status: 'ativo',
    }).select('id').single()

    if (error) { setSalvando(false); setErro('Erro ao salvar: ' + error.message); return }

    const clienteId = data.id
    if (contatos.filter(c => c.nome.trim()).length > 0) {
      await supabase.from('contatos_cliente').insert(
        contatos.filter(c => c.nome.trim()).map(c => ({ ...c, cliente_id: clienteId }))
      )
    }

    setSalvando(false)
    router.push('/clientes')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/clientes" className="text-white/80 hover:text-white text-sm">← Voltar</Link>
          <span className="text-white/40">|</span>
          <h1 className="font-black text-lg">🏢 Novo Cliente — GustPro</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Dados da empresa */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">🏢 Dados da Empresa</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome da Empresa *</label>
              <input value={form.nome_empresa} onChange={e => atualizar('nome_empresa', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                placeholder="Ex: Nestlé Brasil Ltda" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">CNPJ</label>
                <input value={form.cnpj} onChange={e => handleCNPJ(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-2 text-sm focus:outline-none ${cnpjErro ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-green-400'}`}
                  placeholder="00.000.000/0000-00" maxLength={18} />
                {cnpjErro && <p className="text-xs text-red-500 mt-1">{cnpjErro}</p>}
                {form.cnpj.replace(/\D/g, '').length === 14 && !cnpjErro && <p className="text-xs text-green-600 mt-1">✅ CNPJ válido</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Inscrição Estadual</label>
                <input value={form.inscricao_estadual} onChange={e => atualizar('inscricao_estadual', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                  placeholder="000.000.000.000" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Categoria *</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIAS.map(cat => (
                  <button key={cat} type="button" onClick={() => atualizar('categoria', cat)}
                    className={`px-4 py-2 rounded-xl border-2 font-semibold text-sm transition capitalize ${form.categoria === cat ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>
                    {cat === 'indústria' ? '🏭' : cat === 'distribuidor' ? '🚚' : cat === 'varejo' ? '🛒' : cat === 'evento' ? '🎪' : '📢'} {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Site</label>
              <input value={form.site} onChange={e => atualizar('site', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                placeholder="www.empresa.com.br" />
            </div>
          </div>
        </div>

        {/* Redes sociais */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">📱 Redes Sociais</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">📸 Instagram</label>
              <input value={form.instagram} onChange={e => atualizar('instagram', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                placeholder="@empresa" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">💼 LinkedIn</label>
              <input value={form.linkedin} onChange={e => atualizar('linkedin', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                placeholder="linkedin.com/company/empresa" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">📘 Facebook</label>
              <input value={form.facebook} onChange={e => atualizar('facebook', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                placeholder="facebook.com/empresa" />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-1">📍 Endereço do Estabelecimento</h2>
          <p className="text-xs text-gray-400 mb-4">As promotoras usam este endereço para chegar ao local do serviço.</p>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Rua</label>
                <input value={form.rua} onChange={e => atualizar('rua', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                  placeholder="Nome da rua / avenida" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Número</label>
                <input value={form.numero} onChange={e => atualizar('numero', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                  placeholder="Nº" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Bairro</label>
                <input value={form.bairro} onChange={e => atualizar('bairro', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                  placeholder="Bairro" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">CEP</label>
                <input value={form.cep} onChange={e => atualizar('cep', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                  placeholder="00000-000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Cidade</label>
                <input value={form.cidade} onChange={e => atualizar('cidade', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                  placeholder="Goiânia" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Estado</label>
                <input value={form.estado} onChange={e => atualizar('estado', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                  placeholder="GO" maxLength={2} />
              </div>
            </div>
            <button type="button" onClick={geocodificar} disabled={geocodificando}
              className="w-full border-2 border-dashed border-blue-300 text-blue-600 font-semibold text-sm py-2 rounded-xl hover:bg-blue-50 transition disabled:opacity-50">
              {geocodificando ? '⏳ Buscando localização...' : '🗺️ Obter Geolocalização do Endereço'}
            </button>
            {coordenadas && (
              <p className="text-xs text-green-600 text-center font-semibold">
                ✅ Localização obtida! As promotoras conseguirão navegar até aqui pelo Google Maps.
              </p>
            )}
          </div>
        </div>

        {/* Contatos */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-gray-700">👥 Contatos da Empresa</h2>
            <button type="button" onClick={adicionarContato}
              className="bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-green-100 transition">
              + Adicionar contato
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Cada contato marcado com 💬 receberá notificação via WhatsApp quando um serviço for agendado nesta empresa.
          </p>
          <div className="space-y-4">
            {contatos.map((c, idx) => (
              <div key={idx} className="border border-gray-100 rounded-xl p-4 bg-gray-50 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-500">Contato {idx + 1}</span>
                  {contatos.length > 1 && (
                    <button type="button" onClick={() => removerContato(idx)}
                      className="text-red-400 hover:text-red-600 text-xs font-semibold transition">
                      × Remover
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-400 mb-1 block">Nome *</label>
                      <input value={c.nome} onChange={e => atualizarContato(idx, 'nome', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white"
                        placeholder="Nome completo" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 mb-1 block">Cargo</label>
                      <input value={c.cargo} onChange={e => atualizarContato(idx, 'cargo', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white"
                        placeholder="Ex: Gerente, Compras..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-400 mb-1 block">WhatsApp</label>
                      <input value={c.whatsapp} onChange={e => atualizarContato(idx, 'whatsapp', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white"
                        placeholder="55 62 9 9999-9999" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 mb-1 block">E-mail</label>
                      <input value={c.email} onChange={e => atualizarContato(idx, 'email', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white"
                        placeholder="email@empresa.com" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input type="checkbox" checked={c.recebe_notificacao}
                      onChange={e => atualizarContato(idx, 'recebe_notificacao', e.target.checked)}
                      className="w-4 h-4 accent-green-600" />
                    <span className="text-xs text-gray-600 font-semibold">
                      💬 Receber notificação via WhatsApp quando houver serviço agendado
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Observações */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">📝 Observações</h2>
          <textarea value={form.observacoes} onChange={e => atualizar('observacoes', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400 min-h-20 resize-none"
            placeholder="Preferências, histórico, informações relevantes sobre este cliente..." />
        </div>

        {erro && <p className="text-red-600 text-sm text-center bg-red-50 rounded-xl p-3">{erro}</p>}

        <button onClick={salvar} disabled={salvando}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-lg transition">
          {salvando ? '⏳ Salvando...' : '✅ Cadastrar Cliente'}
        </button>
      </div>
    </div>
  )
}
