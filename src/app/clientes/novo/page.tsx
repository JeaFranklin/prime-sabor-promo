'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const CATEGORIAS = ['indústria', 'distribuidor', 'varejo', 'evento', 'agência']

function validarCNPJ(cnpj: string): boolean {
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  let soma = 0
  let peso = 2
  for (let i = 11; i >= 0; i--) {
    soma += parseInt(c[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  let r = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  if (r !== parseInt(c[12])) return false
  soma = 0
  peso = 2
  for (let i = 12; i >= 0; i--) {
    soma += parseInt(c[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
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

export default function NovoCliente() {
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [cnpjErro, setCnpjErro] = useState('')
  const [form, setForm] = useState({
    nome_empresa: '',
    cnpj: '',
    contato_nome: '',
    whatsapp: '',
    email: '',
    categoria: '',
    cidade: '',
    estado: '',
    site: '',
    observacoes: '',
  })

  function atualizar(campo: string, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function handleCNPJ(v: string) {
    const formatado = formatarCNPJ(v)
    atualizar('cnpj', formatado)
    const numeros = formatado.replace(/\D/g, '')
    if (numeros.length === 14) {
      setCnpjErro(validarCNPJ(numeros) ? '' : '❌ CNPJ inválido — verifique os números digitados.')
    } else {
      setCnpjErro('')
    }
  }

  async function salvar() {
    if (!form.nome_empresa.trim()) { setErro('Nome da empresa é obrigatório.'); return }
    if (form.cnpj && !validarCNPJ(form.cnpj.replace(/\D/g, ''))) { setErro('CNPJ inválido.'); return }
    if (!form.categoria) { setErro('Selecione uma categoria.'); return }

    setSalvando(true)
    setErro('')

    const { error } = await supabase.from('clientes').insert({
      ...form,
      status: 'ativo',
    })

    setSalvando(false)
    if (error) setErro('Erro ao salvar: ' + error.message)
    else router.push('/clientes')
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
                {form.cnpj.replace(/\D/g, '').length === 14 && !cnpjErro && (
                  <p className="text-xs text-green-600 mt-1">✅ CNPJ válido</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Site</label>
                <input value={form.site} onChange={e => atualizar('site', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                  placeholder="www.empresa.com.br" />
              </div>
            </div>

            {/* Categoria */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">Categoria *</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIAS.map(cat => (
                  <button key={cat} type="button" onClick={() => atualizar('categoria', cat)}
                    className={`px-4 py-2 rounded-xl border-2 font-semibold text-sm transition capitalize ${
                      form.categoria === cat ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600'
                    }`}>
                    {cat === 'indústria' ? '🏭' : cat === 'distribuidor' ? '🚚' : cat === 'varejo' ? '🛒' : cat === 'evento' ? '🎪' : '📢'} {cat}
                  </button>
                ))}
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
          </div>
        </div>

        {/* Dados do contato */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-700 mb-4">👤 Pessoa de Contato</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome do Contato</label>
              <input value={form.contato_nome} onChange={e => atualizar('contato_nome', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                placeholder="Nome do responsável pela contratação" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">WhatsApp</label>
                <input value={form.whatsapp} onChange={e => atualizar('whatsapp', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                  placeholder="55 62 9 9999-9999" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">E-mail</label>
                <input value={form.email} onChange={e => atualizar('email', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
                  placeholder="contato@empresa.com" />
              </div>
            </div>
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
