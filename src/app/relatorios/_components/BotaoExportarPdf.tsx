/**
 * Botão que chama a API route /api/relatorios/[tipo]/pdf passando o período
 * e dispara download direto (resposta `Content-Type: application/pdf`).
 */
'use client'

import { useState } from 'react'
import type { PeriodoFiltro, TipoRelatorio } from '@/lib/relatorios/tipos'

type Props = {
  tipo: TipoRelatorio
  periodo: PeriodoFiltro
  filenamePrefix: string  // ex.: "relatorio-financeiro"
}

export function BotaoExportarPdf({ tipo, periodo, filenamePrefix }: Props) {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function exportar() {
    setCarregando(true)
    setErro('')
    try {
      console.log(`[relatorios] exportando PDF: tipo=${tipo} periodo=${periodo.inicio}→${periodo.fim}`)
      const resp = await fetch(`/api/relatorios/${tipo}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo }),
      })
      if (!resp.ok) {
        const txt = await resp.text()
        throw new Error(`HTTP ${resp.status}: ${txt}`)
      }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filenamePrefix}-${periodo.inicio}-a-${periodo.fim}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      console.log('[relatorios] PDF baixado com sucesso')
    } catch (e) {
      const msg = (e as { message?: string })?.message || JSON.stringify(e)
      console.error('[relatorios] erro ao exportar PDF:', msg)
      setErro('Falha ao gerar PDF: ' + msg)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={exportar}
        disabled={carregando}
        className="bg-white text-blue-700 font-bold px-3 py-1.5 rounded-lg text-sm disabled:opacity-60 hover:bg-blue-50 transition"
      >
        {carregando ? '⏳ Gerando…' : '📥 Exportar PDF'}
      </button>
      {erro && <span className="text-xs text-red-100 mt-1 max-w-[220px] text-right">{erro}</span>}
    </div>
  )
}
