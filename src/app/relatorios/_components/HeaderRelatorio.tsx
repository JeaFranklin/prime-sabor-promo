/**
 * Header padrão das páginas de relatório.
 *
 * Mantém consistência visual com o resto do app (gradiente colorido + título +
 * link voltar). Cor do módulo Relatórios = blue/cyan.
 */
'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

type Props = {
  titulo: string
  emoji: string
  voltarHref?: string  // padrão: /relatorios
  acoes?: ReactNode    // ex.: botão "Exportar PDF" no canto direito
}

export function HeaderRelatorio({ titulo, emoji, voltarHref = '/relatorios', acoes }: Props) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-4 py-4 shadow-sm">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={voltarHref}
            className="text-white/80 hover:text-white text-sm font-medium whitespace-nowrap"
          >
            ← Voltar
          </Link>
          <h1 className="text-lg sm:text-xl font-black truncate">
            {emoji} {titulo}
          </h1>
        </div>
        {acoes && <div className="flex items-center gap-2">{acoes}</div>}
      </div>
    </div>
  )
}
