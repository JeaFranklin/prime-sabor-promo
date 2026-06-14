/**
 * Sino de notificações no header.
 *
 *   - Mostra badge vermelho com qtd não-lidas
 *   - Click abre dropdown com últimas 20 notificações
 *   - Realtime via Supabase: nova notif aparece sem refresh
 *   - Click em item: marca como lida + navega (se tiver link_para)
 *   - Botão "Marcar todas como lidas"
 *
 * NOTA: depende da migration 005 (tabela `notificacoes` + REPLICA realtime).
 */
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Notificacao = {
  id: string
  tipo: string
  titulo: string
  mensagem: string | null
  icone: string | null
  link_para: string | null
  lida: boolean
  created_at: string
}

const LIMITE = 20

export default function SinoNotificacoes() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [notifs, setNotifs] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const naoLidas = notifs.filter(n => !n.lida).length

  // Carga inicial
  const carregar = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('id, tipo, titulo, mensagem, icone, link_para, lida, created_at')
        .order('created_at', { ascending: false })
        .limit(LIMITE)
      if (error) {
        console.error('[sino] falha ao carregar:', error.message)
        return
      }
      setNotifs(data ?? [])
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Realtime — recebe novas notificações sem refresh
  useEffect(() => {
    const canal = supabase
      .channel('notificacoes-sino')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes' },
        (payload) => {
          const nova = payload.new as Notificacao
          console.log('[sino] notif realtime:', nova.titulo)
          setNotifs(prev => [nova, ...prev.slice(0, LIMITE - 1)])
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    if (!aberto) return
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [aberto])

  async function marcarComoLida(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
    await supabase.from('notificacoes')
      .update({ lida: true, read_at: new Date().toISOString() })
      .eq('id', id)
  }

  async function marcarTodasComoLidas() {
    const ids = notifs.filter(n => !n.lida).map(n => n.id)
    if (ids.length === 0) return
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })))
    await supabase.from('notificacoes')
      .update({ lida: true, read_at: new Date().toISOString() })
      .in('id', ids)
  }

  function aoClicar(n: Notificacao) {
    marcarComoLida(n.id)
    if (n.link_para) {
      router.push(n.link_para)
    }
    setAberto(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className="relative p-1.5 rounded-full hover:bg-gray-100 transition"
        title="Notificações"
      >
        <span className="text-xl">🔔</span>
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm">Notificações</h3>
            {naoLidas > 0 && (
              <button
                type="button"
                onClick={marcarTodasComoLidas}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {carregando ? (
              <div className="text-center py-6 text-gray-400 text-sm">Carregando…</div>
            ) : notifs.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <div className="text-2xl mb-1">📭</div>
                Nenhuma notificação ainda.
              </div>
            ) : (
              notifs.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => aoClicar(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition flex gap-3 ${n.lida ? 'opacity-70' : 'bg-blue-50/30'}`}
                >
                  <div className="text-xl flex-shrink-0">{n.icone ?? 'ℹ️'}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${n.lida ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
                      {n.titulo}
                    </div>
                    {n.mensagem && (
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.mensagem}</div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-1">{tempoRelativo(n.created_at)}</div>
                  </div>
                  {!n.lida && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `há ${d}d`
  return new Date(iso).toLocaleDateString('pt-BR')
}
