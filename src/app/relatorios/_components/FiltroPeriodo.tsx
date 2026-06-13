/**
 * Filtro de período (data início e fim) usado em todos os relatórios.
 *
 * Inputs HTML nativos `type="date"` — sem date-picker library (mantém leve).
 * Botões de atalho ("Últimos 30 dias", "Este mês", "Ano") pra UX.
 */
'use client'

import type { PeriodoFiltro } from '@/lib/relatorios/tipos'

type Props = {
  valor: PeriodoFiltro
  onChange: (novo: PeriodoFiltro) => void
}

function isoHoje(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoDiasAtras(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)
}

function inicioDoMes(): string {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function inicioDoAno(): string {
  const d = new Date()
  d.setMonth(0, 1)
  return d.toISOString().slice(0, 10)
}

export function FiltroPeriodo({ valor, onChange }: Props) {
  const setAtalho = (inicio: string) => onChange({ inicio, fim: isoHoje() })

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-semibold text-gray-600 mb-1">De</label>
          <input
            type="date"
            value={valor.inicio}
            onChange={(e) => onChange({ ...valor, inicio: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Até</label>
          <input
            type="date"
            value={valor.fim}
            onChange={(e) => onChange({ ...valor, fim: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <BotaoAtalho onClick={() => setAtalho(isoDiasAtras(30))}>Últimos 30 dias</BotaoAtalho>
        <BotaoAtalho onClick={() => setAtalho(isoDiasAtras(90))}>Últimos 3 meses</BotaoAtalho>
        <BotaoAtalho onClick={() => setAtalho(inicioDoMes())}>Este mês</BotaoAtalho>
        <BotaoAtalho onClick={() => setAtalho(inicioDoAno())}>Ano todo</BotaoAtalho>
      </div>
    </div>
  )
}

function BotaoAtalho({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
    >
      {children}
    </button>
  )
}
