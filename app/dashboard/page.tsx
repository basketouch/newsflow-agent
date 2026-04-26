'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '@/components/Nav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface ContentPost {
  id: string
  date: string
  topic: string
  linkedin_score?: number
  instagram_score?: number
  twitter_score?: number
  tiktok_score?: number
  hashtags: string[]
  status: string
  published_to: string[]
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avg(nums: (number | undefined)[]): number {
  const valid = nums.filter((n): n is number => n !== undefined && n !== null)
  if (!valid.length) return 0
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
}

function last7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color = 'text-zinc-100',
}: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  )
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : '#ef4444'
  const pct = score / 10
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = circ * pct

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-16 h-16">
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
          <circle cx="32" cy="32" r={r} stroke="#27272a" strokeWidth="6" fill="none" />
          <circle
            cx="32" cy="32" r={r}
            stroke={color} strokeWidth="6" fill="none"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-zinc-100">
          {score || '–'}
        </span>
      </div>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  )
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map(d => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] text-zinc-600">{d.value || ''}</span>
          <div className="w-full flex flex-col justify-end" style={{ height: '72px' }}>
            <div
              className="w-full rounded-t-md bg-purple-600/70 transition-all"
              style={{ height: `${Math.max((d.value / max) * 72, d.value ? 4 : 0)}px` }}
            />
          </div>
          <span className="text-[10px] text-zinc-600 capitalize">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('content_daily')
      .select('id, date, topic, linkedin_score, instagram_score, twitter_score, tiktok_score, hashtags, status, published_to, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) setPosts(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Métricas ──
  const today = new Date().toISOString().split('T')[0]
  const todayPosts    = posts.filter(p => p.date === today)
  const pending       = posts.filter(p => p.status === 'pending_review')
  const partial       = posts.filter(p => p.status === 'published_partial')
  const publishedAll  = posts.filter(p => p.status === 'published_all')

  const avgLI = avg(posts.map(p => p.linkedin_score))
  const avgIG = avg(posts.map(p => p.instagram_score))
  const avgX  = avg(posts.map(p => p.twitter_score))
  const avgTK = avg(posts.map(p => p.tiktok_score))
  const avgGlobal = avg([avgLI, avgIG, avgX, avgTK])

  // Últimos 7 días
  const days = last7Days()
  const chartData = days.map(d => ({
    label: formatDate(d).split(' ').slice(0, 2).join(' '),
    value: posts.filter(p => p.date === d).length,
  }))

  // Racha
  let racha = 0
  for (let i = 0; i < days.length; i++) {
    const d = days[days.length - 1 - i]
    if (posts.some(p => p.date === d)) racha++
    else break
  }

  // Hashtags más usados
  const tagCount: Record<string, number> = {}
  posts.forEach(p => {
    (p.hashtags || []).forEach(h => {
      tagCount[h] = (tagCount[h] || 0) + 1
    })
  })
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)

  // Temas recientes
  const recentTopics = posts.slice(0, 5)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-purple-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center text-xs font-bold">N</div>
          <span className="text-sm font-semibold">NewsFlow</span>
        </div>
        <Nav />
        <button
          onClick={load}
          className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M13 1v4H9M1 13V9h4M2.5 5.5A5 5 0 0112 7M11.5 8.5A5 5 0 012 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Actualizar
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Bloque 1: Métricas hoy ── */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Hoy</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Posts generados hoy" value={todayPosts.length} color="text-purple-400" />
            <StatCard label="Score promedio global" value={avgGlobal || '–'} sub="sobre 10" color="text-emerald-400" />
            <StatCard label="Racha actual" value={`${racha}d`} sub="días consecutivos" color="text-amber-400" />
            <StatCard label="Total histórico" value={posts.length} sub="posts generados" />
          </div>
        </section>

        {/* ── Bloque 2: Estado publicación ── */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Estado de publicación</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-amber-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-zinc-500">Pendientes de revisar</p>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              </div>
              <p className="text-4xl font-bold text-amber-400">{pending.length}</p>
              <div className="mt-3 space-y-1.5">
                {pending.slice(0, 3).map(p => (
                  <p key={p.id} className="text-xs text-zinc-600 truncate">· {p.topic}</p>
                ))}
                {pending.length > 3 && (
                  <p className="text-xs text-zinc-700">+{pending.length - 3} más</p>
                )}
              </div>
            </div>

            <div className="bg-zinc-900 border border-blue-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-zinc-500">Publicados parcialmente</p>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              </div>
              <p className="text-4xl font-bold text-blue-400">{partial.length}</p>
              <p className="text-xs text-zinc-600 mt-3">Pendiente completar plataformas</p>
            </div>

            <div className="bg-zinc-900 border border-emerald-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-zinc-500">Publicados en todas</p>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <p className="text-4xl font-bold text-emerald-400">{publishedAll.length}</p>
              <div className="mt-3">
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full"
                    style={{ width: posts.length ? `${(publishedAll.length / posts.length) * 100}%` : '0%' }}
                  />
                </div>
                <p className="text-xs text-zinc-600 mt-1">
                  {posts.length ? Math.round((publishedAll.length / posts.length) * 100) : 0}% del total
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Bloque 3: Scores por plataforma ── */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Rendimiento por plataforma</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex justify-around">
              <ScoreRing score={avgLI} label="LinkedIn" />
              <ScoreRing score={avgIG} label="Instagram" />
              <ScoreRing score={avgX}  label="Twitter/X" />
              <ScoreRing score={avgTK} label="TikTok" />
            </div>
            <p className="text-center text-xs text-zinc-600 mt-4">
              Score promedio histórico — escala 1 a 10
            </p>
          </div>
        </section>

        {/* ── Bloque 4: Actividad 7 días ── */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Actividad últimos 7 días</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <BarChart data={chartData} />
          </div>
        </section>

        {/* ── Bloque 5: Hashtags + Temas recientes ── */}
        <div className="grid grid-cols-2 gap-6">

          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Hashtags más usados</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              {topTags.length === 0 ? (
                <p className="text-sm text-zinc-600">Sin datos aún</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topTags.map(([tag, count]) => (
                    <span
                      key={tag}
                      className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full"
                    >
                      #{tag}
                      <span className="ml-1.5 text-purple-500/60">{count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Temas recientes</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
              {recentTopics.length === 0 ? (
                <p className="text-sm text-zinc-600">Sin posts aún</p>
              ) : recentTopics.map(p => {
                const scores = [p.linkedin_score, p.instagram_score, p.twitter_score, p.tiktok_score]
                const a = avg(scores)
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3">
                    <p className="text-sm text-zinc-300 truncate flex-1">{p.topic}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-bold ${a >= 8 ? 'text-emerald-400' : a >= 6 ? 'text-amber-400' : 'text-zinc-500'}`}>
                        {a || '–'}
                      </span>
                      <span className="text-[10px] text-zinc-600">{p.date}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
