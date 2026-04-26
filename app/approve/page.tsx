'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '@/components/Nav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PAGE_SIZE = 15

interface Article {
  id: string
  title: string
  description: string
  summary?: string
  url: string
  source_name: string
  source_type: string
  category?: string
  relevance_score?: number
  relevance_reason?: string
  approved: boolean | null
  created_at: string
}

const CATEGORY_COLOR: Record<string, string> = {
  IA:        'text-purple-400 bg-purple-400/10 border-purple-400/20',
  Liderazgo: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  Empresa:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  Negocio:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  default:   'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
}

function ScoreBadge({ score }: { score?: number }) {
  if (!score) return null
  const color = score >= 8 ? 'bg-emerald-500' : score >= 6 ? 'bg-amber-500' : 'bg-zinc-600'
  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
      {score}
    </div>
  )
}

export default function ApprovePage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [actioning, setActioning] = useState<string | null>(null)

  const loadArticles = useCallback(async (currentOffset: number, replace = false) => {
    setLoading(true)
    const { data } = await supabase
      .from('articles')
      .select('id, title, description, summary, url, source_name, source_type, category, relevance_score, relevance_reason, approved, created_at')
      .is('approved', null)
      .order('relevance_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1)

    if (data) {
      setArticles(prev => replace ? data : [...prev, ...data])
      setHasMore(data.length === PAGE_SIZE)
    }
    setLoading(false)
  }, [])

  const loadCount = useCallback(async () => {
    const { count } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .is('approved', null)
    setPendingCount(count ?? 0)
  }, [])

  useEffect(() => {
    loadArticles(0, true)
    loadCount()
  }, [loadArticles, loadCount])

  const loadMore = () => {
    const newOffset = offset + PAGE_SIZE
    setOffset(newOffset)
    loadArticles(newOffset)
  }

  const handleAction = async (id: string, approved: boolean) => {
    setActioning(id)
    await supabase.from('articles').update({ approved }).eq('id', id)
    setArticles(prev => prev.filter(a => a.id !== id))
    setPendingCount(prev => Math.max(0, prev - 1))
    setActioning(null)
  }

  const approveAll = async () => {
    const ids = articles.map(a => a.id)
    for (const id of ids) {
      await supabase.from('articles').update({ approved: true }).eq('id', id)
    }
    setArticles([])
    setPendingCount(0)
  }

  const discardAll = async () => {
    const ids = articles.map(a => a.id)
    for (const id of ids) {
      await supabase.from('articles').update({ approved: false }).eq('id', id)
    }
    setArticles([])
    setPendingCount(0)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center text-xs font-bold">N</div>
          <span className="text-sm font-semibold">NewsFlow</span>
        </div>
        <Nav />
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full font-medium">
              {pendingCount} pendientes
            </span>
          )}
          <button
            onClick={() => { setOffset(0); loadArticles(0, true); loadCount() }}
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            ↻ Actualizar
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Title + bulk actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Noticias pendientes</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Aprueba las que quieres que el agente use para generar contenido
            </p>
          </div>
          {articles.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={discardAll}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-red-500/30 hover:text-red-400 text-zinc-500 transition-colors"
              >
                Descartar todo
              </button>
              <button
                onClick={approveAll}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-emerald-400 transition-colors"
              >
                Aprobar todo
              </button>
            </div>
          )}
        </div>

        {/* Articles list */}
        {articles.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-zinc-400 font-medium">Todo revisado</p>
            <p className="text-zinc-600 text-sm mt-1">No hay noticias pendientes de aprobación</p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map(article => {
              const catColor = CATEGORY_COLOR[article.category ?? ''] ?? CATEGORY_COLOR.default
              const isActioning = actioning === article.id

              return (
                <div
                  key={article.id}
                  className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 transition-all ${isActioning ? 'opacity-40 scale-95' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <ScoreBadge score={article.relevance_score} />

                    <div className="flex-1 min-w-0">
                      {/* Meta */}
                      <div className="flex items-center gap-2 mb-1.5">
                        {article.category && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${catColor}`}>
                            {article.category}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-600">{article.source_name}</span>
                        <span className="text-[10px] text-zinc-700 ml-auto">
                          {new Date(article.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>

                      {/* Title */}
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-zinc-100 hover:text-purple-300 transition-colors line-clamp-2 leading-snug"
                      >
                        {article.title}
                      </a>

                      {/* Summary */}
                      {(article.summary || article.description) && (
                        <p className="text-xs text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed">
                          {article.summary || article.description}
                        </p>
                      )}

                      {/* Relevance reason */}
                      {article.relevance_reason && (
                        <p className="text-xs text-purple-400/70 mt-1.5 italic line-clamp-1">
                          ✦ {article.relevance_reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800">
                    <button
                      onClick={() => handleAction(article.id, false)}
                      disabled={!!actioning}
                      className="flex-1 py-2 rounded-xl border border-zinc-700 hover:border-red-500/30 hover:bg-red-500/5 text-xs text-zinc-500 hover:text-red-400 transition-all"
                    >
                      ✕ Descartar
                    </button>
                    <button
                      onClick={() => handleAction(article.id, true)}
                      disabled={!!actioning}
                      className="flex-1 py-2 rounded-xl bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/20 text-xs text-emerald-400 transition-all font-medium"
                    >
                      ✓ Aprobar
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Load more */}
            {hasMore && !loading && (
              <button
                onClick={loadMore}
                className="w-full py-3 rounded-xl border border-zinc-800 hover:border-zinc-600 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Ver más noticias →
              </button>
            )}

            {loading && (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-zinc-700 border-t-purple-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
