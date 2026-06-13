/**
 * Card com número grande no topo + label embaixo. Usado nos relatórios
 * pra destaque dos KPIs principais. Suporta cor (success/warning/danger) e ícone.
 */
'use client'

type Tom = 'azul' | 'verde' | 'amarelo' | 'vermelho' | 'cinza'

const TONS: Record<Tom, { fg: string; bg: string }> = {
  azul:     { fg: 'text-blue-700',    bg: 'bg-blue-50' },
  verde:    { fg: 'text-emerald-700', bg: 'bg-emerald-50' },
  amarelo:  { fg: 'text-amber-700',   bg: 'bg-amber-50' },
  vermelho: { fg: 'text-red-700',     bg: 'bg-red-50' },
  cinza:    { fg: 'text-gray-700',    bg: 'bg-gray-50' },
}

type Props = {
  label: string
  valor: string
  emoji?: string
  tom?: Tom
  hint?: string  // texto pequeno embaixo, opcional
}

export function CardResumo({ label, valor, emoji, tom = 'azul', hint }: Props) {
  const cores = TONS[tom]
  return (
    <div className={`${cores.bg} rounded-2xl p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        {emoji && <span className="text-lg">{emoji}</span>}
      </div>
      <div className={`text-2xl sm:text-3xl font-black ${cores.fg}`}>{valor}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  )
}
