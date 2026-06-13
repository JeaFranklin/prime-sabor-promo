/**
 * Página interna de detalhe do contrato.
 * - Mostra PDF embutido + metadados + linha do tempo
 * - Permite baixar PDF e reenviar pelo WhatsApp (se promotora)
 * - Acessível só pela equipe (lista /contratos → clica numa linha)
 */
'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
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
  pdf_path: string | null
  pdf_hash: string | null
  token_aceite: string | null
  expira_em: string | null
  aceito_em: string | null
  aceito_ip: string | null
  aceito_nome_digitado: string | null
  recusado_em: string | null
  recusa_motivo: string | null
  enviado_whatsapp_em: string | null
  enviado_whatsapp_numero: string | null
  observacoes: string | null
  created_at: string
  conteudo_json: { servico?: { nome?: string } }
  clientes: { nome_empresa: string } | null
  promotoras: { id: string; nome: string; whatsapp: string | null } | null
}

const STATUS_CORES: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-600',
  enviado: 'bg-blue-100 text-blue-700',
  aceito: 'bg-green-100 text-green-700',
  recusado: 'bg-red-100 text-red-700',
  expirado: 'bg-yellow-100 text-yellow-700',
  cancelado: 'bg-gray-200 text-gray-500',
}

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtMoeda(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ContratoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [reenviando, setReenviando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const supa = createSupabaseBrowser()
    Promise.all([
      supa.from('contratos').select(`
        id, numero, tipo, status, valor_total,
        data_inicio_servico, data_fim_servico, qtd_dias,
        pdf_path, pdf_hash, token_aceite, expira_em,
        aceito_em, aceito_ip, aceito_nome_digitado,
        recusado_em, recusa_motivo,
        enviado_whatsapp_em, enviado_whatsapp_numero,
        observacoes, created_at, conteudo_json,
        clientes:cliente_id ( nome_empresa ),
        promotoras:promotora_id ( id, nome, whatsapp )
      `).eq('id', id).maybeSingle(),
      fetch(`/api/contratos/${id}/signed-url`).then(r => r.json()),
    ]).then(([{ data, error }, urlResp]) => {
      if (error || !data) {
        setErro(error?.message || 'Contrato não encontrado')
      } else {
        setContrato(data as unknown as Contrato)
        if (urlResp.url) setPdfUrl(urlResp.url)
      }
      setCarregando(false)
    })
  }, [id])

  async function reenviarWhatsApp() {
    if (!contrato?.promotoras?.whatsapp) return
    setReenviando(true)
    setMsg(null)
    try {
      const r = await fetch(`/api/contratos/${id}/reenviar`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) setMsg(`❌ ${d.error || 'Falha ao reenviar'}`)
      else setMsg('✅ Mensagem reenviada por WhatsApp.')
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setReenviando(false)
    }
  }

  if (carregando) return <div className="p-8 text-center text-gray-500">Carregando contrato…</div>
  if (erro) return (
    <div className="p-8 text-center">
      <p className="text-red-600 mb-4">{erro}</p>
      <Link href="/contratos" className="text-blue-600 underline">← Voltar aos contratos</Link>
    </div>
  )
  if (!contrato) return null

  const linkAceitePublico = contrato.token_aceite && contrato.tipo === 'promotora'
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/contratos/aceite/${contrato.token_aceite}`
    : null

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <div className="mb-4">
          <Link href="/contratos" className="text-sm text-gray-500">← Contratos</Link>
          <div className="flex justify-between items-start mt-2 gap-4">
            <div>
              <h1 className="text-2xl font-black text-purple-700">{contrato.numero}</h1>
              <p className="text-sm text-gray-600 mt-1">
                {contrato.tipo === 'cliente'
                  ? <>Contrato B2B — <strong>{contrato.clientes?.nome_empresa || '—'}</strong></>
                  : <>Prestação de serviços autônoma — <strong>{contrato.promotoras?.nome || '—'}</strong></>}
              </p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_CORES[contrato.status] || 'bg-gray-100'}`}>
              {contrato.status.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* COLUNA 1: PDF EMBUTIDO (2/3 da largura) */}
          <div className="md:col-span-2 bg-white rounded-xl shadow overflow-hidden">
            {pdfUrl ? (
              <>
                <iframe src={pdfUrl} className="w-full" style={{ height: '75vh' }} title={contrato.numero} />
                <div className="p-3 text-center border-t flex gap-3 justify-center">
                  <a href={pdfUrl} download={`${contrato.numero}.pdf`}
                    className="text-sm bg-purple-600 text-white px-4 py-2 rounded font-semibold hover:bg-purple-700">
                    📥 Baixar PDF
                  </a>
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded font-semibold hover:bg-gray-200">
                    🔗 Abrir em nova aba
                  </a>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-gray-500">PDF não disponível.</div>
            )}
          </div>

          {/* COLUNA 2: DADOS + LINHA DO TEMPO (1/3 da largura) */}
          <div className="space-y-4">
            {/* Dados */}
            <div className="bg-white rounded-xl shadow p-4 text-sm">
              <h3 className="font-bold text-gray-700 mb-2">📋 Dados</h3>
              <dl className="space-y-1.5">
                <Linha label="Serviço" valor={contrato.conteudo_json?.servico?.nome || '—'} />
                <Linha label="Período" valor={`${contrato.data_inicio_servico} → ${contrato.data_fim_servico}`} />
                <Linha label="Duração" valor={`${contrato.qtd_dias} dias`} />
                <Linha label="Valor" valor={fmtMoeda(contrato.valor_total)} />
                <Linha label="Hash SHA-256" valor={contrato.pdf_hash ? contrato.pdf_hash.slice(0, 16) + '…' : '—'} mono />
              </dl>
            </div>

            {/* Linha do tempo */}
            <div className="bg-white rounded-xl shadow p-4 text-sm">
              <h3 className="font-bold text-gray-700 mb-3">📅 Linha do tempo</h3>
              <ol className="space-y-3">
                <Evento icone="📝" titulo="Gerado" quando={fmtData(contrato.created_at)} />
                {contrato.enviado_whatsapp_em && (
                  <Evento icone="📲" titulo="Enviado por WhatsApp"
                    quando={fmtData(contrato.enviado_whatsapp_em)}
                    detalhe={contrato.enviado_whatsapp_numero || undefined} />
                )}
                {contrato.aceito_em && (
                  <Evento icone="✅" titulo="Aceito eletronicamente"
                    quando={fmtData(contrato.aceito_em)}
                    detalhe={[contrato.aceito_nome_digitado, contrato.aceito_ip].filter(Boolean).join(' • ')} />
                )}
                {contrato.recusado_em && (
                  <Evento icone="❌" titulo="Recusado"
                    quando={fmtData(contrato.recusado_em)}
                    detalhe={contrato.recusa_motivo || undefined} />
                )}
                {!contrato.aceito_em && !contrato.recusado_em && contrato.expira_em && (
                  <Evento icone="⏰" titulo="Expira em" quando={fmtData(contrato.expira_em)} />
                )}
              </ol>
            </div>

            {/* Ações */}
            <div className="bg-white rounded-xl shadow p-4 text-sm space-y-2">
              <h3 className="font-bold text-gray-700 mb-2">⚡ Ações</h3>

              {contrato.tipo === 'promotora' && contrato.status === 'enviado' && contrato.promotoras?.whatsapp && (
                <button onClick={reenviarWhatsApp} disabled={reenviando}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2 rounded">
                  {reenviando ? 'Enviando…' : '📲 Reenviar pelo WhatsApp'}
                </button>
              )}

              {linkAceitePublico && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Link de aceite (compartilhar manualmente):</p>
                  <div className="flex gap-1">
                    <input readOnly value={linkAceitePublico}
                      className="flex-1 text-xs border rounded px-2 py-1 bg-gray-50 truncate" />
                    <button onClick={() => navigator.clipboard.writeText(linkAceitePublico)}
                      className="text-xs bg-gray-200 hover:bg-gray-300 px-2 rounded">
                      Copiar
                    </button>
                  </div>
                </div>
              )}

              {msg && <p className="text-xs mt-2 p-2 bg-gray-50 rounded">{msg}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Linha({ label, valor, mono }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-semibold text-right ${mono ? 'font-mono text-xs' : ''}`}>{valor}</dd>
    </div>
  )
}

function Evento({ icone, titulo, quando, detalhe }: { icone: string; titulo: string; quando: string; detalhe?: string }) {
  return (
    <li className="flex gap-2">
      <span>{icone}</span>
      <div className="flex-1">
        <p className="font-semibold text-gray-700">{titulo}</p>
        <p className="text-xs text-gray-500">{quando}</p>
        {detalhe && <p className="text-xs text-gray-400 italic">{detalhe}</p>}
      </div>
    </li>
  )
}
